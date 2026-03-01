# Dynamics 365 Troubleshooter (MCP)

AI-powered troubleshooting, diagnostics, and root cause analysis for Dynamics 365 & Dataverse using Model Context Protocol (MCP).

## Features

- Plugin trace log analysis
- Workflow diagnostics
- Schema & metadata inspection
- AI-powered root cause detection
- Copilot MCP integration

## Setup

1. Install extension
2. Run command: `Configure D365 Credentials`
3. Fill Tenant ID, Client ID, Client Secret, and CRM URL in prompts
4. (Optional) Open Settings → D365 Troubleshooter MCP to review values
5. Restart VS Code

Alternatively, you can configure manually in Settings:

- `d365.tenantId`
- `d365.clientId`
- `d365.clientSecret`
- `d365.crmUrl`

If credentials are missing at startup, extension now shows actions to configure immediately.

MCP server auto-starts.

## Usage

Ask Copilot:

> Find root cause of contact save error

> Analyze plugin failures in last 30 minutes

## Security

All processing happens **locally**.  
No CRM data leaves your machine.
