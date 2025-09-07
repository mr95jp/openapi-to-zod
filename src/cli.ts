import { CLIOptions } from './types.js';

export function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
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