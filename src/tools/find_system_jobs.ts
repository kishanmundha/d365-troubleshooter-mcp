import type { CrmSdk } from '@/crm/sdk.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const FindSystemJobsSchema = z.object({
  status: z
    .enum(['failed', 'succeeded', 'in_progress', 'waiting', 'canceled', 'all'])
    .optional()
    .describe('System job status filter (default: failed)'),
  operationType: z
    .number()
    .int()
    .optional()
    .describe('Operation type code to filter jobs'),
  nameContains: z
    .string()
    .optional()
    .describe('Filter by job name containing this text'),
  messageContains: z
    .string()
    .optional()
    .describe('Filter by message containing this text'),
  from: z
    .string()
    .optional()
    .describe('Start date to filter by createdon (Date only, ISO format)'),
  to: z
    .string()
    .optional()
    .describe('End date to filter by createdon (Date only, ISO format)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of records to return (default: 25)'),
});

const FindSystemJobsResultSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string().describe('System job ID'),
      name: z.string().describe('System job name'),
      operationType: z
        .number()
        .nullable()
        .describe('Operation type code of the system job'),
      operationTypeName: z.string().describe('Operation type display name'),
      stateCode: z.number().nullable().describe('State code'),
      stateName: z.string().describe('State name'),
      statusCode: z.number().nullable().describe('Status code'),
      statusName: z.string().describe('Status name'),
      message: z.string().describe('Message captured on the system job'),
      friendlyMessage: z.string().describe('Friendly error message, if any'),
      errorCode: z.number().nullable().describe('Error code, if any'),
      createdOn: z.string().describe('Created on date'),
      startedOn: z.string().describe('Started on date'),
      completedOn: z.string().describe('Completed on date'),
      regardingObjectId: z
        .string()
        .describe('Regarding object ID linked to the system job'),
      owningUserId: z.string().describe('Owning user ID'),
    }),
  ),
  count: z.number().describe('Total number of matching system jobs'),
});

export default function registerFindSystemJobsTool(
  server: McpServer,
  sdk: CrmSdk,
) {
  server.registerTool(
    'find_system_jobs',
    {
      description:
        'Find Dynamics 365 system jobs (async operations) with flexible filters. Defaults to failed jobs when no status is provided.',
      inputSchema: FindSystemJobsSchema as unknown as AnySchema,
      outputSchema: FindSystemJobsResultSchema as unknown as AnySchema,
    },
    async (request: z.infer<typeof FindSystemJobsSchema>) => {
      const filters: {
        status?:
          | 'failed'
          | 'succeeded'
          | 'in_progress'
          | 'waiting'
          | 'canceled'
          | 'all';
        operationType?: number;
        nameContains?: string;
        messageContains?: string;
        from?: string;
        to?: string;
      } = {};

      if (request.status) {
        filters.status = request.status;
      }

      if (typeof request.operationType === 'number') {
        filters.operationType = request.operationType;
      }

      if (typeof request.nameContains === 'string') {
        filters.nameContains = request.nameContains;
      }

      if (typeof request.messageContains === 'string') {
        filters.messageContains = request.messageContains;
      }

      if (typeof request.from === 'string') {
        filters.from = request.from;
      }

      if (typeof request.to === 'string') {
        filters.to = request.to;
      }

      const result = await sdk.findSystemJobs(filters, request.limit);

      return {
        structuredContent: {
          jobs: result.jobs,
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
