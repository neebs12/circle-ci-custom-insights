import { TimeoutAnalysis, TreeNode } from '../types';

function hasAnsiCodes(str: string): boolean {
  return str.includes('\u001b[');
}

function findMatchingUnprocessedLine(processedLine: string, unprocessedLines: string[]): string | undefined {
  // Find the unprocessed line that, when stripped of ANSI codes, matches the processed line
  return unprocessedLines.find(unprocessed => 
    unprocessed.replace(/\u001b\[\d+m/g, '') === processedLine
  );
}

function createNode(count: number, isTest?: boolean): TreeNode {
  const node: TreeNode = { count };
  if (isTest) {
    node.is_test = true;
  }
  return node;
}

export function buildTree(entries: TimeoutAnalysis[]): { [key: string]: TreeNode } {
  const tree: { [key: string]: TreeNode } = {};

  for (const entry of entries) {
    const classification = entry.classification;
    const unprocessedClassification = entry.unprocessed_classification;
    if (classification.length === 0) continue;

    // First element is always the head node
    const headNode = classification[0];
    if (!tree[headNode]) {
      tree[headNode] = createNode(0);
    }
    tree[headNode].count++;

    // Rest of the elements are branches under that head
    let currentNode = tree[headNode];
    for (let i = 1; i < classification.length; i++) {
      const processedLine = classification[i];
      const matchingUnprocessedLine = findMatchingUnprocessedLine(processedLine, unprocessedClassification);
      const isTest = Boolean(matchingUnprocessedLine && hasAnsiCodes(matchingUnprocessedLine));

      if (!currentNode.children) {
        currentNode.children = {};
      }

      if (!currentNode.children[processedLine]) {
        currentNode.children[processedLine] = createNode(0, isTest);
      }
      currentNode.children[processedLine].count++;
      currentNode = currentNode.children[processedLine];
    }
  }

  // Clean up the tree by removing empty children objects
  function cleanupNode(node: TreeNode): void {
    if (!node.children) return;

    // Process all children first
    for (const child of Object.values(node.children)) {
      cleanupNode(child);
    }

    // Only remove children if it's an empty object
    if (Object.keys(node.children).length === 0) {
      node.children = undefined;
    }
  }

  // Clean up each top-level node
  for (const node of Object.values(tree)) {
    cleanupNode(node);
  }

  return tree;
}
