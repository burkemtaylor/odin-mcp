import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SearchEngine } from '../search/engine.js';

export function registerGetTool(
  server: McpServer,
  engineRef: { current: SearchEngine }
): void {
  server.tool(
    'odin-get-section',
    'Fetch a specific doc section by its exact ID (e.g. "overview/variable-declarations"). Use after odin-search or odin-list-sections to retrieve full content.',
    {
      id: z.string().describe('Section ID (e.g. "overview/variable-declarations")'),
    },
    async ({ id }) => {
      const section = engineRef.current.getById(id);
      if (!section) {
        return {
          content: [
            { type: 'text', text: JSON.stringify({ error: `Section not found: ${id}` }) },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(section, null, 2) }],
      };
    }
  );
}
