import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Implementation } from '@modelcontextprotocol/sdk/types.js';
import { getAccessToken } from './crm/connector.js';
import { CrmSdk } from './crm/sdk.js';
import registerSearchEntitiesTool from './tools/search_entities.js';
import registerGetEntityPluginsTool from './tools/get_entity_plugins.js';
import registerSearchWebResourcesTool from './tools/search_webresources.js';
import registerGetWebResourceContentTool from './tools/get_webresource_content.js';

const serverInfo: Implementation = {
  name: 'd365-troubleshooter-mcp',
  version: process.env.NPM_PACKAGE_VERSION ?? 'unknown',
  title: 'D365 Troubleshooter MCP Server',
  description: 'MCP Server for troubleshooting D365 application',
};

async function createServer() {
  const server = new McpServer(serverInfo, {
    capabilities: {
      tools: {},
    },
  });
  const token = await getAccessToken();
  const sdk = new CrmSdk(token);

  registerTools(server, sdk);

  return server;
}

function registerTools(server: McpServer, sdk: CrmSdk) {
  registerSearchEntitiesTool(server, sdk);
  registerGetEntityPluginsTool(server, sdk);
  registerSearchWebResourcesTool(server, sdk);
  registerGetWebResourceContentTool(server, sdk);
}

export async function startServer(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
