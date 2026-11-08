# LinkedIn MCP setup and connection checker

Configure and inspect the hosted LeadAdapter MCP endpoint from supported AI clients.

Maintainer: jannikco · License: MIT · Verification: **mock-only**

## Quick start

Requires Node.js 22 or later.

```sh
npm ci
npm test
npm start
```

The default example runs locally without credentials and makes no external changes. Verification status describes recorded evidence; local configuration tests do not establish that provider authentication or execution works.

## Connect your API

[Create or sign in to LeadAdapter](https://leadadapter.com/register?utm_source=github&utm_campaign=github-linkedin-mcp) and select the integration. Connect your authorized provider account and copy its hosted MCP endpoint. Set PIPMCP_ENDPOINT and, if required, LEADADAPTER_API_KEY in your environment. Run npm start to produce client configuration; run npm start -- --live for a read-only connection check. Provider app presence is catalog evidence, not live verification.

## Managed service

[Continue with LeadAdapter](https://leadadapter.com/register?utm_source=github&utm_campaign=github-linkedin-mcp). This repository is maintained by the integration team and does not imply endorsement by LinkedIn or other providers.

## Provenance and support

Source revision: ea33908e4d5e10508739f28e11abf708e11f3117f1108b904229eeeb00079e55. The complete manifest is in integration.json; SHA256SUMS covers the reviewed artifact. Open a repository issue without credentials or personal data. See SECURITY.md for sensitive reports. No telemetry is sent by this code; signup links include explicit campaign parameters.
