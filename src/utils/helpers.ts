import { Schema } from '../types.js';

export function generateDescription(name: string): string {
  // Generate human-readable description from schema name
  const words = name.match(/[A-Z][a-z]+|[A-Z]+(?=[A-Z])|[a-z]+/g) || [];
  const description = words.join(' ').toLowerCase();
  return description.charAt(0).toUpperCase() + description.slice(1);
}

export function getPropertyType(propSchema: Schema): string {
  if (propSchema.$ref) {
    return propSchema.$ref.split('/').pop()!;
  }
  if (propSchema.type === 'string') return 'string';
  if (propSchema.type === 'number') return 'number';
  if (propSchema.type === 'integer') return 'number';
  if (propSchema.type === 'boolean') return 'boolean';
  if (propSchema.type === 'array') {
    const itemType = propSchema.items ? getPropertyType(propSchema.items) : 'any';
    return `${itemType}[]`;
  }
  if (propSchema.type === 'object') return 'object';
  return 'any';
}

export function isComponentSchema(schema: Schema | undefined): boolean {
  // Check if a schema is defined in components/schemas
  if (!schema || !schema.$ref) return false;
  return schema.$ref.startsWith('#/components/schemas/');
}

export function findComponentReferences(schema: Schema | undefined, references: Set<string>): void {
  if (!schema) return;
  
  if (isComponentSchema(schema)) {
    const refName = schema.$ref!.split('/').pop()!;
    references.add(refName);
    // Don't recurse into component schemas
    return;
  }
  
  if (schema.allOf) {
    schema.allOf.forEach(s => findComponentReferences(s, references));
  }
  
  if (schema.oneOf) {
    schema.oneOf.forEach(s => findComponentReferences(s, references));
  }
  
  if (schema.anyOf) {
    schema.anyOf.forEach(s => findComponentReferences(s, references));
  }
  
  if (schema.properties) {
    Object.values(schema.properties).forEach(prop => {
      findComponentReferences(prop, references);
    });
  }
  
  if (schema.items) {
    findComponentReferences(schema.items, references);
  }
}