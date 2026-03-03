import type { CrmSdk, PluginTraceItem, SystemJobItem } from '@/crm/sdk.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const HealthCheckEnvironmentSchema = z.object({
  primaryEntity: z
    .string()
    .optional()
    .describe(
      'Optional entity logical name for plugin trace analysis (example: account)',
    ),
  from: z
    .string()
    .optional()
    .describe(
      'Start date (ISO date) for health check window. Default: 7 days ago',
    ),
  to: z
    .string()
    .optional()
    .describe('End date (ISO date) for health check window. Default: today'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum records per category to inspect (default: 25)'),
});

const HealthCheckEnvironmentResultSchema = z.object({
  summary: z.object({
    from: z.string().describe('Window start date (ISO date)'),
    to: z.string().describe('Window end date (ISO date)'),
    failedSystemJobs: z.number().describe('Count of failed system jobs'),
    waitingSystemJobs: z.number().describe('Count of waiting system jobs'),
    inProgressSystemJobs: z
      .number()
      .describe('Count of in-progress system jobs'),
    pluginTraces: z
      .number()
      .describe(
        'Count of plugin traces (0 when primaryEntity is not provided)',
      ),
  }),
  topSystemJobErrors: z.array(
    z.object({
      errorCode: z.number().nullable().describe('System job error code'),
      message: z.string().describe('System job message'),
      friendlyMessage: z.string().describe('Friendly message'),
      count: z.number().describe('Occurrences in inspected records'),
    }),
  ),
  topPluginTraceErrors: z.array(
    z.object({
      typeName: z.string().describe('Plugin type name'),
      messageName: z.string().describe('Message name'),
      exceptionDetails: z.string().describe('Plugin exception details'),
      count: z.number().describe('Occurrences in inspected records'),
    }),
  ),
  sampleFailedSystemJobs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      statusName: z.string(),
      operationTypeName: z.string(),
      errorCode: z.number().nullable(),
      message: z.string(),
      createdOn: z.string(),
      completedOn: z.string(),
    }),
  ),
  samplePluginTraces: z.array(
    z.object({
      id: z.string(),
      typeName: z.string(),
      messageName: z.string(),
      primaryEntity: z.string(),
      startTime: z.string(),
      durationMs: z.number().nullable(),
      exceptionDetails: z.string(),
      messageBlock: z.string(),
      createdOn: z.string(),
    }),
  ),
  notes: z.array(z.string()),
});

function toIsoDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildWindow(from?: string, to?: string): { from: string; to: string } {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(today.getUTCDate() - 7);

  return {
    from: from?.trim() || toIsoDateOnly(sevenDaysAgo),
    to: to?.trim() || toIsoDateOnly(today),
  };
}

function summarizeSystemJobErrors(jobs: SystemJobItem[]) {
  const buckets = new Map<
    string,
    {
      errorCode: number | null;
      message: string;
      friendlyMessage: string;
      count: number;
    }
  >();

  for (const job of jobs) {
    const key = `${job.errorCode ?? ''}|${job.message}|${job.friendlyMessage}`;
    const existing = buckets.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    buckets.set(key, {
      errorCode: job.errorCode,
      message: job.message,
      friendlyMessage: job.friendlyMessage,
      count: 1,
    });
  }

  return [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 5);
}

function summarizePluginTraceErrors(traces: PluginTraceItem[]) {
  const buckets = new Map<
    string,
    {
      typeName: string;
      messageName: string;
      exceptionDetails: string;
      count: number;
    }
  >();

  for (const trace of traces) {
    const key = `${trace.typeName}|${trace.messageName}|${trace.exceptionDetails}`;
    const existing = buckets.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    buckets.set(key, {
      typeName: trace.typeName,
      messageName: trace.messageName,
      exceptionDetails: trace.exceptionDetails,
      count: 1,
    });
  }

  return [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 5);
}

export default function registerHealthCheckEnvironmentTool(
  server: McpServer,
  sdk: CrmSdk,
) {
  server.registerTool(
    'health_check_environment',
    {
      description:
        'Run a Dynamics 365 environment health check using system jobs and plugin traces. Plugin trace analysis is enabled when primaryEntity is provided.',
      inputSchema: HealthCheckEnvironmentSchema as unknown as AnySchema,
      outputSchema: HealthCheckEnvironmentResultSchema as unknown as AnySchema,
    },
    async (request: z.infer<typeof HealthCheckEnvironmentSchema>) => {
      const window = buildWindow(request.from, request.to);
      const limit = request.limit;

      const failedJobsPromise = sdk.findSystemJobs(
        {
          status: 'failed',
          from: window.from,
          to: window.to,
        },
        limit,
      );

      const waitingJobsPromise = sdk.findSystemJobs(
        {
          status: 'waiting',
          from: window.from,
          to: window.to,
        },
        limit,
      );

      const inProgressJobsPromise = sdk.findSystemJobs(
        {
          status: 'in_progress',
          from: window.from,
          to: window.to,
        },
        limit,
      );

      const [failedJobsResult, waitingJobsResult, inProgressJobsResult] =
        await Promise.all([
          failedJobsPromise,
          waitingJobsPromise,
          inProgressJobsPromise,
        ]);

      let pluginTraceCount = 0;
      let pluginTraces: PluginTraceItem[] = [];
      const notes: string[] = [];

      const primaryEntity = request.primaryEntity?.trim();
      if (primaryEntity) {
        const pluginTraceResult = await sdk.findPluginTraces(
          {
            primaryEntity,
            from: window.from,
            to: window.to,
          },
          limit,
        );

        pluginTraceCount = pluginTraceResult.count;
        pluginTraces = pluginTraceResult.traces;
      } else {
        notes.push(
          'Plugin trace analysis is skipped. Provide primaryEntity for trace-level health signals.',
        );
      }

      const result = {
        summary: {
          from: window.from,
          to: window.to,
          failedSystemJobs: failedJobsResult.count,
          waitingSystemJobs: waitingJobsResult.count,
          inProgressSystemJobs: inProgressJobsResult.count,
          pluginTraces: pluginTraceCount,
        },
        topSystemJobErrors: summarizeSystemJobErrors(failedJobsResult.jobs),
        topPluginTraceErrors: summarizePluginTraceErrors(pluginTraces),
        sampleFailedSystemJobs: failedJobsResult.jobs
          .slice(0, 10)
          .map((job) => ({
            id: job.id,
            name: job.name,
            statusName: job.statusName,
            operationTypeName: job.operationTypeName,
            errorCode: job.errorCode,
            message: job.message,
            createdOn: job.createdOn,
            completedOn: job.completedOn,
          })),
        samplePluginTraces: pluginTraces.slice(0, 10).map((trace) => ({
          id: trace.id,
          typeName: trace.typeName,
          messageName: trace.messageName,
          primaryEntity: trace.primaryEntity,
          startTime: trace.startTime,
          durationMs: trace.durationMs,
          exceptionDetails: trace.exceptionDetails,
          messageBlock: trace.messageBlock,
          createdOn: trace.createdOn,
        })),
        notes,
      };

      return {
        structuredContent: result,
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
