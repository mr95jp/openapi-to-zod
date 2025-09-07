# Zod Schema Generator

A TypeScript-based tool that automatically generates Zod schemas from OpenAPI 3.1.0 JSON documents. This tool creates well-organized, type-safe validation schemas for your API endpoints.

## ✨ Features

- 🚀 **TypeScript First**: Built with TypeScript for type safety and better development experience
- 📁 **Organized Structure**: Generates schemas organized by operationId with separate component schemas
- 🔧 **CLI Support**: Command-line interface with customizable options
- 🔄 **Circular Reference Handling**: Automatically handles circular references using `z.lazy()`
- 📝 **JSDoc Comments**: Generates comprehensive JSDoc documentation from OpenAPI descriptions
- 🎯 **Smart Type Conversion**: Converts OpenAPI types to appropriate Zod validators with constraints
- 📦 **Modular Architecture**: Clean, maintainable codebase with separated concerns

## 🛠️ Installation

```bash
git clone https://github.com/yourusername/zod-schema-generator.git
cd zod-schema-generator
npm install
```

## 🚀 Usage

### Basic Usage

```bash
# Generate schemas from document.json to schema/ directory
npm run generateZod

# Specify custom input and output paths
npm run generateZod -- -file api.json -output generated-schemas
```

### Command Line Options

```bash
npm run generateZod -- [options]

Options:
  -file <path>     Path to OpenAPI JSON document (default: document.json)
  -output <path>   Output directory path (default: schema)
  -h, --help       Show help message
```

### Examples

```bash
# Default usage
npm run generateZod

# Custom file and output directory
npm run generateZod -- -file ./specs/api.json -output ./src/schemas

# Show help
npm run generateZod -- --help
```

## 📂 Generated Structure

The tool generates a well-organized directory structure:

```
schema/
├── _components/                    # Component schemas
│   ├── UserResource.ts
│   ├── CreateUserRequest.ts
│   └── ...
├── user.create/                    # Operation-specific schemas
│   └── schema.ts
├── user.update/
│   └── schema.ts
└── ...
```

### Component Schemas (`_components/`)

Reusable schemas defined in OpenAPI `components/schemas`:

```typescript
/**
 * User resource representation
 *
 * @property {string} id - User ID
 * @property {string} name - User name
 * @property {string} email? - User email address
 */
export const UserResource = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional()
});
export type UserResourceType = z.infer<typeof UserResource>;
```

### Operation Schemas

Each API operation gets its own directory with request/response schemas:

```typescript
import { z } from 'zod';
import { CreateUserRequest } from '../_components/CreateUserRequest.js';
import { UserResource } from '../_components/UserResource.js';

/**
 * Create a new user
 * 
 * @operationId user.create
 * @method POST
 * @path /users
 */

/**
 * Request schema
 */
export const Request = CreateUserRequest;
export type RequestType = z.infer<typeof Request>;

/**
 * Response 201: User created successfully
 */
export const Response201 = z.object({
  data: UserResource
});
export type Response201Type = z.infer<typeof Response201>;
```

## 🎯 Supported OpenAPI Features

### Schema Types
- ✅ Primitive types (`string`, `number`, `integer`, `boolean`)
- ✅ Arrays with min/max items
- ✅ Objects with required/optional properties
- ✅ Enums
- ✅ References (`$ref`)
- ✅ Composition (`allOf`, `oneOf`, `anyOf`)
- ✅ Circular references (using `z.lazy()`)

### String Formats
- ✅ `date-time` → `.datetime()`
- ✅ `date` → `.date()`
- ✅ `email` → `.email()`
- ✅ `uuid` → `.uuid()`
- ✅ `uri`/`url` → `.url()`
- ✅ Custom patterns → `.regex()`

### Constraints
- ✅ String length (`minLength`, `maxLength`)
- ✅ Number ranges (`minimum`, `maximum`)
- ✅ Array size (`minItems`, `maxItems`)
- ✅ Object properties (`additionalProperties`)

## 🏗️ Development

### Build from Source

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode with watch
npm run dev
```

### Project Structure

```
src/
├── types.ts                       # Type definitions
├── cli.ts                         # CLI argument parsing
├── generator.ts                   # Main generator class
├── index.ts                       # Entry point
├── utils/
│   ├── typeConverter.ts          # Zod type conversion logic
│   └── helpers.ts                # Helper functions
└── generators/
    ├── componentGenerator.ts     # Component schema generation
    └── operationGenerator.ts     # Operation schema generation
```

## 📋 Requirements

- Node.js 16.0.0 or higher
- OpenAPI 3.1.0 JSON document
- TypeScript (for development)

## 🔧 Configuration

### TypeScript Configuration

The project uses modern TypeScript settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Package Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run generateZod` - Build and run the generator
- `npm run dev` - Run TypeScript compiler in watch mode

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/zod-schema-generator/issues) page
2. Create a new issue with detailed information about your problem
3. Include your OpenAPI document structure and expected output

## 🙏 Acknowledgments

- [Zod](https://github.com/colinhacks/zod) - TypeScript-first schema validation library
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0) - API documentation standard

---

Made with ❤️ by [Mr.95jp](https://github.com/mr95jp)