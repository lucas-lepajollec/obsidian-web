import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  VaultError,
  buildGraphData,
  buildVaultTree,
  deleteVaultItem,
  normalizeVaultPath,
  readVaultFile,
  renameVaultItem,
  writeVaultFile,
} from '@/lib/vault';

let vaultRoot = '';

beforeEach(async () => {
  vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'shardnote-test-'));
  process.env.NOTES_PATH = vaultRoot;
});

afterEach(async () => {
  delete process.env.NOTES_PATH;
  if (vaultRoot) await fs.rm(vaultRoot, { recursive: true, force: true });
});

describe('vault path safety', () => {
  it('rejects traversal, absolute paths, and internal storage', () => {
    expect(() => normalizeVaultPath('../outside.md')).toThrow(VaultError);
    expect(() => normalizeVaultPath('C:\\outside.md')).toThrow(VaultError);
    expect(() => normalizeVaultPath('.shardnote/trash/item.md')).toThrow(VaultError);
  });
});

describe('safe note lifecycle', () => {
  it('writes, reads, backs up, and detects conflicts', async () => {
    const first = await writeVaultFile('Guides/Welcome', '# First');
    const loaded = await readVaultFile('Guides/Welcome.md');
    expect(loaded.content).toBe('# First');

    const second = await writeVaultFile('Guides/Welcome.md', '# Second', first.mtimeMs);
    expect(second.created).toBe(false);
    await expect(writeVaultFile('Guides/Welcome.md', '# Stale', first.mtimeMs)).rejects.toMatchObject({ code: 'EDIT_CONFLICT' });

    const backupDirectory = path.join(vaultRoot, '.shardnote', 'backups', 'Guides', 'Welcome.md');
    expect((await fs.readdir(backupDirectory)).length).toBeGreaterThan(0);
  });

  it('moves deleted content to the recoverable trash', async () => {
    await writeVaultFile('Draft.md', 'recover me');
    const result = await deleteVaultItem('Draft.md');
    await expect(fs.access(path.join(vaultRoot, result.trashPath))).resolves.toBeUndefined();
    await expect(fs.access(path.join(vaultRoot, 'Draft.md'))).rejects.toBeDefined();
  });

  it('renames notes without overwriting an existing destination', async () => {
    await writeVaultFile('One.md', 'one');
    await writeVaultFile('Two.md', 'two');
    await expect(renameVaultItem('One.md', 'Two.md')).rejects.toMatchObject({ code: 'DESTINATION_EXISTS' });
    await renameVaultItem('One.md', 'Folder/Renamed.md');
    expect((await buildVaultTree())[0].type).toBe('directory');
  });
});

describe('vault graph modes', () => {
  it('separates internal links from the folder hierarchy', async () => {
    await writeVaultFile('Guides/Intro.md', '# Intro\n\n[[Deep/Details]]\n\n#reference');
    await writeVaultFile('Guides/Deep/Details.md', '# Details');
    await writeVaultFile('Loose.md', '# Loose');

    const graph = await buildGraphData();
    expect(graph.links.nodes.every(node => node.group === 'note')).toBe(true);
    expect(graph.links.nodes.some(node => node.label === '#reference')).toBe(false);

    const intro = graph.links.nodes.find(node => node.title === 'Guides/Intro');
    const details = graph.links.nodes.find(node => node.title === 'Guides/Deep/Details');
    expect(graph.links.edges).toContainEqual({ from: intro?.id, to: details?.id });

    expect(graph.folders.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Coffre', group: 'root' }),
      expect.objectContaining({ title: 'Guides', group: 'folder' }),
      expect.objectContaining({ title: 'Guides/Deep', group: 'folder' }),
      expect.objectContaining({ title: 'Guides/Deep/Details', group: 'note' }),
    ]));
  });
});
