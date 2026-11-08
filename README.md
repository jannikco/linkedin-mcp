# LeadAdapter LinkedIn MCP server

Inspect your connected profile state, then retrieve your workspace’s stored leads before planning further governed LinkedIn actions.

A direct-provider MCP server with useful local execution. Uses your LeadAdapter API account and its existing governance.

## Quick start

Requires Node.js22+. Clone this repository, then run:

```sh
npm ci --ignore-scripts
npm test
npm start
```

The default command inspects the tools offline. Configure your own credentials in your environment:

- `LEADADAPTER_API_KEY`



Credential help: https://leadadapter.com/api/v1/openapi.json

## Execute a real read

Replace example record IDs with records you are authorized to access.

```sh
npm start -- --call list_leads_get '{}'
```

## Use with an MCP client

Launch `node /absolute/path/linkedin-mcp/server.mjs` using stdio transport; pass credentials through the client environment. Stdout is reserved for JSON-RPC.

## Tools

| Tool | Effect | Purpose |
| --- | --- | --- |
| list_leads_get | Read | List Leads |
| search_post | Read | Search |
| list_post_engagers_post | Read | List Post Engagers |
| get_extension_status_get | Read | Extension status |
| comment_on_post_post | Explicit approval required | Comment On Post |

## Concrete workflow

Inspect your connected profile state, then retrieve your workspace’s stored leads before planning further governed LinkedIn actions.

1. get_extension_status_get
2. list_leads_get

## Optional writes

Writes are disabled by default. Set CONNECTOR_ALLOW_WRITES=true and supply `_approval: {approved:true,idempotencyKey:"unique-request-id"}` on the specific call. Do not reuse a key for a different request. Uncertain outcomes are never automatically replayed; inspect the provider before another attempt.

## Capability evidence

Local: **Tested — HTTP fixtures and real stdio tools/call**. Managed: **Documented**. Provider authentication and live operations have not been established by these fixture tests. Evidence applies per operation and execution mode; setup discovery does not imply provider execution.

## Managed production

[Activate with LeadAdapter](https://leadadapter.com/github/start?integration=linkedin-mcp&utm_source=github&utm_campaign=github-linkedin-mcp&utm_content=readme) when you want the hosted service.  Local credentials are not uploaded by this code. Review provider permissions in the managed onboarding. [Directory and related projects](https://jannikco.github.io/pipmcp-connectors/integrations/linkedin/).

## Provenance and maintenance

- https://leadadapter.com/api/v1/openapi.json

Maintainer:jannikco. MIT license for this code. See connector.json for selected operations and integration.json for evidence. Runtime dependencies retain their own licenses. Report sensitive issues through https://pipmcp.com/contact; do not post credentials or customer data in public issues.
