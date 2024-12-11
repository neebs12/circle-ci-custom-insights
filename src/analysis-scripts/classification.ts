import { ClassificationResult } from '../types';

function stripAnsiCodes(str: string): string {
  return str.replace(/\u001b\[\d+m/g, '');
}

function getLeadingSpaces(str: string): number {
  const match = str.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function processLine(line: string): string {
  // If line contains "Randomized with seed", remove the numbers
  if (line.includes("Randomized with seed")) {
    return line.replace(/Randomized with seed \d+/, 'Randomized with seed');
  }
  return line;
}

function processClassification(lines: string[]): string[] {
  if (lines.length === 0) return [];

  const result: string[] = [processLine(lines[0])]; // Process the first line

  // Process remaining lines
  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i];
    const currentSpaces = getLeadingSpaces(currentLine);

    // Check if there's any later line with >= 2 spaces AND <= current spaces
    let shouldRemove = false;
    for (let j = i + 1; j < lines.length; j++) {
      const laterSpaces = getLeadingSpaces(lines[j]);
      if (laterSpaces >= 2 && laterSpaces <= currentSpaces) {
        shouldRemove = true;
        break;
      }
    }

    // Keep the line only if we didn't find a reason to remove it
    if (!shouldRemove) {
      result.push(processLine(currentLine));
    }
  }

  return result;
}

export function createClassification(message: string): ClassificationResult {
  // Split the message by \r\n
  const lines = message.split('\r\n');

  // Work backwards through the array to find the first string that starts with a letter
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // Don't trim - check the actual first character after removing ANSI codes
    const cleanLine = stripAnsiCodes(line);
    if (cleanLine && /^[a-zA-Z]/.test(cleanLine)) {
      // Get the unprocessed array (with ANSI codes)
      const unprocessed = lines.slice(i).filter(line => line !== '');
      // Get the processed array (ANSI codes stripped and classification processed)
      const stripped = unprocessed.map(line => stripAnsiCodes(line));
      const processed = processClassification(stripped);

      return {
        unprocessed,
        processed
      };
    }
  }

  return {
    unprocessed: [],
    processed: []
  };
}

export function getSecondToLastMessage(outputs: any[]): string | null {
  if (outputs && outputs.length >= 2) {
    return outputs[outputs.length - 2].message;
  }
  return null;
}
