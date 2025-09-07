import { OpenAPIDocument, Schema, GeneratedFile, OperationSchema } from '../types.js';
import { TypeConverter } from '../utils/typeConverter.js';
import { generateDescription, isComponentSchema, findComponentReferences } from '../utils/helpers.js';

export class OperationGenerator {
  private schemas: Record<string, Schema>;
  private paths: Record<string, any>;
  private typeConverter: TypeConverter;

  constructor(openApiDoc: OpenAPIDocument) {
    this.schemas = openApiDoc.components?.schemas || {};
    this.paths = openApiDoc.paths || {};
    this.typeConverter = new TypeConverter(this.schemas);
  }

  generateOperationSchemas(): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const operationSchemas = new Map<string, OperationSchema>();

    // Process all paths and operations
    Object.entries(this.paths).forEach(([pathName, pathItem]) => {
      Object.entries(pathItem).forEach(([method, operation]) => {
        if (!operation || typeof operation !== 'object' || !('operationId' in operation) || !operation.operationId) return;
        
        const operationId = operation.operationId as string;
        const dirName = operationId;
        
        if (!operationSchemas.has(dirName)) {
          operationSchemas.set(dirName, {
            operationId,
            summary: (operation as any).summary || generateDescription(operationId),
            method: method.toUpperCase(),
            path: pathName,
            request: null,
            responses: {}
          });
        }
        
        const opSchema = operationSchemas.get(dirName)!;
        
        // Process request body
        const requestBody = (operation as any).requestBody;
        if (requestBody?.content?.['application/json']?.schema) {
          const requestSchema = requestBody.content['application/json'].schema;
          opSchema.request = requestSchema;
        }
        
        // Process responses
        const responses = (operation as any).responses;
        if (responses) {
          Object.entries(responses).forEach(([statusCode, response]) => {
            const resp = response as any;
            if (resp.content?.['application/json']?.schema) {
              opSchema.responses[statusCode] = {
                description: resp.description || `Response ${statusCode}`,
                schema: resp.content['application/json'].schema
              };
            }
          });
        }
      });
    });

    // Generate files for each operation
    operationSchemas.forEach((opSchema, dirName) => {
      const imports = new Set<string>();
      imports.add("import { z } from 'zod';");
      
      const content: string[] = [];
      
      // Find component references
      const componentRefs = new Set<string>();
      
      // Check request for component references
      if (opSchema.request && isComponentSchema(opSchema.request)) {
        const refName = opSchema.request.$ref!.split('/').pop()!;
        componentRefs.add(refName);
      }
      
      // Check responses for component references
      Object.values(opSchema.responses).forEach(response => {
        findComponentReferences(response.schema, componentRefs);
      });
      
      // Add imports for component schemas
      componentRefs.forEach(schemaName => {
        if (this.schemas[schemaName]) {
          imports.add(`import { ${schemaName} } from '../_components/${schemaName}.js';`);
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
        
        if (isComponentSchema(opSchema.request)) {
          // Use component reference
          const refName = opSchema.request.$ref!.split('/').pop()!;
          content.push(`export const Request = ${refName};`);
        } else {
          // Inline schema
          const requestZod = this.typeConverter.convertType(opSchema.request, [], 'Request', true);
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

  private convertResponseSchema(schema: Schema, componentRefs: Set<string>): string {
    if (!schema) return 'z.unknown()';
    
    // If it's a direct component reference
    if (isComponentSchema(schema)) {
      const refName = schema.$ref!.split('/').pop()!;
      return refName;
    }
    
    // If it's an object with properties that might contain component references
    if (schema.type === 'object' && schema.properties) {
      const props = Object.entries(schema.properties)
        .map(([key, value]) => {
          const isRequired = schema.required && schema.required.includes(key);
          let zodType: string;
          
          if (isComponentSchema(value)) {
            const refName = value.$ref!.split('/').pop()!;
            componentRefs.add(refName);
            zodType = refName;
          } else {
            zodType = this.typeConverter.convertType(value, [], '', true);
          }
          
          const optionalModifier = isRequired ? '' : '.optional()';
          return `  ${key}: ${zodType}${optionalModifier}`;
        })
        .join(',\n');
      
      return `z.object({\n${props}\n})`;
    }
    
    // Otherwise, convert inline
    return this.typeConverter.convertType(schema, [], '', true);
  }
}