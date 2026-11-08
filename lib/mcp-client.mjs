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
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name) || !/^[A-Z][A-Z0-9_]*$/.test(tokenEnv)) throw new Error('Invalid config name or token environment variable');
  return {
    cursor: { mcpServers: { [name]: { url, headers: { Authorization: `Bearer \${env:${tokenEnv}}` } } } },
    claudeCode: { command: 'claude', args: ['mcp', 'add', '--transport', 'http', name, url, '--header', `Authorization: Bearer <${tokenEnv}>`] },
    chatgpt: { serverUrl: url, authentication: 'Bearer token', tokenEnvironmentVariable: tokenEnv },
  };
}
const modernVersion = '2026-07-28';
const legacyVersions = new Set(['2025-11-25','2025-06-18','2025-03-26']);
function protocolFor(url, lifecycle, requested) {
  if (!['auto','legacy','stateless'].includes(lifecycle)) throw new Error('lifecycle must be auto, legacy or stateless');
  if (requested !== undefined && requested !== modernVersion && !legacyVersions.has(requested)) throw new Error('Unsupported MCP protocolVersion');
  const leadadapter = new URL(url).hostname === 'leadadapter.com' && /^\/mcp\/?$/.test(new URL(url).pathname);
  const mode = lifecycle === 'auto' ? (requested ? legacyVersions.has(requested) ? 'legacy' : 'stateless' : leadadapter ? 'legacy' : 'stateless') : lifecycle;
  const version = requested ?? (mode === 'legacy' ? '2025-06-18' : modernVersion);
  if ((mode === 'legacy') !== legacyVersions.has(version)) throw new Error('MCP protocolVersion and lifecycle are incompatible');
  return {mode,version};
}
async function readJson(response, expectedId, maxBytes = 2_000_000) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new Error('MCP response exceeds size limit');
  if (!response.body) throw new Error('Empty MCP response');
  const reader = response.body.getReader(); let bytes = 0; let text = ''; const decoder = new TextDecoder();
  const eventStream = (response.headers.get('content-type') ?? '').includes('text/event-stream');
  function event(block) {
    const payload=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if (!payload) return null;
    try {const json=JSON.parse(payload);return json.id===expectedId?json:null;}catch{return null;}
  }
  try {
    for (;;) {
      const {value,done}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>maxBytes){await reader.cancel();throw new Error('MCP response exceeds size limit');}
      text+=decoder.decode(value,{stream:true});
      if(eventStream){
        let boundary;
        while((boundary=/\r?\n\r?\n/.exec(text))){
          const block=text.slice(0,boundary.index);text=text.slice(boundary.index+boundary[0].length);
          const result=event(block);
          if(result){await reader.cancel();return result;}
        }
      }
    }
    text+=decoder.decode();
    if(eventStream){const result=event(text);if(result)return result;throw new Error('MCP stream contains no matching JSON-RPC response');}
    try{return JSON.parse(text);}catch{throw new Error('MCP server returned invalid JSON');}
  } finally {reader.releaseLock();}
}
function rpcResult(body,id) {
  if(body?.jsonrpc!=='2.0'||body.id!==id)throw new Error('Invalid MCP JSON-RPC response');
  if(body.error)throw new Error(`MCP returned JSON-RPC error ${Number.isInteger(body.error.code)?body.error.code:'unknown'}`);
  return body.result;
}
export async function listTools({ endpoint, token, fetchImpl = globalThis.fetch, timeoutMs = 15000, maxPages = 20, protocolVersion, lifecycle = 'auto' }) {
  const url = validateEndpoint(endpoint);
  if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) throw new Error('A nonempty MCP bearer token is required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new Error('timeoutMs must be between 1 and 120000');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) throw new Error('maxPages must be between 1 and 100');
  const protocol=protocolFor(url,lifecycle,protocolVersion);let version=protocol.version,session;
  async function send(method,params,{id=1,notification=false}={}){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
    if(method!=='initialize')headers['MCP-Protocol-Version']=version;
    if(protocol.mode==='stateless')headers['Mcp-Method']=method;
    if(protocol.mode==='legacy'&&session)headers['Mcp-Session-Id']=session;
    const args=protocol.mode==='stateless'?{...params,_meta:{'io.modelcontextprotocol/protocolVersion':version,'io.modelcontextprotocol/clientCapabilities':{}}}:params;
    try{
      const response=await fetchImpl(url,{method:'POST',redirect:'error',signal:controller.signal,headers,body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id}),method,params:args})});
      if(response.redirected||response.status>=300&&response.status<400)throw new Error('MCP redirects are refused');
      if(!response.ok)throw new Error(`MCP request failed with HTTP ${response.status}`);
      if(protocol.mode==='legacy'){
        const received=response.headers.get('mcp-session-id');
        if(received!==null){
          if(!/^[\x21-\x7e]{1,512}$/.test(received))throw new Error('Invalid MCP session header');
          if(session&&received!==session)throw new Error('MCP session changed unexpectedly');
          session=received;
        }
      }
      if(notification){
        // An initialized notification has no JSON-RPC reply; compliant servers return202/204.
        if(response.body)await response.body.cancel();
        return undefined;
      }
      return rpcResult(await readJson(response,id),id);
    }catch(error){
      if(error?.name==='AbortError')throw new Error('MCP request timed out');
      const safe=['MCP redirects are refused','MCP response exceeds size limit','Empty MCP response','MCP stream contains no matching JSON-RPC response','MCP server returned invalid JSON','Invalid MCP JSON-RPC response','Invalid MCP session header','MCP session changed unexpectedly'];
      if(safe.includes(error?.message)||/^MCP request failed with HTTP \d+$/.test(error?.message??'')||/^MCP returned JSON-RPC error (?:-?\d+|unknown)$/.test(error?.message??''))throw error;
      throw new Error('MCP transport failed; check endpoint, connectivity, and token');
    }finally{clearTimeout(timer);}
  }
  if(protocol.mode==='legacy'){
    const initialized=await send('initialize',{protocolVersion:version,capabilities:{},clientInfo:{name:'integration-factory-checker',version:'0.1.0'}},{id:0});
    if(!legacyVersions.has(initialized?.protocolVersion)||!initialized.capabilities||typeof initialized.capabilities!=='object'||Array.isArray(initialized.capabilities)||typeof initialized.serverInfo?.name!=='string'||typeof initialized.serverInfo?.version!=='string')throw new Error('Invalid MCP initialize result or unsupported negotiated version');
    version=initialized.protocolVersion;
    await send('notifications/initialized',{}, {notification:true});
  }
  const tools=[];const cursors=new Set();let cursor;
  for(let page=0;page<maxPages;page++){
    const result=await send('tools/list',cursor?{cursor}:{},{id:protocol.mode==='legacy'?page+1:1});
    if(!Array.isArray(result?.tools)||result.tools.some(t=>typeof t?.name!=='string'||typeof t?.inputSchema!=='object'||t.inputSchema===null))throw new Error('Invalid MCP tools/list result');
    tools.push(...result.tools);
    cursor=result.nextCursor;
    if(cursor===undefined||cursor===null||cursor==='')return tools;
    if(typeof cursor!=='string'||cursors.has(cursor))throw new Error('Invalid or repeated MCP pagination cursor');
    cursors.add(cursor);
  }
  throw new Error('MCP pagination exceeds configured page limit');
}
export async function checkConnection(options) {
  const tools = await listTools(options);
  return { state: 'setup-validated', providerLiveValidation: 'not-run', toolCount: tools.length, toolNames: tools.map(t => t.name) };
}
