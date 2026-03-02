import type { CrmSdk } from '@/crm/sdk.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const GetEntityFormsSchema = z.object({
  logicalName: z
    .string()
    .describe('Logical name of the Dynamics 365 entity (for example: account)'),
});

const GetEntityFormsResultSchema = z.object({
  forms: z.array(
    z.object({
      id: z.string().describe('Form ID'),
      name: z.string().describe('Form name'),
      description: z.string().nullable().describe('Form description'),
      type: z.string().describe('Form type'),
      typeName: z.string().describe('Form type name'),
      isDefault: z.boolean().describe('Whether it is the default form'),
      formActivationState: z
        .number()
        .nullable()
        .describe('Form activation state code'),
      formActivationStateName: z
        .string()
        .describe('Form activation state name'),
    }),
  ),
});

export default function registerGetEntityFormsTool(
  server: McpServer,
  sdk: CrmSdk,
) {
  server.registerTool(
    'get_entity_forms',
    {
      description:
        'Get the forms that reference a specific Dynamics 365 entity.',
      inputSchema: GetEntityFormsSchema as unknown as AnySchema,
      outputSchema: GetEntityFormsResultSchema as unknown as AnySchema,
    },
    async (request: z.infer<typeof GetEntityFormsSchema>) => {
      const logicalName = request.logicalName?.trim();
      if (!logicalName) {
        return {
          structuredContent: {
            forms: [],
          },
          content: [
            {
              type: 'text',
              text: 'No logical name provided. Please provide a logicalName (for example: account).',
            },
          ],
        } as CallToolResult;
      }

      const forms = await sdk.getEntityForms(logicalName);

      return {
        structuredContent: {
          forms,
        },
        content: [
          {
            type: 'text',
            text: JSON.stringify(forms, null, 2),
          },
        ],
      } as CallToolResult;
    },
  );
}
