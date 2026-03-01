import type { CrmSdk, EntityReferenceBundle } from '@/crm/sdk.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const GetEntityPluginsSchema = z.object({
  logicalName: z
    .string()
    .describe('Logical name of the Dynamics 365 entity (for example: account)'),
});

const GetEntityPluginsResultSchema = z.object({
  plugins: z.array(
    z.object({
      id: z.string().describe('Plugin step ID'),
      message: z
        .string()
        .describe('Message name (for example: Create, Update)'),
      mode: z.number().nullable().describe('Execution mode code'),
      modeName: z.string().describe('Execution mode name'),
      stage: z.number().nullable().describe('Execution stage code'),
      stageName: z.string().describe('Execution stage name'),
      statecode: z.number().nullable().describe('Plugin step state code'),
      statecodeName: z.string().describe('Plugin step state name'),
      filteringattributes: z.string().describe('Filtering attributes list'),
      primaryEntityLogicalName: z
        .string()
        .describe('Primary entity logical name'),
      images: z.array(
        z.object({
          name: z.string().describe('Image name'),
          imagetype: z
            .number()
            .describe('Image type code (Example: PreImage, PostImage)'),
          imagetypeName: z.string().describe('Image type name'),
          entityalias: z.string().describe('Entity alias'),
          attributes: z.string().describe('Image attributes list'),
        }),
      ),
    }),
  ),
});

export default function registerGetEntityPluginsTool(
  server: McpServer,
  sdk: CrmSdk,
) {
  server.registerTool(
    'get_entity_plugins',
    {
      description:
        'Get the plugins that reference a specific Dynamics 365 entity.',
      inputSchema: GetEntityPluginsSchema as unknown as AnySchema,
      outputSchema: GetEntityPluginsResultSchema as unknown as AnySchema,
    },
    async (request: z.infer<typeof GetEntityPluginsSchema>) => {
      const logicalName = request.logicalName?.trim();
      if (!logicalName) {
        return {
          structuredContent: {
            plugins: [],
          },
          content: [
            {
              type: 'text',
              text: 'No logical name provided. Please provide a logicalName (for example: account).',
            },
          ],
        } as CallToolResult;
      }

      const plugins = await sdk.getEntityPlugins(logicalName);

      return {
        structuredContent: {
          plugins,
        },
        content: [
          {
            type: 'text',
            text: JSON.stringify(plugins, null, 2),
          },
        ],
      } as CallToolResult;
    },
  );
}
