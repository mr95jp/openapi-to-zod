import { Schema, GeneratedFile } from '../types.js';
import { TypeConverter } from '../utils/typeConverter.js';
import { generateDescription, getPropertyType } from '../utils/helpers.js';

export class ComponentGenerator {
  private schemas: Record<string, Schema>;
  private typeConverter: TypeConverter;
  private generatedSchemas = new Map<string, GeneratedFile>();
  private processingStack = new Set<string>();

  constructor(schemas: Record<string, Schema>) {
    this.schemas = schemas;
    this.typeConverter = new TypeConverter(schemas);
  }

  generateComponentSchemas(): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    
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

  private generateSchemaFile(name: string): GeneratedFile | null {
    if (this.generatedSchemas.has(name)) {
      return this.generatedSchemas.get(name)!;
    }
    
    // Check for circular dependency
    if (this.processingStack.has(name)) {
      console.log(`Detected circular reference for schema: ${name}`);
      return null;
    }
    
    const schema = this.schemas[name];
    if (!schema) return null;
    
    this.processingStack.add(name);
    
    const zodSchema = this.typeConverter.convertType(schema, [name], name);
    
    // Build import statements for dependencies
    const imports: string[] = [];
    imports.push("import { z } from 'zod';");
    
    const deps = this.typeConverter.getDependencies(name);
    deps.forEach(depName => {
      if (this.schemas[depName]) {
        imports.push(`import { ${depName} } from './${depName}.js';`);
      }
    });
    
    // Generate JSDoc comment
    const description = schema.description || generateDescription(name);
    const properties = schema.properties || {};
    const required = schema.required || [];
    
    const jsDoc: string[] = ['/**'];
    jsDoc.push(` * ${description}`);
    
    // Add property descriptions if available
    if (Object.keys(properties).length > 0) {
      jsDoc.push(' *');
      Object.entries(properties).forEach(([propName, propSchema]) => {
        const isRequired = required.includes(propName);
        const propDescription = propSchema.description || propName;
        const propType = getPropertyType(propSchema);
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
    
    const result: GeneratedFile = {
      fileName: `${name}.ts`,
      content: content
    };
    
    this.generatedSchemas.set(name, result);
    this.processingStack.delete(name);
    
    return result;
  }
}