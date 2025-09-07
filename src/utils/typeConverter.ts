import { Schema } from '../types.js';

export class TypeConverter {
  private schemas: Record<string, Schema>;
  private dependencies = new Map<string, Set<string>>();

  constructor(schemas: Record<string, Schema>) {
    this.schemas = schemas;
  }

  convertType(
    property: Schema | undefined,
    currentPath: string[] = [],
    schemaName = '',
    isInline = false
  ): string {
    if (!property) return 'z.unknown()';
    
    if (property.$ref) {
      const refName = property.$ref.split('/').pop()!;
      // Track dependency
      if (schemaName && refName && !isInline) {
        if (!this.dependencies.has(schemaName)) {
          this.dependencies.set(schemaName, new Set());
        }
        this.dependencies.get(schemaName)!.add(refName);
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

  private convertString(property: Schema): string {
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

  private convertNumber(property: Schema, type: string): string {
    let zodNumber = type === 'integer' ? 'z.number().int()' : 'z.number()';
    
    if (property.minimum !== undefined) {
      zodNumber += `.min(${property.minimum})`;
    }
    if (property.maximum !== undefined) {
      zodNumber += `.max(${property.maximum})`;
    }
    
    return zodNumber;
  }

  private convertArray(
    property: Schema,
    currentPath: string[],
    schemaName: string,
    isInline: boolean
  ): string {
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

  private convertObject(
    property: Schema,
    currentPath: string[],
    schemaName: string,
    isInline: boolean
  ): string {
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
      } else if (property.additionalProperties && typeof property.additionalProperties === 'object') {
        const additionalSchema = this.convertType(property.additionalProperties, currentPath, schemaName, isInline);
        zodObject += `.catchall(${additionalSchema})`;
      }
      
      return zodObject;
    }
    return 'z.record(z.unknown())';
  }

  getDependencies(schemaName: string): Set<string> {
    return this.dependencies.get(schemaName) || new Set();
  }
}