import { z } from 'zod';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchLatestCommitSha, fetchDocMarkdown, cacheRawDoc, DOC_PAGES } from '../indexer/fetch.js';
import { parsePage } from '../indexer/parse.js';
import { writePageIndex, writeMeta, readAllIndexes } from '../indexer/store.js';
import { SearchEngine } from '../search/engine.js';

export function registerReindexTool(
  server: McpServer,
  engineRef: { current: SearchEngine },
  dataDir: string
): void {
  server.tool('odin-reindex', {}, async () => {
    const rawDir = join(dataDir, 'raw');
    let totalSections = 0;

    const sha = await fetchLatestCommitSha();

    for (const page of DOC_PAGES) {
      const markdown = await fetchDocMarkdown(page);
      await cacheRawDoc(rawDir, page, markdown);
      const sections = parsePage(page, markdown);
      await writePageIndex(dataDir, page, sections);
      totalSections += sections.length;
    }

    await writeMeta(dataDir, {
      lastCommitSha: sha ?? 'unknown',
      lastIndexedAt: new Date().toISOString(),
    });

    const allSections = await readAllIndexes(dataDir);
    engineRef.current = new SearchEngine(allSections);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sectionsIndexed: totalSections,
              pagesIndexed: DOC_PAGES.length,
              commitSha: sha ?? 'unknown',
            },
            null,
            2
          ),
        },
      ],
    };
  });
}
