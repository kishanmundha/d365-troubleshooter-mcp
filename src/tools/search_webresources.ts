import type { CrmSdk } from '@/crm/sdk.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const SearchWebResourcesSchema = z.object({
  search: z.string().describe('Search term to find web resources'),
});

const SearchWebResourcesResultSchema = z.object({
  webResources: z.array(
    z.object({
      id: z.string().describe('Web resource ID'),
      name: z.string().describe('Web resource name'),
      displayName: z.string().describe('Display name of the web resource'),
      webresourcetype: z.number().nullable().describe('Web resource type code'),
      webresourcetypeName: z.string().describe('Web resource type name'),
      modifiedOn: z.string().describe('Last modified date'),
    }),
  ),
});

export default function registerSearchWebResourcesTool(
  server: McpServer,
  sdk: CrmSdk,
) {
  server.registerTool(
    'search_webresources',
    {
      description: 'Search Dynamics 365 web resources by name or display name.',
      inputSchema: SearchWebResourcesSchema as unknown as AnySchema,
      outputSchema: SearchWebResourcesResultSchema as unknown as AnySchema,
    },
    async (request: z.infer<typeof SearchWebResourcesSchema>) => {
      const search = request.search?.trim() ?? '';
      if (!search) {
        return {
          structuredContent: {
            webResources: [],
          },
          content: [
            {
              type: 'text',
              text: 'No search term provided. Please provide a search term to find web resources.',
            },
          ],
        } as CallToolResult;
      }

      const webResources = await sdk.searchWebResources(search);

      return {
        structuredContent: {
          webResources,
        },
        content: [
          {
            type: 'text',
            text: JSON.stringify(webResources, null, 2),
          },
        ],
      } as CallToolResult;
    },
  );
}
