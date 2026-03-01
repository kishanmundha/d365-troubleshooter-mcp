import type { CrmSdk } from '@/crm/sdk.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const GetWebResourcesContentSchema = z.object({
  id: z.string().optional().describe('Web resource ID'),
  name: z.string().optional().describe('Web resource name'),
});

const GetWebResourcesContentResultSchema = z.object({
  content: z.string().describe('Web resource content'),
});

export default function registerGetWebResourceContentTool(
  server: McpServer,
  sdk: CrmSdk,
) {
  server.registerTool(
    'get_webresource_content',
    {
      description:
        'Get the content of a Dynamics 365 web resource by ID or name.',
      inputSchema: GetWebResourcesContentSchema as unknown as AnySchema,
      outputSchema: GetWebResourcesContentResultSchema as unknown as AnySchema,
    },
    async (request: z.infer<typeof GetWebResourcesContentSchema>) => {
      const id = request.id?.trim() ?? '';
      const name = request.name?.trim() ?? '';
      if (!id && !name) {
        return {
          structuredContent: {
            content: '',
          },
          content: [
            {
              type: 'text',
              text: 'No web resource ID or name provided. Please provide either the ID or the name of the web resource to get its content.',
            },
          ],
        } as CallToolResult;
      }

      const content = id
        ? await sdk.getWebResourceContentById(id)
        : await sdk.getWebResourceContentByName(name);

      return {
        structuredContent: {
          content: content,
        },
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      } as CallToolResult;
    },
  );
}
