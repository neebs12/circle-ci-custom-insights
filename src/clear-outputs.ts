import fs from 'fs/promises';
import path from 'path';

async function clearOutputs() {
  try {
    const outputsDir = path.join(process.cwd(), 'outputs');
    
    // Check if outputs directory exists
    try {
      await fs.access(outputsDir);
    } catch {
      console.log('Outputs directory does not exist. Nothing to clear.');
      return;
    }

    // Read all contents of the outputs directory
    const contents = await fs.readdir(outputsDir, { withFileTypes: true });

    // Delete all files and subdirectories
    for (const item of contents) {
      const fullPath = path.join(outputsDir, item.name);
      
      if (item.isDirectory()) {
        // If it's a directory (like 'jobs'), remove it recursively
        await fs.rm(fullPath, { recursive: true });
      } else {
        // If it's a file, remove it
        await fs.unlink(fullPath);
      }
    }

    console.log('Successfully cleared outputs directory.');
  } catch (error) {
    console.error('Error clearing outputs directory:', error);
    process.exit(1);
  }
}

// Execute the clear function
clearOutputs();
