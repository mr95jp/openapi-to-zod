export interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
  };
}

export interface PathItem {
  [method: string]: Operation | unknown;
}

export interface Operation {
  operationId?: string;
  summary?: string;
  requestBody?: {
    content?: {
      'application/json'?: {
        schema?: Schema;
      };
    };
  };
  responses?: Record<string, Response>;
}

export interface Response {
  description?: string;
  content?: {
    'application/json'?: {
      schema?: Schema;
    };
  };
}

export interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  $ref?: string;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  enum?: string[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  description?: string;
  additionalProperties?: boolean | Schema;
}

export interface GeneratedFile {
  dirName?: string;
  fileName: string;
  content: string;
}

export interface OperationSchema {
  operationId: string;
  summary: string;
  method: string;
  path: string;
  request: Schema | null;
  responses: Record<string, {
    description: string;
    schema: Schema;
  }>;
}

export interface CLIOptions {
  file: string;
  output: string;
}