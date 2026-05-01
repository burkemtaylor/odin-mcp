import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SearchEngine } from '../search/engine.js';

export function registerLookupTool(
  server: McpServer,
  engineRef: { current: SearchEngine }
): void {
  server.tool(
    'odin-lookup',
    {
      query: z.string().describe('Topic to look up (e.g. "slices", "context system")'),
      page: z.string().optional().describe('Limit to a specific page (e.g. "overview", "faq")'),
      limit: z.number().optional().describe('Max results (default 5)'),
    },
    async ({ query, page, limit = 5 }) => {
      const results = engineRef.current.search(query, { limit, page });
      const formatted = results.map((r) => ({
        title: r.title,
        content: r.content,
        codeExamples: r.codeExamples,
        url: r.url,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
      };
    }
  );
}
