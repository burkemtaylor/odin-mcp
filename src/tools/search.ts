import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SearchEngine } from '../search/engine.js';

export function registerSearchTool(
  server: McpServer,
  engineRef: { current: SearchEngine }
): void {
  server.tool(
    'odin-search',
    {
      query: z.string().describe('Full-text search query'),
      limit: z.number().optional().describe('Max results (default 10)'),
    },
    async ({ query, limit = 10 }) => {
      const results = engineRef.current.search(query, { limit });
      const formatted = results.map((r) => ({
        title: r.title,
        content: r.content,
        url: r.url,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
      };
    }
  );
}
