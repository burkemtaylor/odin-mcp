import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { join } from 'node:path';
import {
  fetchLatestCommitSha,
  fetchDocMarkdown,
  cacheRawDoc,
  DOC_PAGES,
} from './indexer/fetch.js';
import { parsePage } from './indexer/parse.js';
import { readMeta, writeMeta, writePageIndex, readAllIndexes } from './indexer/store.js';
import { SearchEngine } from './search/engine.js';
import { registerLookupTool } from './tools/lookup.js';
import { registerSearchTool } from './tools/search.js';
import { registerListTool } from './tools/list.js';
import { registerGetTool } from './tools/get.js';
import { registerReindexTool } from './tools/reindex.js';

const DATA_DIR = join(process.cwd(), 'data');

async function runIndexer(sha: string): Promise<void> {
  const rawDir = join(DATA_DIR, 'raw');
  for (const page of DOC_PAGES) {
    const markdown = await fetchDocMarkdown(page);
    await cacheRawDoc(rawDir, page, markdown);
    const sections = parsePage(page, markdown);
    await writePageIndex(DATA_DIR, page, sections);
    console.error(`[odin-mcp] Indexed ${sections.length} sections from ${page}`);
  }
  await writeMeta(DATA_DIR, {
    lastCommitSha: sha,
    lastIndexedAt: new Date().toISOString(),
  });
}

async function loadOrBuildIndex(): Promise<SearchEngine> {
  const cachedSections = await readAllIndexes(DATA_DIR);

  let sha: string | null = null;
  try {
    sha = await fetchLatestCommitSha();
  } catch {
    console.error('[odin-mcp] GitHub API unavailable, using cached index');
  }

  const meta = await readMeta(DATA_DIR);
  const needsReindex = !meta || (sha !== null && meta.lastCommitSha !== sha);

  if (needsReindex && sha !== null) {
    console.error(
      meta ? '[odin-mcp] Docs updated, re-indexing...' : '[odin-mcp] No index found, building...'
    );
    await runIndexer(sha);
    const freshSections = await readAllIndexes(DATA_DIR);
    return new SearchEngine(freshSections);
  }

  if (cachedSections.length === 0) {
    console.error(
      '[odin-mcp] Warning: No index available and GitHub unreachable. Run `npm run index` when online.'
    );
  }

  return new SearchEngine(cachedSections);
}

async function main() {
  const server = new McpServer({
    name: 'odin-docs',
    version: '0.1.0',
  });

  const engine = await loadOrBuildIndex();
  console.error(`[odin-mcp] Ready — ${engine.sectionCount} sections loaded`);

  const engineRef = { current: engine };

  registerLookupTool(server, engineRef);
  registerSearchTool(server, engineRef);
  registerListTool(server, engineRef);
  registerGetTool(server, engineRef);
  registerReindexTool(server, engineRef, DATA_DIR);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[odin-mcp] Fatal error:', err);
  process.exit(1);
});
