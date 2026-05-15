import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DOC_PAGES } from '../indexer/fetch.js';
import type { SearchEngine } from '../search/engine.js';

export function registerListTool(
  server: McpServer,
  engineRef: { current: SearchEngine }
): void {
  server.tool(
    'odin-list-sections',
    'List all indexed doc sections with their IDs. Use to discover section IDs for odin-get-section. Filter by page to narrow results.',
    {
      page: z.enum(DOC_PAGES).optional().describe('Filter to a specific doc page'),
    },
    async ({ page }) => {
      const sections = engineRef.current.listSections(page);
      const formatted = sections.map((s) => ({
        id: s.id,
        title: s.title,
        page: s.page,
        url: s.url,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
      };
    }
  );
}
