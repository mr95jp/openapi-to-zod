import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ZodSchemaGenerator {
  constructor(openApiDoc) {
    this.openApiDoc = openApiDoc;
    this.schemas = openApiDoc.components?.schemas || {};
    this.paths = openApiDoc.paths || {};
    this.generatedSchemas = new Map();
    this.processingStack = new Set();
    this.dependencies = new Map();
  }

  convertType(property, currentPath = [], schemaName = '', isInline = false) {
    if (!property) return 'z.unknown()';
    
    if (property.$ref) {
      const refName = property.$ref.split('/').pop();
      // Track dependency
      if (schemaName && refName && !isInline) {
        if (!this.dependencies.has(schemaName)) {
          this.dependencies.set(schemaName, new Set());
        }
        this.dependencies.get(schemaName).add(refName);
      }
      
      // Check if we're in a circular reference
      if (currentPath.includes(refName)) {
        return `z.lazy(() => ${refName})`;
      }
      
      // If inline, return the actual schema instead of reference
      if (isInline && this.schemas[refName]) {
        return this.convertType(this.schemas[refName], [...currentPath, refName], refName, true);
      }
      
      return refName;
    }
    
    if (property.allOf) {
      const schemas = property.allOf.map(s => this.convertType(s, currentPath, schemaName, isInline));
      return schemas.length > 1 ? `z.intersection(${schemas.join(', ')})` : schemas[0];
    }
    
    if (property.oneOf) {
      const schemas = property.oneOf.map(s => this.convertType(s, currentPath, schemaName, isInline));
      return `z.union([${schemas.join(', ')}])`;
    }
    
    if (property.anyOf) {
      const schemas = property.anyOf.map(s => this.convertType(s, currentPath, schemaName, isInline));
      return `z.union([${schemas.join(', ')}])`;
    }
    
    const type = property.type;
    
    switch (type) {
      case 'string':
        return this.convertString(property);
        
      case 'number':
      case 'integer':
        return this.convertNumber(property, type);
        
      case 'boolean':
        return 'z.boolean()';
        
      case 'array':
        return this.convertArray(property, currentPath, schemaName, isInline);
        
      case 'object':
        return this.convertObject(property, currentPath, schemaName, isInline);
        
      case 'null':
        return 'z.null()';
        
      default:
        return 'z.unknown()';
    }
  }

  convertString(property) {
    let zodString = 'z.string()';
    
    if (property.enum) {
      return `z.enum([${property.enum.map(e => `"${e}"`).join(', ')}])`;
    }
    
    if (property.format === 'date-time') {
      zodString += '.datetime()';
    } else if (property.format === 'date') {
      zodString += '.date()';
    } else if (property.format === 'email') {
      zodString += '.email()';
    } else if (property.format === 'uuid') {
      zodString += '.uuid()';
    } else if (property.format === 'uri' || property.format === 'url') {
      zodString += '.url()';
    }
    
    if (property.pattern) {
      zodString += `.regex(/${property.pattern}/)`;
    }
    if (property.minLength !== undefined) {
      zodString += `.min(${property.minLength})`;
    }
    if (property.maxLength !== undefined) {
      zodString += `.max(${property.maxLength})`;
    }
    
    return zodString;
  }

  convertNumber(property, type) {
    let zodNumber = type === 'integer' ? 'z.number().int()' : 'z.number()';
    
    if (property.minimum !== undefined) {
      zodNumber += `.min(${property.minimum})`;
    }
    if (property.maximum !== undefined) {
      zodNumber += `.max(${property.maximum})`;
    }
    
    return zodNumber;
  }

  convertArray(property, currentPath, schemaName, isInline = false) {
    const itemsSchema = this.convertType(property.items, currentPath, schemaName, isInline);
    let zodArray = `z.array(${itemsSchema})`;
    
    if (property.minItems !== undefined) {
      zodArray += `.min(${property.minItems})`;
    }
    if (property.maxItems !== undefined) {
      zodArray += `.max(${property.maxItems})`;
    }
    
    return zodArray;
  }

  convertObject(property, currentPath, schemaName, isInline = false) {
    if (property.properties) {
      const props = Object.entries(property.properties)
        .map(([key, value]) => {
          const isRequired = property.required && property.required.includes(key);
          const zodType = this.convertType(value, currentPath, schemaName, isInline);
          const optionalModifier = isRequired ? '' : '.optional()';
          return `  ${key}: ${zodType}${optionalModifier}`;
        })
        .join(',\n');
      
      let zodObject = `z.object({\n${props}\n})`;
      
      if (property.additionalProperties === false) {
        zodObject += '.strict()';
      } else if (property.additionalProperties === true) {
        zodObject += '.catchall(z.unknown())';
      } else if (property.additionalProperties) {
        const additionalSchema = this.convertType(property.additionalProperties, currentPath, schemaName, isInline);
        zodObject += `.catchall(${additionalSchema})`;
      }
      
      return zodObject;
    }
    return 'z.record(z.unknown())';
  }

  generateDescription(name) {
    // Generate human-readable description from schema name
    const words = name.match(/[A-Z][a-z]+|[A-Z]+(?=[A-Z])|[a-z]+/g) || [];
    const description = words.join(' ').toLowerCase();
    return description.charAt(0).toUpperCase() + description.slice(1);
  }

  getPropertyType(propSchema) {
    if (propSchema.$ref) {
      return propSchema.$ref.split('/').pop();
    }
    if (propSchema.type === 'string') return 'string';
    if (propSchema.type === 'number') return 'number';
    if (propSchema.type === 'integer') return 'number';
    if (propSchema.type === 'boolean') return 'boolean';
    if (propSchema.type === 'array') {
      const itemType = propSchema.items ? this.getPropertyType(propSchema.items) : 'any';
      return `${itemType}[]`;
    }
    if (propSchema.type === 'object') return 'object';
    return 'any';
  }

  isComponentSchema(schema) {
    // Check if a schema is defined in components/schemas
    if (!schema || !schema.$ref) return false;
    return schema.$ref.startsWith('#/components/schemas/');
  }

  generateOperationSchemas() {
    const files = [];
    const operationSchemas = new Map();

    // Process all paths and operations
    Object.entries(this.paths).forEach(([pathName, pathItem]) => {
      Object.entries(pathItem).forEach(([method, operation]) => {
        if (!operation.operationId) return;
        
        const operationId = operation.operationId;
        const dirName = operationId;
        
        if (!operationSchemas.has(dirName)) {
          operationSchemas.set(dirName, {
            operationId,
            summary: operation.summary || this.generateDescription(operationId),
            method: method.toUpperCase(),
            path: pathName,
            request: null,
            responses: {}
          });
        }
        
        const opSchema = operationSchemas.get(dirName);
        
        // Process request body
        if (operation.requestBody?.content?.['application/json']?.schema) {
          const requestSchema = operation.requestBody.content['application/json'].schema;
          opSchema.request = requestSchema;
        }
        
        // Process responses
        if (operation.responses) {
          Object.entries(operation.responses).forEach(([statusCode, response]) => {
            if (response.content?.['application/json']?.schema) {
              opSchema.responses[statusCode] = {
                description: response.description || `Response ${statusCode}`,
                schema: response.content['application/json'].schema
              };
            }
          });
        }
      });
    });

    // Generate files for each operation
    operationSchemas.forEach((opSchema, dirName) => {
      const imports = new Set();
      imports.add("import { z } from 'zod';");
      
      let content = [];
      
      // Find component references
      const componentRefs = new Set();
      
      // Check request for component references
      if (opSchema.request && this.isComponentSchema(opSchema.request)) {
        const refName = opSchema.request.$ref.split('/').pop();
        componentRefs.add(refName);
      }
      
      // Check responses for component references
      Object.values(opSchema.responses).forEach(response => {
        this.findComponentReferences(response.schema, componentRefs);
      });
      
      // Add imports for component schemas
      componentRefs.forEach(schemaName => {
        if (this.schemas[schemaName]) {
          imports.add(`import { ${schemaName} } from '../_components/${schemaName}';`);
        }
      });
      
      content.push(...Array.from(imports));
      content.push('');
      
      // Add operation documentation
      content.push('/**');
      content.push(` * ${opSchema.summary}`);
      content.push(` * `);
      content.push(` * @operationId ${opSchema.operationId}`);
      content.push(` * @method ${opSchema.method}`);
      content.push(` * @path ${opSchema.path}`);
      content.push(' */');
      content.push('');
      
      // Generate request schema
      if (opSchema.request) {
        content.push('/**');
        content.push(' * Request schema');
        content.push(' */');
        
        if (this.isComponentSchema(opSchema.request)) {
          // Use component reference
          const refName = opSchema.request.$ref.split('/').pop();
          content.push(`export const Request = ${refName};`);
        } else {
          // Inline schema
          const requestZod = this.convertType(opSchema.request, [], 'Request', true);
          content.push(`export const Request = ${requestZod};`);
        }
        content.push(`export type RequestType = z.infer<typeof Request>;`);
        content.push('');
      }
      
      // Generate response schemas
      Object.entries(opSchema.responses).forEach(([statusCode, response]) => {
        content.push('/**');
        content.push(` * Response ${statusCode}: ${response.description}`);
        content.push(' */');
        
        // Check if response contains only component references
        const responseZod = this.convertResponseSchema(response.schema, componentRefs);
        content.push(`export const Response${statusCode} = ${responseZod};`);
        content.push(`export type Response${statusCode}Type = z.infer<typeof Response${statusCode}>;`);
        content.push('');
      });
      
      // Generate index file for the operation
      files.push({
        dirName,
        fileName: 'schema.ts',
        content: content.join('\n')
      });
    });
    
    return files;
  }

  convertResponseSchema(schema, componentRefs) {
    if (!schema) return 'z.unknown()';
    
    // If it's a direct component reference
    if (this.isComponentSchema(schema)) {
      const refName = schema.$ref.split('/').pop();
      return refName;
    }
    
    // If it's an object with properties that might contain component references
    if (schema.type === 'object' && schema.properties) {
      const props = Object.entries(schema.properties)
        .map(([key, value]) => {
          const isRequired = schema.required && schema.required.includes(key);
          let zodType;
          
          if (this.isComponentSchema(value)) {
            const refName = value.$ref.split('/').pop();
            componentRefs.add(refName);
            zodType = refName;
          } else {
            zodType = this.convertType(value, [], '', true);
          }
          
          const optionalModifier = isRequired ? '' : '.optional()';
          return `  ${key}: ${zodType}${optionalModifier}`;
        })
        .join(',\n');
      
      return `z.object({\n${props}\n})`;
    }
    
    // Otherwise, convert inline
    return this.convertType(schema, [], '', true);
  }

  findComponentReferences(schema, references) {
    if (!schema) return;
    
    if (this.isComponentSchema(schema)) {
      const refName = schema.$ref.split('/').pop();
      references.add(refName);
      // Don't recurse into component schemas
      return;
    }
    
    if (schema.allOf) {
      schema.allOf.forEach(s => this.findComponentReferences(s, references));
    }
    
    if (schema.oneOf) {
      schema.oneOf.forEach(s => this.findComponentReferences(s, references));
    }
    
    if (schema.anyOf) {
      schema.anyOf.forEach(s => this.findComponentReferences(s, references));
    }
    
    if (schema.properties) {
      Object.values(schema.properties).forEach(prop => {
        this.findComponentReferences(prop, references);
      });
    }
    
    if (schema.items) {
      this.findComponentReferences(schema.items, references);
    }
  }

  generateComponentSchemas() {
    const files = [];
    
    // Generate all component schema files
    Object.keys(this.schemas).forEach(name => {
      const schemaFile = this.generateSchemaFile(name);
      if (schemaFile) {
        files.push({
          dirName: '_components',
          fileName: schemaFile.fileName,
          content: schemaFile.content
        });
      }
    });
    
    return files;
  }

  generateSchemaFile(name) {
    if (this.generatedSchemas.has(name)) return this.generatedSchemas.get(name);
    
    // Check for circular dependency
    if (this.processingStack.has(name)) {
      console.log(`Detected circular reference for schema: ${name}`);
      return null;
    }
    
    const schema = this.schemas[name];
    if (!schema) return null;
    
    this.processingStack.add(name);
    
    const zodSchema = this.convertType(schema, [name], name);
    
    // Build import statements for dependencies
    const imports = [];
    imports.push("import { z } from 'zod';");
    
    if (this.dependencies.has(name)) {
      const deps = Array.from(this.dependencies.get(name));
      deps.forEach(depName => {
        if (this.schemas[depName]) {
          imports.push(`import { ${depName} } from './${depName}';`);
        }
      });
    }
    
    // Generate JSDoc comment
    const description = schema.description || this.generateDescription(name);
    const properties = schema.properties || {};
    const required = schema.required || [];
    
    let jsDoc = ['/**'];
    jsDoc.push(` * ${description}`);
    
    // Add property descriptions if available
    if (Object.keys(properties).length > 0) {
      jsDoc.push(' *');
      Object.entries(properties).forEach(([propName, propSchema]) => {
        const isRequired = required.includes(propName);
        const propDescription = propSchema.description || propName;
        const propType = this.getPropertyType(propSchema);
        jsDoc.push(` * @property {${propType}} ${propName}${isRequired ? '' : '?'} - ${propDescription}`);
      });
    }
    
    jsDoc.push(' */');
    
    const content = [
      ...imports,
      '',
      ...jsDoc,
      `export const ${name} = ${zodSchema};`,
      `export type ${name}Type = z.infer<typeof ${name}>;`,
      ''
    ].join('\n');
    
    const result = {
      fileName: `${name}.ts`,
      content: content
    };
    
    this.generatedSchemas.set(name, result);
    this.processingStack.delete(name);
    
    return result;
  }

  generate() {
    const componentFiles = this.generateComponentSchemas();
    const operationFiles = this.generateOperationSchemas();
    
    return [...componentFiles, ...operationFiles];
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: 'document.json',
    output: 'schema'
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-file':
        if (i + 1 < args.length) {
          options.file = args[i + 1];
          i++;
        }
        break;
      case '-output':
        if (i + 1 < args.length) {
          options.output = args[i + 1];
          i++;
        }
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npm run generateZod [options]

Options:
  -file <path>     Path to OpenAPI JSON document (default: document.json)
  -output <path>   Output directory path (default: schema)
  -h, --help       Show this help message

Examples:
  npm run generateZod
  npm run generateZod -file api.json -output generated-schemas
        `);
        process.exit(0);
        break;
    }
  }
  
  return options;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    
    // Resolve paths relative to current working directory or as absolute paths
    const documentPath = path.isAbsolute(options.file) 
      ? options.file 
      : path.resolve(process.cwd(), options.file);
    const outputDir = path.isAbsolute(options.output) 
      ? options.output 
      : path.resolve(process.cwd(), options.output);
    
    console.log(`Reading ${options.file}...`);
    const documentContent = fs.readFileSync(documentPath, 'utf-8');
    const openApiDoc = JSON.parse(documentContent);
    
    console.log('Generating Zod schemas...');
    const generator = new ZodSchemaGenerator(openApiDoc);
    const files = generator.generate();
    
    // Clean and create output directory
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Write files to their directories
    let fileCount = 0;
    let dirCount = new Set();
    
    files.forEach(file => {
      const dirPath = file.dirName ? path.join(outputDir, file.dirName) : outputDir;
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        if (file.dirName) dirCount.add(file.dirName);
      }
      
      const filePath = path.join(dirPath, file.fileName);
      fs.writeFileSync(filePath, file.content);
      fileCount++;
    });
    
    console.log(`✅ Successfully generated ${fileCount} files`);
    console.log(`   - Operation endpoints: ${files.filter(f => f.dirName && f.dirName !== 'components').length}`);
    console.log(`   - Component schemas: ${files.filter(f => f.dirName === 'components').length}`);
    console.log(`   - Total directories: ${dirCount.size}`);
    
    // Show sample operation directories
    const sampleOps = files
      .filter(f => f.dirName && f.dirName !== 'components')
      .slice(0, 5)
      .map(f => `schema/${f.dirName}/`);
    if (sampleOps.length > 0) {
      console.log(`   - Sample operations: ${sampleOps.join(', ')}`);
    }
  } catch (error) {
    console.error('Error generating schemas:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();