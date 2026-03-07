# Copilot Instructions — d365-troubleshooter-mcp

## Architecture at a glance

- This repo has two packages: root MCP server (`src/`) and a VS Code extension wrapper (`vscode-extension/`).
- MCP entry path: `src/bin.ts` → `startServer()` in `src/server.ts`.
- Server startup sequence is: validate env (`src/env.ts`) → acquire token (`src/crm/connector.ts`) → create `CrmSdk` (`src/crm/sdk.ts`) → register tools (`src/tools/*.ts`) → connect `StdioServerTransport`.
- Tool handlers should stay thin: schema + input handling + SDK call + result shaping.

## Tooling conventions (important)

- Each tool file exports a default `registerXTool(server, sdk)` function.
- Define `zod` input/output schemas and pass them as `AnySchema` in `server.registerTool`.
- Return `CallToolResult` with both:
  - `structuredContent` (machine-usable)
  - `content` with a text payload (usually `JSON.stringify(result, null, 2)`) for human readability.
- Follow existing “graceful invalid input” behavior: for missing required user values, return an empty structured result + guidance text instead of throwing.
- Preserve existing public names even if misspelled (`get_form_defination`, `pluginSetpId`, `fetchEntityDefination`), because MCP clients may depend on them.

## CRM/API layer patterns

- Keep Dynamics Web API and FetchXML logic centralized in `CrmSdk`; avoid embedding API logic inside tool files.
- When interpolating user text into FetchXML, use `escapeFetchXmlValue` from `CrmSdk` patterns.
- `CrmSdk.fetch()` throws `Error(message, { cause: code })` for Dataverse JSON errors; callers may branch on `error.cause`.
- Token caching is file-based (`.crm_auth_results.json`) and keyed by tenant/client/secret hash in `connector.ts`.

## Logging and stdio safety

- Never use `console.log` in MCP runtime code under `src/`.
- Stdout is reserved for MCP protocol messages; extra output can break clients.
- Use `src/logger.ts` for runtime logs (default file: `./.d365-troubleshooter-mcp.log`).
- `MCP_LOG_STDERR=true` mirrors logs to stderr only when explicitly desired for debugging.

## Build, validation, and release workflow

- Root package commands:
  - `pnpm build` (tsup build + d.ts)
  - `pnpm dev` (watch + auto-run `dist/bin.js`)
  - `pnpm type-check` (strict TS validation)
  - `pnpm inspect` (MCP inspector)
- There is no meaningful test suite right now; validate changes with `pnpm type-check` and `pnpm build`.
- Imports are ESM/NodeNext style with explicit `.js` extensions in TS source.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).

## VS Code extension integration notes

- Extension process management lives in `vscode-extension/src/extension.ts` and spawns the MCP server over stdio.
- Extension config keys are `d365.tenantId`, `d365.clientId`, `d365.clientSecret`, `d365.crmUrl`, `d365.autoStart`.
- When changing env/config wiring, keep extension and server variable expectations aligned to avoid startup/auth regressions.
