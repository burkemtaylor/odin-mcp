import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/odin-lang/odin-lang.org/master/content/docs';
const GITHUB_COMMITS_API =
  'https://api.github.com/repos/odin-lang/odin-lang.org/commits?path=content/docs&per_page=1';

export const DOC_PAGES = [
  'overview',
  'faq',
  'install',
  'testing',
  'examples',
  'demo',
  'nightly',
  'packages',
] as const;

export type DocPage = (typeof DOC_PAGES)[number];

export async function fetchLatestCommitSha(): Promise<string | null> {
  try {
    const response = await fetch(GITHUB_COMMITS_API, {
      headers: { 'User-Agent': 'odin-mcp/0.1.0' },
    });
    if (!response.ok) return null;
    const commits = (await response.json()) as Array<{ sha: string }>;
    return commits[0]?.sha ?? null;
  } catch {
    return null;
  }
}

export async function fetchDocMarkdown(page: DocPage): Promise<string> {
  const url = `${GITHUB_RAW_BASE}/${page}.md`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'odin-mcp/0.1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${page}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function cacheRawDoc(rawDir: string, page: DocPage, content: string): Promise<void> {
  await mkdir(rawDir, { recursive: true });
  await writeFile(join(rawDir, `${page}.md`), content, 'utf-8');
}

export async function readCachedDoc(rawDir: string, page: DocPage): Promise<string | null> {
  try {
    return await readFile(join(rawDir, `${page}.md`), 'utf-8');
  } catch {
    return null;
  }
}
