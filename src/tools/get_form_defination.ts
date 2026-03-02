import { FormDefinationSchema } from '@/crm/form.js';
import type { CrmSdk } from '@/crm/sdk.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const GetFormDefinationSchema = z.object({
  id: z.string().optional().describe('Form ID'),
});

const GetFormDefinationResultSchema = FormDefinationSchema;

export default function registerGetFormDefinationTool(
  server: McpServer,
  sdk: CrmSdk,
) {
  server.registerTool(
    'get_form_defination',
    {
      description: 'Get the content of a Dynamics 365 form by ID.',
      inputSchema: GetFormDefinationSchema as unknown as AnySchema,
      outputSchema: GetFormDefinationResultSchema as unknown as AnySchema,
    },
    async (request: z.infer<typeof GetFormDefinationSchema>) => {
      const id = request.id?.trim() ?? '';
      if (!id) {
        return {
          structuredContent: {
            content: '',
          },
          content: [
            {
              type: 'text',
              text: 'No form ID provided. Please provide the ID of the form to get its content.',
            },
          ],
        } as CallToolResult;
      }

      const defination = await sdk.getFormDefinitionById(id);

      return {
        structuredContent: defination,
        content: [
          {
            type: 'text',
            text: JSON.stringify(defination, null, 2),
          },
        ],
      } as CallToolResult;
    },
  );
}
