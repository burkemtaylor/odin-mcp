import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { DocSection } from './parse.js';

export interface IndexMeta {
  lastCommitSha: string;
  lastIndexedAt: string;
}

export async function readMeta(dataDir: string): Promise<IndexMeta | null> {
  try {
    const raw = await readFile(join(dataDir, 'meta.json'), 'utf-8');
    return JSON.parse(raw) as IndexMeta;
  } catch {
    return null;
  }
}

export async function writeMeta(dataDir: string, meta: IndexMeta): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
}

export async function writePageIndex(
  dataDir: string,
  page: string,
  sections: DocSection[]
): Promise<void> {
  const indexDir = join(dataDir, 'index');
  await mkdir(indexDir, { recursive: true });
  await writeFile(join(indexDir, `${page}.json`), JSON.stringify(sections, null, 2), 'utf-8');
}

export async function readAllIndexes(dataDir: string): Promise<DocSection[]> {
  const indexDir = join(dataDir, 'index');
  let files: string[];
  try {
    files = await readdir(indexDir);
  } catch {
    return [];
  }

  const all: DocSection[] = [];
  for (const file of files.filter((f) => f.endsWith('.json'))) {
    try {
      const raw = await readFile(join(indexDir, file), 'utf-8');
      const sections = JSON.parse(raw) as DocSection[];
      all.push(...sections);
    } catch {
      // Skip unreadable index files
    }
  }
  return all;
}
