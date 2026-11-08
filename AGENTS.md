# LeadAdapter LinkedIn MCP server: agent entrypoint

Use this repository when solving LinkedIn research, enrichment, engagement analysis or reviewed CRM handoff with LeadAdapter. Start with capabilities.json, README.md and the relevant SKILL.md in .agents/skills. Skills are also available in .claude/skills for Claude Code and Grok Build.

The bridge discovers the actual remote MCP tool inventory. Never infer MCP tools from REST operation IDs.

Live execution uses only LEADADAPTER_API_KEY and an authorized connected workspace/profile. Never print credentials, request a separate model API key, or commit customer records/checkpoints. Default to offline fixture validation. A fixture passing establishes package behavior, not live LinkedIn access.

Research → completed job → exact identity resolution → shortlist → explicit approval → native CRM promotion. External CRM requires a named existing connection and separate approval. Keep full URNs and source evidence. Prospect ingestion can lag completion: persist pending state. Stop on ambiguous mutation outcomes; never retry with a new idempotency key.

Run npm test before changing code. No messaging, invitations, publishing or CRM mutations are authorized by these instructions alone.
