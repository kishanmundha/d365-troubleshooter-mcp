import type { CrmSdk } from '@/crm/sdk.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const GetTablesSchema = z.object({
  search: z.string().describe('Search term to filter tables'),
});

const GetTablesResultSchema = z.object({
  tables: z.array(
    z.object({
      logicalName: z.string().describe('Logical name of the table'),
      displayName: z.string().describe('Display name of the table'),
      entitySetName: z.string().describe('Entity set name of the table'),
    }),
  ),
});

export default function registerGetEntitiesTool(
  server: McpServer,
  sdk: CrmSdk,
) {
  server.registerTool(
    'search_entities',
    {
      description:
        'Search for entities in Dynamics 365 CRM. You can provide a search term to filter tables by their logical name or display name.',
      inputSchema: GetTablesSchema as unknown as AnySchema,
      outputSchema: GetTablesResultSchema as unknown as AnySchema,
    },
    async (request: z.infer<typeof GetTablesSchema>) => {
      if (!request.search) {
        return {
          structuredContent: {
            tables: [],
          },
          content: [
            {
              type: 'text',
              text: 'No search term provided. Please provide a search term to filter tables.',
            },
          ],
        } as CallToolResult;
      }

      const tables = await sdk.fetchEntities(request.search);

      return {
        structuredContent: {
          tables,
        },
        content: [
          {
            type: 'text',
            text: JSON.stringify(tables, null, 2),
          },
        ],
      } as CallToolResult;
    },
  );
}
