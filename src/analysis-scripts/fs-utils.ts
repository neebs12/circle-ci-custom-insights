import fs from 'fs/promises';
import path from 'path';

export async function ensureAnalysisDir(): Promise<string> {
  const analysisDir = path.join(process.cwd(), 'outputs', 'analysis');
  await fs.mkdir(analysisDir, { recursive: true });
  return analysisDir;
}

export async function clearAnalysisDir(analysisDir: string): Promise<void> {
  try {
    console.log('Clearing analysis directory...');
    const files = await fs.readdir(analysisDir);
    for (const file of files) {
      await fs.unlink(path.join(analysisDir, file));
    }
    console.log('Analysis directory cleared');
  } catch (error: any) {
    // If directory doesn't exist or is already empty, continue
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function logAnalysisError(message: string): Promise<void> {
  const analysisDir = await ensureAnalysisDir();
  const logPath = path.join(analysisDir, 'analysis.log');
  const timestamp = new Date().toISOString();
  await fs.appendFile(logPath, `${timestamp}: ${message}\n`);
}

export async function saveAnalysisResult(analysisDir: string, filename: string, data: any): Promise<void> {
  const filePath = path.join(analysisDir, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
