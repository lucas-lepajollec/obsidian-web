import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Stats } from 'node:fs';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
}

export interface GraphNode {
  id: number;
  label: string;
  title: string;
  group: 'note' | 'folder' | 'root';
  value?: number;
}

export interface GraphEdge { from: number; to: number }
export interface GraphDataset { nodes: GraphNode[]; edges: GraphEdge[] }
export interface GraphData { links: GraphDataset; folders: GraphDataset }
export interface SearchResult { filePath: string; fileName: string; matches: string[] }
export interface VaultFile { content: string; mtimeMs: number; path: string }
export interface WriteResult { path: string; mtimeMs: number; created: boolean }
export interface DeleteResult { trashPath: string }
export interface VaultAsset { data: Buffer; mimeType: string; mtimeMs: number }

const INTERNAL_DIRECTORY = '.shardnote';
const IGNORED_FOLDERS = new Set(['.git', '.obsidian', 'node_modules', '.next', '.trash', '.Trash', INTERNAL_DIRECTORY]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_VAULT_FILES = 5_000;
const MAX_SEARCH_RESULTS = 100;
const MAX_SEARCH_QUERY = 200;

export class VaultError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

export function getVaultRoot(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.NOTES_PATH || './vault');
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

export function normalizeVaultPath(input: string, appendMarkdown = false): string {
  if (typeof input !== 'string' || !input.trim() || input.length > 1024 || input.includes('\0')) {
    throw new VaultError('Invalid vault path.', 'INVALID_PATH');
  }

  const forward = input.trim().replace(/\\/g, '/');
  if (forward.startsWith('/') || /^[a-zA-Z]:/.test(forward)) {
    throw new VaultError('Absolute paths are not allowed.', 'INVALID_PATH');
  }

  const normalized = path.posix.normalize(forward).replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new VaultError('Path escapes the vault.', 'PATH_TRAVERSAL', 403);
  }
  if (normalized.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new VaultError('Invalid vault path.', 'INVALID_PATH');
  }
  if (normalized === INTERNAL_DIRECTORY || normalized.startsWith(`${INTERNAL_DIRECTORY}/`)) {
    throw new VaultError('Internal ShardNote data is protected.', 'PROTECTED_PATH', 403);
  }

  if (appendMarkdown && !normalized.toLowerCase().endsWith('.md')) return `${normalized}.md`;
  return normalized;
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function ensureVaultRoot(): Promise<string> {
  const root = getVaultRoot();
  await fs.mkdir(root, { recursive: true });
  return fs.realpath(root);
}

async function rejectSymlinkSegments(root: string, target: string): Promise<void> {
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stats = await fs.lstat(current);
      if (stats.isSymbolicLink()) {
        throw new VaultError('Symbolic links are not supported inside the vault.', 'SYMLINK_REJECTED', 403);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

async function resolveTarget(relativePath: string, appendMarkdown = false): Promise<{ root: string; relativePath: string; fullPath: string }> {
  const normalized = normalizeVaultPath(relativePath, appendMarkdown);
  const root = await ensureVaultRoot();
  const fullPath = path.resolve(root, ...normalized.split('/'));
  if (!isInside(root, fullPath)) {
    throw new VaultError('Path escapes the vault.', 'PATH_TRAVERSAL', 403);
  }
  await rejectSymlinkSegments(root, fullPath);
  return { root, relativePath: normalized, fullPath };
}

async function assertRegularMarkdownFile(fullPath: string): Promise<Stats> {
  const stats = await fs.stat(fullPath);
  if (!stats.isFile() || path.extname(fullPath).toLowerCase() !== '.md') {
    throw new VaultError('Only Markdown files are supported.', 'UNSUPPORTED_FILE', 415);
  }
  if (stats.size > MAX_FILE_BYTES) {
    throw new VaultError('This note exceeds the 5 MB safety limit.', 'FILE_TOO_LARGE', 413);
  }
  return stats;
}

async function listMarkdownFiles(rootOverride?: string): Promise<Array<{ name: string; relPath: string; fullPath: string }>> {
  const root = rootOverride ?? await ensureVaultRoot();
  const result: Array<{ name: string; relPath: string; fullPath: string }> = [];

  async function visit(currentDir: string, relativeDir: string): Promise<void> {
    const items = await fs.readdir(currentDir, { withFileTypes: true });
    items.sort((a, b) => a.name.localeCompare(b.name, 'en'));

    for (const item of items) {
      if (IGNORED_FOLDERS.has(item.name) || item.name.startsWith('.') || item.isSymbolicLink()) continue;
      const fullPath = path.join(currentDir, item.name);
      const relPath = relativeDir ? `${relativeDir}/${item.name}` : item.name;
      if (item.isDirectory()) {
        await visit(fullPath, relPath);
      } else if (item.isFile() && item.name.toLowerCase().endsWith('.md')) {
        result.push({ name: item.name, relPath, fullPath });
        if (result.length > MAX_VAULT_FILES) {
          throw new VaultError(`Vault exceeds the ${MAX_VAULT_FILES} file safety limit.`, 'VAULT_TOO_LARGE', 413);
        }
      }
    }
  }

  await visit(root, '');
  return result;
}

export async function buildVaultTree(): Promise<FileNode[]> {
  const root = await ensureVaultRoot();
  let count = 0;

  async function visit(currentDir: string, relativeDir: string): Promise<FileNode[]> {
    const items = await fs.readdir(currentDir, { withFileTypes: true });
    items.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name, 'en');
    });

    const tree: FileNode[] = [];
    for (const item of items) {
      if (IGNORED_FOLDERS.has(item.name) || item.name.startsWith('.') || item.isSymbolicLink()) continue;
      const fullPath = path.join(currentDir, item.name);
      const relPath = relativeDir ? `${relativeDir}/${item.name}` : item.name;
      if (item.isDirectory()) {
        tree.push({ name: item.name, path: relPath, type: 'directory', children: await visit(fullPath, relPath) });
      } else if (item.isFile() && item.name.toLowerCase().endsWith('.md')) {
        count += 1;
        if (count > MAX_VAULT_FILES) throw new VaultError('Vault is too large to index safely.', 'VAULT_TOO_LARGE', 413);
        tree.push({ name: item.name.replace(/\.md$/i, ''), path: relPath, type: 'file', extension: '.md' });
      }
    }
    return tree;
  }

  return visit(root, '');
}

export async function readVaultFile(relativePath: string): Promise<VaultFile> {
  let target = await resolveTarget(relativePath);
  try {
    await fs.access(target.fullPath);
  } catch {
    target = await resolveTarget(relativePath, true);
  }

  const stats = await assertRegularMarkdownFile(target.fullPath);
  return {
    content: await fs.readFile(target.fullPath, 'utf8'),
    mtimeMs: Number(stats.mtimeMs),
    path: target.relativePath,
  };
}

const ASSET_MIME_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
]);

export async function readVaultAsset(relativePath: string): Promise<VaultAsset> {
  const target = await resolveTarget(relativePath);
  const mimeType = ASSET_MIME_TYPES.get(path.extname(target.fullPath).toLowerCase());
  if (!mimeType) throw new VaultError('Unsupported attachment type.', 'UNSUPPORTED_FILE', 415);
  const stats = await fs.stat(target.fullPath);
  if (!stats.isFile()) throw new VaultError('Attachment not found.', 'NOT_FOUND', 404);
  if (stats.size > MAX_ASSET_BYTES) throw new VaultError('Attachment exceeds 10 MB.', 'FILE_TOO_LARGE', 413);
  return { data: await fs.readFile(target.fullPath), mimeType, mtimeMs: Number(stats.mtimeMs) };
}

async function createBackup(root: string, relativePath: string, fullPath: string): Promise<void> {
  const backupPath = path.join(
    root,
    INTERNAL_DIRECTORY,
    'backups',
    ...relativePath.split('/'),
    `${new Date().toISOString().replace(/[:.]/g, '-')}.bak`,
  );
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.copyFile(fullPath, backupPath);
}

export async function writeVaultFile(relativePath: string, content: string, expectedMtimeMs?: number): Promise<WriteResult> {
  if (typeof content !== 'string') throw new VaultError('Content must be text.', 'INVALID_CONTENT');
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
    throw new VaultError('This note exceeds the 5 MB safety limit.', 'FILE_TOO_LARGE', 413);
  }

  const target = await resolveTarget(relativePath, true);
  await fs.mkdir(path.dirname(target.fullPath), { recursive: true });
  await rejectSymlinkSegments(target.root, target.fullPath);

  let created = true;
  try {
    const currentStats = await assertRegularMarkdownFile(target.fullPath);
    created = false;
    if (typeof expectedMtimeMs === 'number' && Math.abs(Number(currentStats.mtimeMs) - expectedMtimeMs) > 1) {
      throw new VaultError('The note changed on disk. Reload it before saving.', 'EDIT_CONFLICT', 409);
    }
    await createBackup(target.root, target.relativePath, target.fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const temporaryPath = `${target.fullPath}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temporaryPath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await fs.rename(temporaryPath, target.fullPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }

  const stats = await fs.stat(target.fullPath);
  return { path: target.relativePath, mtimeMs: Number(stats.mtimeMs), created };
}

export async function searchVault(query: string): Promise<SearchResult[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  if (normalizedQuery.length > MAX_SEARCH_QUERY) throw new VaultError('Search query is too long.', 'QUERY_TOO_LONG');

  const results: SearchResult[] = [];
  for (const file of await listMarkdownFiles()) {
    if (results.length >= MAX_SEARCH_RESULTS) break;
    try {
      const stats = await fs.stat(file.fullPath);
      if (stats.size > MAX_FILE_BYTES) continue;
      const lines = (await fs.readFile(file.fullPath, 'utf8')).split('\n');
      const matches = lines.filter(line => line.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 5).map(line => line.trim());
      if (matches.length) results.push({ filePath: file.relPath, fileName: file.name.replace(/\.md$/i, ''), matches });
    } catch {
      // A note can disappear between indexing and reading. Skip it safely.
    }
  }
  return results;
}

export async function buildGraphData(): Promise<GraphData> {
  const files = await listMarkdownFiles();
  const linkNodes: GraphNode[] = [];
  const linkEdges: GraphEdge[] = [];
  const fullPathIds = new Map<string, number>();
  const basenameIds = new Map<string, number[]>();

  files.forEach((file, id) => {
    const title = file.relPath.replace(/\.md$/i, '');
    const basename = file.name.replace(/\.md$/i, '');
    linkNodes.push({ id, label: basename, title, group: 'note' });
    fullPathIds.set(title, id);
    basenameIds.set(basename, [...(basenameIds.get(basename) ?? []), id]);
  });

  const edgeKeys = new Set<string>();
  const connect = (left: number, right: number) => {
    if (left === right) return;
    const key = left < right ? `${left}:${right}` : `${right}:${left}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      linkEdges.push({ from: left, to: right });
    }
  };

  for (let sourceId = 0; sourceId < files.length; sourceId += 1) {
    const file = files[sourceId];
    try {
      const stats = await fs.stat(file.fullPath);
      if (stats.size > MAX_FILE_BYTES) continue;
      const content = await fs.readFile(file.fullPath, 'utf8');
      for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
        const target = match[1].split('|')[0].split('#')[0].trim().replace(/\.md$/i, '');
        const exactId = fullPathIds.get(target);
        const basenameMatches = basenameIds.get(path.posix.basename(target)) ?? [];
        const targetId = exactId ?? (basenameMatches.length === 1 ? basenameMatches[0] : undefined);
        if (targetId !== undefined) connect(sourceId, targetId);
      }
    } catch {
      // Ignore notes that become unavailable while the graph is built.
    }
  }

  for (const edge of linkEdges) {
    linkNodes[edge.from].value = (linkNodes[edge.from].value ?? 0) + 1;
    linkNodes[edge.to].value = (linkNodes[edge.to].value ?? 0) + 1;
  }

  const folderNodes: GraphNode[] = [{ id: 0, label: 'Coffre', title: '', group: 'root', value: 1 }];
  const folderEdges: GraphEdge[] = [];
  const folderIds = new Map<string, number>([['', 0]]);
  let nextFolderId = 1;

  const ensureFolder = (folderPath: string): number => {
    const existingId = folderIds.get(folderPath);
    if (existingId !== undefined) return existingId;

    const parts = folderPath.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    const parentId = ensureFolder(parentPath);
    const id = nextFolderId++;
    folderIds.set(folderPath, id);
    folderNodes.push({ id, label: parts.at(-1) ?? folderPath, title: folderPath, group: 'folder', value: 1 });
    folderEdges.push({ from: parentId, to: id });
    return id;
  };

  for (const file of files) {
    const title = file.relPath.replace(/\.md$/i, '');
    const parts = title.split('/');
    const parentId = ensureFolder(parts.slice(0, -1).join('/'));
    const id = nextFolderId++;
    folderNodes.push({ id, label: parts.at(-1) ?? title, title, group: 'note', value: 1 });
    folderEdges.push({ from: parentId, to: id });
  }

  for (const edge of folderEdges) {
    folderNodes[edge.from].value = (folderNodes[edge.from].value ?? 0) + 1;
    folderNodes[edge.to].value = (folderNodes[edge.to].value ?? 0) + 1;
  }

  return {
    links: { nodes: linkNodes, edges: linkEdges },
    folders: { nodes: folderNodes, edges: folderEdges },
  };
}

export function getFileStats(content: string): { words: number; chars: number } {
  const text = content.replace(/^---[\s\S]*?---/m, '').trim();
  return { words: text.split(/\s+/).filter(Boolean).length, chars: text.length };
}

export async function deleteVaultItem(relativePath: string): Promise<DeleteResult> {
  const target = await resolveTarget(relativePath);
  await fs.lstat(target.fullPath);
  const trashRelative = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}/${target.relativePath}`;
  const trashPath = path.join(target.root, INTERNAL_DIRECTORY, 'trash', ...trashRelative.split('/'));
  await fs.mkdir(path.dirname(trashPath), { recursive: true });
  await fs.rename(target.fullPath, trashPath);
  return { trashPath: toPosix(path.relative(target.root, trashPath)) };
}

export async function renameVaultItem(oldRelativePath: string, newRelativePath: string): Promise<{ path: string }> {
  const source = await resolveTarget(oldRelativePath);
  const destination = await resolveTarget(newRelativePath);
  await fs.lstat(source.fullPath);
  try {
    await fs.access(destination.fullPath);
    throw new VaultError('Destination already exists.', 'DESTINATION_EXISTS', 409);
  } catch (error) {
    if (error instanceof VaultError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await fs.mkdir(path.dirname(destination.fullPath), { recursive: true });
  await rejectSymlinkSegments(destination.root, destination.fullPath);
  await fs.rename(source.fullPath, destination.fullPath);
  return { path: destination.relativePath };
}

export async function createVaultFolder(relativePath: string): Promise<{ path: string }> {
  const target = await resolveTarget(relativePath);
  try {
    await fs.mkdir(target.fullPath, { recursive: false, mode: 0o700 });
    return { path: target.relativePath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new VaultError('Folder already exists.', 'DESTINATION_EXISTS', 409);
    }
    throw error;
  }
}
