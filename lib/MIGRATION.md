# Migrating to0.3

Version0.3 replaces the fixed direct-tool starter with a stdio bridge to LeadAdapter's existing remote MCP service. Re-discover tools in the client: names and schemas now come from the inventory authorized for the workspace key, rather than the old local subset. REST operations and MCP tools are separate interfaces; the REST OpenAPI count is not an MCP inventory guarantee.

Keep `LEADADAPTER_API_KEY` as the sole service credential and launch `node cli.mjs` as the stdio command. The endpoint is fixed to `https://leadadapter.com/mcp`; custom endpoint/provider-origin settings and the old local runtime write flags are not bridge execution controls. Review remote operation schemas, scopes and governance requirements. Existing AI-client stored tool assumptions may need updating after discovery.

Approvals and retry semantics are not added by the bridge. Original arguments pass through unchanged, permission failures remain failures and uncertain calls require receipt inspection. Fixture tests prove bridge behavior only; validate intended authorized operations in the actual account before relying on their outcome.
