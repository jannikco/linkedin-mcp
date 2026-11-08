# LinkedIn MCP for Claude, Codex and AI agents

**Give your AI assistant access to your authorized LinkedIn workflows through LeadAdapter. One LeadAdapter API key.**

Research people, inspect engagement, enrich selected profiles and work with leads through the tools enabled in your workspace. This package bridges stdio MCP clients to LeadAdapter's hosted MCP endpoint; it discovers the server's actual tools and schemas at runtime.

[Get your LeadAdapter API key](https://leadadapter.com/github/start?integration=linkedin-mcp&utm_source=github&utm_campaign=github-linkedin-mcp) · [API documentation](https://leadadapter.com/docs/api-reference?lang=en) · [Integration directory](https://jannikco.github.io/pipmcp-connectors/integrations/linkedin/)

## Connect your agent

Requires Node.js 22+. Clone this repository and install its pinned dependencies:

```sh
git clone https://github.com/jannikco/linkedin-mcp.git
cd linkedin-mcp
npm ci --ignore-scripts
npm test
node example.mjs
```

Set LEADADAPTER_API_KEY in the environment used by your MCP client. Configure its stdio server command as node with the absolute argument /path/to/linkedin-mcp/lib/cli.mjs. Keep the API key in the client's protected environment, never in a committed JSON file. You may also connect a client that supports the hosted endpoint directly to https://leadadapter.com/mcp.

Only your LeadAdapter key is used. Available tools depend on the workspace's scopes, connected account, tier and policy. The bridge does not promise that every REST operation is an MCP tool.

## Ask for an outcome

“Research software founders matching our ICP. Show me a source-backed shortlist before adding anyone to CRM.”

“Find the people engaging with this post and help me review who belongs in our pipeline.”

The bundled .agents/skills and .claude/skills provide task instructions for Codex, Claude Code and Grok Build. See AGENTS.md, capabilities.json and llms.txt for discovery. These instructions use your existing agent session; no extra AI model API key is required.

## Remote discovery and receipts

```js
import {LeadAdapterMcpClient} from './lib/index.mjs';
const client = new LeadAdapterMcpClient({apiKey: process.env.LEADADAPTER_API_KEY});
try {
  const tools = await client.listTools();
  console.log(tools); // Inspect the actual remote schemas before selecting a tool.
} finally {
  await client.close();
}
```

The bridge preserves remote tool schemas and results, handles JSON/SSE sessions and paginated discovery, and never approves or retries uncertain mutations automatically. A queued job remains pending. Research is separate from approved CRM writes.

## Upgrade from 0.2

Version 0.3 replaces the historical local REST-backed tool subset with the actual remote MCP inventory. Discover tools again and update clients that depended on local names. Historical MIT code remains in Git history.

## Evidence and support

Package behavior is tested with synthetic remote MCP fixtures. Live authentication and LinkedIn execution require your authorized account and are not implied by passing fixture tests. Never include API keys or personal records in public issues. MIT applies to this bridge; LeadAdapter's hosted execution remains private.
