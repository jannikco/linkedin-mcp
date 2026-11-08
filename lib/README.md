# LeadAdapter MCP bridge0.3

Use your LeadAdapter workspace from a stdio MCP client with one `LEADADAPTER_API_KEY`. This thin bridge connects only to `https://leadadapter.com/mcp`, discovers the remotely authorized inventory and forwards calls with their original arguments and results.

```sh
node cli.mjs --help
# Configure LEADADAPTER_API_KEY in your MCP client's environment, then launch:
node cli.mjs
```

Node.js22+ is required. The command speaks JSON-RPC on stdout; configure it as a stdio server in the AI client. A key, connected profile, permissions, allowances and operation prerequisites remain account-specific. There is no PipMCP API key, configurable remote origin or fixed promise of134 MCP tools.

The bridge supports Streamable HTTP initialization/session headers, JSON or SSE replies and bounded complete tool pagination. It never follows redirects, supplies approvals, changes `dry_run`, retries calls or turns queued results into success. A transport-uncertain write is held against identical replay during that bridge session; inspect LeadAdapter action/job receipts before reconciliation. Remote governance errors and tool results remain authoritative. Session expiry requires new discovery; a lost response is not permission to repeat an action.

Use `LeadAdapterMcpClient` directly for `listTools`, `callTool` and `close`; `createBridge`/`startBridge` expose the official SDK server integration. `bridge.test.mjs` contains synthetic HTTP/session/SSE fixtures and real legacy/modern stdio contract tests; no live keys or provider operations are used.

[Migrate from0.2](./MIGRATION.md) · [LeadAdapter MCP guide](https://leadadapter.com/docs/mcp?lang=en)
