import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

let mcpProcess: ChildProcess | null = null;

type D365Config = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  crmUrl: string;
};

export function activate(context: vscode.ExtensionContext) {
  const startCmd = vscode.commands.registerCommand(
    'd365-troubleshooter.start',
    () => void startServer(context),
  );

  const stopCmd = vscode.commands.registerCommand(
    'd365-troubleshooter.stop',
    () => stopServer(),
  );

  const configureCmd = vscode.commands.registerCommand(
    'd365-troubleshooter.configure',
    () => void configureCredentials(),
  );

  context.subscriptions.push(startCmd, stopCmd, configureCmd);

  const autoStart = vscode.workspace
    .getConfiguration()
    .get<boolean>('d365.autoStart', true);

  if (autoStart) {
    setTimeout(() => void startServer(context), 1500);
  }
}

export function deactivate() {
  stopServer();
}

async function startServer(context: vscode.ExtensionContext) {
  if (mcpProcess) {
    vscode.window.showInformationMessage(
      'D365 Troubleshooter MCP already running.',
    );
    return;
  }

  const d365Config = getD365Config();
  const env = {
    ...process.env,
    D365_TENANT_ID: d365Config.tenantId,
    D365_CLIENT_ID: d365Config.clientId,
    D365_CLIENT_SECRET: d365Config.clientSecret,
    D365_RESOURCE_URL: d365Config.crmUrl,
  };

  if (
    !env.D365_TENANT_ID ||
    !env.D365_CLIENT_ID ||
    !env.D365_CLIENT_SECRET ||
    !env.D365_RESOURCE_URL
  ) {
    const action = await vscode.window.showErrorMessage(
      'D365 credentials not configured. Please configure extension settings.',
      'Configure Now',
      'Open Settings',
      'Disable Auto Start',
    );

    if (action === 'Configure Now') {
      const configured = await configureCredentials();
      if (configured) {
        await startServer(context);
      }
    }

    if (action === 'Open Settings') {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:kishanmundha.d365-troubleshooter-mcp d365.',
      );
    }

    if (action === 'Disable Auto Start') {
      await vscode.workspace
        .getConfiguration()
        .update('d365.autoStart', false, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('Auto start disabled for D365 MCP.');
    }

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

function getD365Config(): D365Config {
  const config = vscode.workspace.getConfiguration();

  return {
    tenantId: config.get<string>('d365.tenantId') || '',
    clientId: config.get<string>('d365.clientId') || '',
    clientSecret: config.get<string>('d365.clientSecret') || '',
    crmUrl: config.get<string>('d365.crmUrl') || '',
  };
}

async function configureCredentials(): Promise<boolean> {
  const existing = getD365Config();

  const tenantId = await vscode.window.showInputBox({
    title: 'D365: Tenant ID',
    placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    value: existing.tenantId,
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() ? null : 'Tenant ID is required.'),
  });

  if (!tenantId) return false;

  const clientId = await vscode.window.showInputBox({
    title: 'D365: Client ID',
    placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    value: existing.clientId,
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() ? null : 'Client ID is required.'),
  });

  if (!clientId) return false;

  const clientSecret = await vscode.window.showInputBox({
    title: 'D365: Client Secret',
    password: true,
    value: existing.clientSecret,
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim() ? null : 'Client Secret is required.',
  });

  if (!clientSecret) return false;

  const crmUrl = await vscode.window.showInputBox({
    title: 'D365: CRM URL',
    placeHolder: 'https://yourorg.crm.dynamics.com',
    value: existing.crmUrl,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) return 'CRM URL is required.';
      try {
        const parsedUrl = new URL(value.trim());
        if (parsedUrl.protocol !== 'https:') {
          return 'CRM URL must start with https://';
        }
      } catch {
        return 'Enter a valid URL.';
      }
      return null;
    },
  });

  if (!crmUrl) return false;

  const config = vscode.workspace.getConfiguration();
  await config.update(
    'd365.tenantId',
    tenantId.trim(),
    vscode.ConfigurationTarget.Global,
  );
  await config.update(
    'd365.clientId',
    clientId.trim(),
    vscode.ConfigurationTarget.Global,
  );
  await config.update(
    'd365.clientSecret',
    clientSecret.trim(),
    vscode.ConfigurationTarget.Global,
  );
  await config.update(
    'd365.crmUrl',
    crmUrl.trim(),
    vscode.ConfigurationTarget.Global,
  );

  vscode.window.showInformationMessage('D365 credentials saved successfully.');
  return true;
}

function stopServer() {
  if (!mcpProcess) return;
  mcpProcess.kill();
  mcpProcess = null;
  vscode.window.showInformationMessage('D365 Troubleshooter MCP stopped.');
}
