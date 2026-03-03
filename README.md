# D365 Troubleshooter MCP

Give your coding agent direct access to Dynamics 365 / Dataverse metadata and web resources through a Model Context Protocol (MCP) server.

This server helps with CRM troubleshooting workflows like:

- finding entities quickly,
- checking plugin step registrations for a table,
- searching web resources,
- reading web resource source content.

## How it works

1. Your MCP client starts this server over stdio.
2. The server authenticates with Microsoft Entra ID using app credentials.
3. It queries Dynamics 365 Web API (`/api/data/v9.1`).
4. Your AI client can call the exposed tools and use structured output for analysis.

## Features

- `search_entities`: Search Dataverse tables by logical or display name.
- `get_entity_plugins`: List plugin steps registered for a specific entity.
- `find_system_jobs`: Find system jobs (async operations) with flexible filters (failed by default).
- `health_check_environment`: Run a quick environment health summary using system jobs and plugin traces.
- `search_webresources`: Find web resources by name/display name.
- `get_webresource_content`: Read decoded web resource content by ID or name.
- Access token caching in `.crm_auth_results.json` to reduce repeated auth calls.

## Requirements

- Node.js 18+ (recommended: latest LTS)
- A Dynamics 365 / Dataverse environment URL
- Microsoft Entra app registration with access to your Dataverse org
- Tenant ID, Client ID, and Client Secret

Required environment variables:

- `TENANT_ID`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `DYNAMICS_365_URL` (example: `https://orgname.crm.dynamics.com`)

## Getting started

Many MCP clients (Cursor, VS Code MCP clients, Claude Desktop-compatible clients) support JSON-based server configuration.

### MacOS / Linux

```json
{
  "mcpServers": {
    "D365 Troubleshooter MCP": {
      "command": "npx",
      "args": ["-y", "d365-troubleshooter-mcp"],
      "env": {
        "TENANT_ID": "YOUR_TENANT_ID",
        "CLIENT_ID": "YOUR_CLIENT_ID",
        "CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "DYNAMICS_365_URL": "https://orgname.crm.dynamics.com"
      }
    }
  }
}
```

### Windows

```json
{
  "mcpServers": {
    "D365 Troubleshooter MCP": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "d365-troubleshooter-mcp"],
      "env": {
        "TENANT_ID": "YOUR_TENANT_ID",
        "CLIENT_ID": "YOUR_CLIENT_ID",
        "CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "DYNAMICS_365_URL": "https://orgname.crm.dynamics.com"
      }
    }
  }
}
```

## Local development

```bash
pnpm install
pnpm build
```

Run from source build:

```bash
node dist/index.js
```

Available scripts:

- `pnpm dev` – watch build with `tsup`
- `pnpm build` – production build
- `pnpm type-check` – TypeScript check
- `pnpm inspect` – launch MCP inspector

## Auto publish and tagging

This repo includes a GitHub Actions workflow at `.github/workflows/release.yml` that:

1. runs on push to `main` when `package.json` changes,
2. checks whether the `version` field changed,
3. publishes to npm using Trusted Publisher (OIDC) via `npm publish --provenance`,
4. creates and pushes a git tag in the format `v<version>`.

No npm token secret is required when Trusted Publisher is configured in npm for this GitHub repository.

Release flow:

1. Bump `version` in `package.json`.
2. Commit and push to `main` (or `master`).
3. Workflow publishes the new version and creates tag `vX.Y.Z`.

## VS Code extension

A companion VS Code extension exists in `vscode-extension/` for local credential configuration and MCP integration.

## Notes

- The server uses OAuth client credential flow via `@azure/msal-node`.
- Auth results are cached in `.crm_auth_results.json`.
- Keep secrets in your MCP client env configuration (never hardcode them in source).

## License

ISC
