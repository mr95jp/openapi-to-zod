import fs from 'fs';
import path from 'path';
import { ZodSchemaGenerator } from './generator.js';
import { parseArgs } from './cli.js';
import { OpenAPIDocument } from './types.js';

async function main(): Promise<void> {
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
    const openApiDoc: OpenAPIDocument = JSON.parse(documentContent);
    
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
    const dirCount = new Set<string>();
    
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
    console.log(`   - Operation endpoints: ${files.filter(f => f.dirName && f.dirName !== '_components').length}`);
    console.log(`   - Component schemas: ${files.filter(f => f.dirName === '_components').length}`);
    console.log(`   - Total directories: ${dirCount.size}`);
    
    // Show sample operation directories
    const sampleOps = files
      .filter(f => f.dirName && f.dirName !== '_components')
      .slice(0, 5)
      .map(f => `${options.output}/${f.dirName}/`);
    if (sampleOps.length > 0) {
      console.log(`   - Sample operations: ${sampleOps.join(', ')}`);
    }
  } catch (error) {
    console.error('Error generating schemas:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

main();