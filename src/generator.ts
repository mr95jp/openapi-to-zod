import { OpenAPIDocument, GeneratedFile } from './types.js';
import { ComponentGenerator } from './generators/componentGenerator.js';
import { OperationGenerator } from './generators/operationGenerator.js';

export class ZodSchemaGenerator {
  private openApiDoc: OpenAPIDocument;

  constructor(openApiDoc: OpenAPIDocument) {
    this.openApiDoc = openApiDoc;
  }

  generate(): GeneratedFile[] {
    const componentGenerator = new ComponentGenerator(this.openApiDoc.components?.schemas || {});
    const operationGenerator = new OperationGenerator(this.openApiDoc);
    
    const componentFiles = componentGenerator.generateComponentSchemas();
    const operationFiles = operationGenerator.generateOperationSchemas();
    
    return [...componentFiles, ...operationFiles];
  }
}