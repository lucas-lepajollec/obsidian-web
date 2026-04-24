import fs from 'fs';
import path from 'path';

export interface FileNode {
  name: string;
  path: string; // relative to vault root, always uses /
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
}

export interface GraphNode {
  id: number;
  label: string;
  title: string; // relative path without .md
  group?: string; // 'tag' for tag nodes
  value?: number; // connection count
}

export interface GraphEdge {
  from: number;
  to: number;
}

export interface SearchResult {
  filePath: string;
  fileName: string;
  matches: string[];
}

const IGNORED_FOLDERS = ['.git', '.obsidian', 'node_modules', '.next', '.trash', '.Trash'];

export function getVaultRoot(): string {
  const notesPath = process.env.NOTES_PATH || './vault';
  return path.resolve(process.cwd(), notesPath);
}

// ─── TREE ───────────────────────────────────────────────
export function buildVaultTree(currentDir: string = getVaultRoot(), relativeDir: string = ''): FileNode[] {
  const tree: FileNode[] = [];
  if (!fs.existsSync(currentDir)) return tree;

  const items = fs.readdirSync(currentDir, { withFileTypes: true });
  // Directories first, then files, alphabetically
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name, 'fr');
  });

  for (const item of items) {
    if (IGNORED_FOLDERS.includes(item.name) || item.name.startsWith('.')) continue;
    const fullPath = path.join(currentDir, item.name);
    const relPath = relativeDir ? `${relativeDir}/${item.name}` : item.name;

    if (item.isDirectory()) {
      tree.push({
        name: item.name,
        path: relPath,
        type: 'directory',
        children: buildVaultTree(fullPath, relPath),
      });
    } else if (item.name.endsWith('.md')) {
      tree.push({
        name: item.name.replace(/\.md$/, ''),
        path: relPath,
        type: 'file',
        extension: '.md',
      });
    }
  }
  return tree;
}

// ─── READ FILE ──────────────────────────────────────────
export function readVaultFile(relativePath: string): string | null {
  const root = getVaultRoot();
  let fullPath = path.join(root, relativePath);

  // Security: prevent path traversal
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(root))) return null;

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fs.readFileSync(fullPath, 'utf-8');
  }
  // Auto-append .md
  const mdPath = fullPath + '.md';
  if (fs.existsSync(mdPath) && fs.statSync(mdPath).isFile()) {
    return fs.readFileSync(mdPath, 'utf-8');
  }
  return null;
}

// ─── WRITE FILE ─────────────────────────────────────────
export function writeVaultFile(relativePath: string, content: string): boolean {
  const root = getVaultRoot();
  let fullPath = path.join(root, relativePath);
  if (!fullPath.endsWith('.md')) fullPath += '.md';

  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(root))) return false;

  try {
    // Create parent dir if it doesn't exist
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

// ─── SEARCH ─────────────────────────────────────────────
export function searchVault(query: string, currentDir: string = getVaultRoot(), relativeDir: string = ''): SearchResult[] {
  const results: SearchResult[] = [];
  if (!query || !fs.existsSync(currentDir)) return results;

  const items = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const item of items) {
    if (IGNORED_FOLDERS.includes(item.name) || item.name.startsWith('.')) continue;
    const fullPath = path.join(currentDir, item.name);
    const relPath = relativeDir ? `${relativeDir}/${item.name}` : item.name;

    if (item.isDirectory()) {
      results.push(...searchVault(query, fullPath, relPath));
    } else if (item.name.endsWith('.md')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const matchingLines: string[] = [];
        const lowerQuery = query.toLowerCase();

        for (const line of lines) {
          if (line.toLowerCase().includes(lowerQuery)) {
            matchingLines.push(line.trim());
          }
        }

        if (matchingLines.length > 0) {
          results.push({
            filePath: relPath,
            fileName: item.name.replace(/\.md$/, ''),
            matches: matchingLines.slice(0, 5), // limit to 5 matches per file
          });
        }
      } catch { /* skip unreadable files */ }
    }
  }
  return results;
}

// ─── GRAPH DATA ─────────────────────────────────────────
export function buildGraphData(currentDir: string = getVaultRoot(), relativeDir: string = ''): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const allFiles = collectAllMdFiles(currentDir, relativeDir);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const pathToId: Record<string, number> = {};
  let nodeId = 0;

  // Create nodes for each file
  for (const file of allFiles) {
    const id = nodeId++;
    const displayName = file.name.replace(/\.md$/, '');
    const relPathNoExt = file.relPath.replace(/\.md$/, '');
    nodes.push({ id, label: displayName, title: relPathNoExt });
    pathToId[relPathNoExt] = id;
    pathToId[displayName] = id; // Also index by just filename for wikilink resolution
  }

  // Parse wikilinks and create edges
  for (const file of allFiles) {
    const relPathNoExt = file.relPath.replace(/\.md$/, '');
    const sourceId = pathToId[relPathNoExt];
    if (sourceId === undefined) continue;

    try {
      const content = fs.readFileSync(file.fullPath, 'utf-8');

      // Extract [[wikilinks]]
      const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
      for (const link of wikilinks) {
        const target = link.slice(2, -2).split('|')[0].split('#')[0].trim();
        const targetId = pathToId[target];
        if (targetId !== undefined && targetId !== sourceId) {
          // avoid duplicate edges
          const exists = edges.some(e =>
            (e.from === sourceId && e.to === targetId) ||
            (e.from === targetId && e.to === sourceId)
          );
          if (!exists) edges.push({ from: sourceId, to: targetId });
        }
      }

      // Extract #tags → create tag nodes
      const tags = content.match(/(?:^|\s)#([a-zA-Z0-9_\u00C0-\u024F]+)/g) || [];
      for (const rawTag of tags) {
        const tag = '#' + rawTag.trim().replace(/^#/, '');
        if (!pathToId[tag]) {
          const tagId = nodeId++;
          nodes.push({ id: tagId, label: tag, title: tag, group: 'tag' });
          pathToId[tag] = tagId;
        }
        const tagId = pathToId[tag];
        const exists = edges.some(e =>
          (e.from === sourceId && e.to === tagId) ||
          (e.from === tagId && e.to === sourceId)
        );
        if (!exists) edges.push({ from: sourceId, to: tagId });
      }
    } catch { /* skip */ }
  }

  // Calculate node values (connection count)
  for (const edge of edges) {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    if (fromNode) fromNode.value = (fromNode.value || 0) + 1;
    if (toNode) toNode.value = (toNode.value || 0) + 1;
  }

  return { nodes, edges };
}

function collectAllMdFiles(currentDir: string, relativeDir: string): { name: string; relPath: string; fullPath: string }[] {
  const result: { name: string; relPath: string; fullPath: string }[] = [];
  if (!fs.existsSync(currentDir)) return result;

  const items = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const item of items) {
    if (IGNORED_FOLDERS.includes(item.name) || item.name.startsWith('.')) continue;
    const fullPath = path.join(currentDir, item.name);
    const relPath = relativeDir ? `${relativeDir}/${item.name}` : item.name;

    if (item.isDirectory()) {
      result.push(...collectAllMdFiles(fullPath, relPath));
    } else if (item.name.endsWith('.md')) {
      result.push({ name: item.name, relPath, fullPath });
    }
  }
  return result;
}

// ─── COUNT FILE STATS ───────────────────────────────────
export function getFileStats(content: string): { words: number; chars: number } {
  const text = content.replace(/^---[\s\S]*?---/m, '').trim();
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const chars = text.length;
  return { words, chars };
}

// ─── EXTENDED OPERATIONS ─────────────────────────────────

export function deleteVaultItem(relativePath: string): boolean {
  const root = getVaultRoot();
  const fullPath = path.join(root, relativePath);
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(root))) return false;

  try {
    if (fs.existsSync(fullPath)) {
      if (fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function renameVaultItem(oldRelativePath: string, newRelativePath: string): boolean {
  const root = getVaultRoot();
  const oldPath = path.resolve(path.join(root, oldRelativePath));
  const newPath = path.resolve(path.join(root, newRelativePath));

  if (!oldPath.startsWith(path.resolve(root)) || !newPath.startsWith(path.resolve(root))) return false;

  try {
    if (fs.existsSync(oldPath)) {
      const newDir = path.dirname(newPath);
      if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
      fs.renameSync(oldPath, newPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function createVaultFolder(relativePath: string): boolean {
  const root = getVaultRoot();
  const fullPath = path.resolve(path.join(root, relativePath));

  if (!fullPath.startsWith(path.resolve(root))) return false;

  try {
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
