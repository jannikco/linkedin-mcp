/** Remote MCP checks. No provider credentials, writes, or redirects are followed. */
export function validateEndpoint(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw new Error('Endpoint must be an HTTPS URL without embedded credentials, query, or fragment');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || /^\[|^\d+\.\d+\.\d+\.\d+$/.test(hostname)) throw new Error('Endpoint must use a public DNS hostname');
  return url.href;
}
export function clientConfigs(endpoint, { name = 'pipmcp', tokenEnv = 'PIPMCP_MCP_TOKEN' } = {}) {
  const url = validateEndpoint(endpoint);
  if (!/^[a-z][a-z0-9_-]*$/i.test(name) || !/^[A-Z][A-Z0-9_]*$/.test(tokenEnv)) throw new Error('Invalid config name or token environment variable');
  return {
    cursor: { mcpServers: { [name]: { url, headers: { Authorization: `Bearer \${env:${tokenEnv}}` } } } },
    claudeCode: { command: 'claude', args: ['mcp', 'add', '--transport', 'http', name, url, '--header', `Authorization: Bearer <${tokenEnv}>`] },
    chatgpt: { serverUrl: url, authentication: 'Bearer token', tokenEnvironmentVariable: tokenEnv },
  };
}
async function readJson(response, maxBytes = 2_000_000) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new Error('MCP response exceeds size limit');
  if (!response.body) throw new Error('Empty MCP response');
  const reader = response.body.getReader(); let bytes = 0; const chunks = [];
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('MCP response exceeds size limit'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new TextDecoder().decode(Buffer.concat(chunks));
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('text/event-stream')) {
    const payloads = data.split(/\r?\n\r?\n/).map(block => block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')).filter(Boolean);
    for (const payload of payloads.reverse()) { try { const json = JSON.parse(payload); if (json.id === 1) return json; } catch { /* ignore keepalive payloads */ } }
    throw new Error('MCP stream contains no matching JSON-RPC response');
  }
  try { return JSON.parse(data); } catch { throw new Error('MCP server returned invalid JSON'); }
}
export async function listTools({ endpoint, token, fetchImpl = globalThis.fetch, timeoutMs = 15000, maxPages = 20 }) {
  const url = validateEndpoint(endpoint);
  if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) throw new Error('A nonempty MCP bearer token is required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new Error('timeoutMs must be between 1 and 120000');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) throw new Error('maxPages must be between 1 and 100');
  const tools = []; const cursors = new Set(); let cursor;
  for (let page = 0; page < maxPages; page++) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    let body;
    try {
      const response = await fetchImpl(url, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'tools/list' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { ...(cursor ? { cursor } : {}), _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } } }),
      });
      if (response.redirected || response.status >= 300 && response.status < 400) throw new Error('MCP redirects are refused');
      if (!response.ok) throw new Error(`MCP request failed with HTTP ${response.status}`);
      body = await readJson(response);
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('MCP request timed out');
      // Do not echo transport messages, response bodies, or server error data: they may contain secrets.
      const safe = ['MCP redirects are refused', 'MCP response exceeds size limit', 'Empty MCP response', 'MCP stream contains no matching JSON-RPC response', 'MCP server returned invalid JSON'];
      if (safe.includes(error?.message) || /^MCP request failed with HTTP \d+$/.test(error?.message ?? '')) throw error;
      throw new Error('MCP transport failed; check endpoint, connectivity, and token');
    } finally { clearTimeout(timer); }
    if (body?.jsonrpc !== '2.0' || body.id !== 1) throw new Error('Invalid MCP JSON-RPC response');
    if (body.error) throw new Error(`MCP returned JSON-RPC error ${Number.isInteger(body.error.code) ? body.error.code : 'unknown'}`);
    if (!Array.isArray(body.result?.tools) || body.result.tools.some(t => typeof t?.name !== 'string' || typeof t?.inputSchema !== 'object' || t.inputSchema === null)) throw new Error('Invalid MCP tools/list result');
    tools.push(...body.result.tools);
    cursor = body.result.nextCursor;
    if (cursor === undefined || cursor === null || cursor === '') return tools;
    if (typeof cursor !== 'string' || cursors.has(cursor)) throw new Error('Invalid or repeated MCP pagination cursor');
    cursors.add(cursor);
  }
  throw new Error('MCP pagination exceeds configured page limit');
}
export async function checkConnection(options) {
  const tools = await listTools(options);
  return { state: 'setup-validated', providerLiveValidation: 'not-run', toolCount: tools.length, toolNames: tools.map(t => t.name) };
}
