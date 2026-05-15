import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DOC_PAGES } from '../indexer/fetch.js';
import type { SearchEngine } from '../search/engine.js';

export function registerLookupTool(
  server: McpServer,
  engineRef: { current: SearchEngine }
): void {
  server.tool(
    'odin-lookup',
    'Search Odin language docs for a specific topic. Returns title, full content, and code examples. Use the page parameter to narrow results to one of: overview, faq, install, testing, examples, demo, nightly, packages.',
    {
      query: z.string().describe('Topic to look up (e.g. "slices", "context system")'),
      page: z.enum(DOC_PAGES).optional().describe('Limit to a specific doc page'),
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
