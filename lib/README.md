# PipMCP setup runtime

Dependency-free ESM remote MCP discovery and configuration helpers, under the factory's MIT license. This package is newly authored; it does not include PipMCP's proprietary implementation.

```js
import { checkConnection, clientConfigs } from './index.mjs';
console.log(clientConfigs('https://mcp.pipmcp.com/workspace/endpoint'));
const result = await checkConnection({
  endpoint: process.env.PIPMCP_MCP_URL,
  token: process.env.PIPMCP_MCP_TOKEN,
});
console.log(result);
```

`checkConnection` issues only paginated `tools/list`, with no tool execution or provider writes. Success proves authenticated discovery for the supplied hosted endpoint, not a working provider operation. An app-specific project must separately check the discovered tool inventory belongs to its app. Client configs contain placeholders, never secrets. The Claude Code object is a command argument description; replace its token placeholder securely when executing. Endpoint tokens and workspace management API tokens are different credentials.

The remote protocol shape is grounded in PipMCP `EndpointService::clientConfigs` and `McpServer`, inspected 2026-11-08. No standalone server or provider adapter is claimed. Redirects are refused; responses, page count and request duration are bounded; transport and server error messages are not copied into errors.

`catalog.mjs` exports only explicitly allowlisted catalog facts. `sources/pipmcp-export.mjs` produces the deterministic metadata snapshot. Held candidates remain held, unverified candidates remain unknown, raw internal notes and auth values are omitted. No provider specifications or application code are copied. Source URL references do not grant redistribution rights for provider specifications.
