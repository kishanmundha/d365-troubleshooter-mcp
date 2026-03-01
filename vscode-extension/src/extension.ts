import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let mcpProcess: ChildProcess | null = null;

export function activate(context: vscode.ExtensionContext) {
  const startCmd = vscode.commands.registerCommand(
    'd365-troubleshooter.start',
    () => startServer(context),
  );

  const stopCmd = vscode.commands.registerCommand(
    'd365-troubleshooter.stop',
    () => stopServer(),
  );

  context.subscriptions.push(startCmd, stopCmd);

  const autoStart = vscode.workspace
    .getConfiguration()
    .get<boolean>('d365.autoStart', true);

  if (autoStart) {
    setTimeout(() => startServer(context), 1500);
  }
}

export function deactivate() {
  stopServer();
}

function startServer(context: vscode.ExtensionContext) {
  if (mcpProcess) {
    vscode.window.showInformationMessage(
      'D365 Troubleshooter MCP already running.',
    );
    return;
  }

  const config = vscode.workspace.getConfiguration();

  const env = {
    ...process.env,
    D365_TENANT_ID: config.get<string>('d365.tenantId') || '',
    D365_CLIENT_ID: config.get<string>('d365.clientId') || '',
    D365_CLIENT_SECRET: config.get<string>('d365.clientSecret') || '',
    D365_RESOURCE_URL: config.get<string>('d365.crmUrl') || '',
  };

  if (
    !env.D365_TENANT_ID ||
    !env.D365_CLIENT_ID ||
    !env.D365_CLIENT_SECRET ||
    !env.D365_RESOURCE_URL
  ) {
    vscode.window.showErrorMessage(
      'D365 credentials not configured. Please fill extension settings.',
    );
    return;
  }

  const serverBin = require.resolve('d365-troubleshooter-mcp/dist/index.js', {
    paths: [context.extensionPath],
  });

  mcpProcess = spawn('node', [serverBin], {
    env,
    stdio: 'pipe',
  });

  mcpProcess.stdout?.on('data', (d) => console.log(`[MCP]: ${d}`));
  mcpProcess.stderr?.on('data', (d) => console.error(`[MCP ERROR]: ${d}`));

  mcpProcess.on('exit', () => {
    mcpProcess = null;
    vscode.window.showWarningMessage('D365 Troubleshooter MCP stopped.');
  });

  vscode.window.showInformationMessage('D365 Troubleshooter MCP started.');
}

function stopServer() {
  if (!mcpProcess) return;
  mcpProcess.kill();
  mcpProcess = null;
  vscode.window.showInformationMessage('D365 Troubleshooter MCP stopped.');
}
