import { TimeoutAnalysis, TreeNode } from '../types';

export function buildTree(entries: TimeoutAnalysis[]): { [key: string]: TreeNode } {
  const tree: { [key: string]: TreeNode } = {};

  for (const entry of entries) {
    const classification = entry.classification;
    if (classification.length === 0) continue;

    // First element is always the head node
    const headNode = classification[0];
    if (!tree[headNode]) {
      tree[headNode] = { count: 0, children: {} };
    }
    tree[headNode].count++;

    // Rest of the elements are branches under that head
    let currentNode = tree[headNode].children;
    for (let i = 1; i < classification.length; i++) {
      const branch = classification[i];
      if (!currentNode[branch]) {
        currentNode[branch] = { count: 0, children: {} };
      }
      currentNode[branch].count++;
      currentNode = currentNode[branch].children;
    }
  }

  return tree;
}
