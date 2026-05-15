import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SearchEngine } from '../search/engine.js';

export function registerListTool(
  server: McpServer,
  engineRef: { current: SearchEngine }
): void {
  server.tool(
    'odin-list-sections',
    {
      page: z.string().optional().describe('Filter to a specific page (e.g. "overview", "faq")'),
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
