import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchLatestCommitSha, DOC_PAGES } from '../indexer/fetch.js';
import { runIndexPipeline } from '../indexer/pipeline.js';
import { SearchEngine } from '../search/engine.js';

export function registerReindexTool(
  server: McpServer,
  engineRef: { current: SearchEngine },
  dataDir: string
): void {
  server.tool(
    'odin-reindex',
    'Force a full re-index of Odin docs from GitHub. Use only when search results seem stale or you know content exists that is not appearing in results. Returns sectionsIndexed, pagesIndexed, and commitSha.',
    {},
    async () => {
      const sha = await fetchLatestCommitSha();
      const { sections, totalSections } = await runIndexPipeline(dataDir, sha);
      engineRef.current = new SearchEngine(sections);

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
    }
  );
}
