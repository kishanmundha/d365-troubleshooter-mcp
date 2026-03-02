import type { CrmSdk } from '@/crm/sdk.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const FindPluginTracesSchema = z.object({
  primaryEntity: z
    .string()
    .optional()
    .describe('Primary entity to find plugin trace logs'),
  pluginSetpId: z
    .string()
    .optional()
    .describe('Plugin step ID to filter plugin trace logs'),
  messageName: z
    .string()
    .optional()
    .describe('Message name to filter plugin trace logs'),
  from: z
    .string()
    .optional()
    .describe('Start date to filter plugin trace logs (Date only, ISO format)'),
  to: z
    .string()
    .optional()
    .describe('End date to filter plugin trace logs (Date only, ISO format)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of records to return (default: 25)'),
});

const FindPluginTracesResultSchema = z.object({
  traces: z.array(
    z.object({
      id: z.string().describe('Plugin trace log ID'),
      typeName: z.string().describe('Plugin type name'),
      messageName: z.string().describe('Message name'),
      primaryEntity: z.string().describe('Primary entity name'),
      pluginSetpId: z.string().describe('Plugin step ID'),
      startTime: z.string().describe('Plugin execution start time'),
      durationMs: z
        .number()
        .nullable()
        .describe('Execution duration in milliseconds'),
      createdOn: z.string().describe('Trace created on date'),
      messageBlock: z.string().describe('Trace message details'),
      exceptionDetails: z.string().describe('Trace exception details'),
      operationType: z.number().describe('Operation type code'),
      operationTypeName: z
        .string()
        .describe('Operation type name (Plug-in, Workflow Activity'),
      mode: z.number().describe('Execution mode code'),
      modeName: z
        .string()
        .describe('Execution mode name (Synchronous, Asynchronous)'),
      depth: z
        .number()
        .nullable()
        .describe(
          'Execution depth (number of plugin executions in the call stack)',
        ),
    }),
  ),
  count: z
    .number()
    .describe('Total count of plugin trace logs matching the criteria'),
});

export default function registerFindPluginTracesTool(
  server: McpServer,
  sdk: CrmSdk,
) {
  server.registerTool(
    'find_plugin_traces',
    {
      description:
        'Find Dynamics 365 plugin trace logs by primary entity, plugin step, message name, and date range. (Note: primary entity or plugin step ID is required to filter the logs)',
      inputSchema: FindPluginTracesSchema as unknown as AnySchema,
      outputSchema: FindPluginTracesResultSchema as unknown as AnySchema,
    },
    async (request: z.infer<typeof FindPluginTracesSchema>) => {
      if (!request.primaryEntity && !request.pluginSetpId) {
        return {
          structuredContent: {
            traces: [],
            count: 0,
          },
          content: [
            {
              type: 'text',
              text: 'Please provide at least a primary entity or plugin step ID to find plugin traces.',
            },
          ],
        } as CallToolResult;
      }

      const result = await sdk.findPluginTraces(
        {
          primaryEntity: request.primaryEntity,
          pluginSetpId: request.pluginSetpId,
          messageName: request.messageName,
          from: request.from,
          to: request.to,
        },
        request.limit,
      );

      return {
        structuredContent: {
          traces: result.traces,
          count: result.count,
        },
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      } as CallToolResult;
    },
  );
}
