/** Thin stdio→LeadAdapter bridge. Remote authorization, tools and governance remain authoritative. */
import {createHash}from'node:crypto';
import {McpServer}from'@modelcontextprotocol/server';
import {serveStdio}from'@modelcontextprotocol/server/stdio';
export const endpoint='https://leadadapter.com/mcp';
export class LeadAdapterMcpError extends Error{constructor(code,message,details={}){super(message);this.name='LeadAdapterMcpError';Object.assign(this,{code,...details});}}
const fail=(code,message,details)=>new LeadAdapterMcpError(code,message,details);
const versions=new Set(['2025-03-26','2025-06-18','2025-11-25']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
async function decode(response,id,maxBytes,signal){
 if(Number(response.headers.get('content-length'))>maxBytes)throw fail('response_too_large','LeadAdapter MCP response exceeds the configured size limit.');
 if(!response.body)throw fail('invalid_response','LeadAdapter returned an empty MCP response.');
 const reader=response.body.getReader(),decoder=new TextDecoder(),sse=(response.headers.get('content-type')??'').includes('text/event-stream');let text='',bytes=0;
 const read=()=>new Promise((resolve,reject)=>{const abort=()=>reject(fail('timeout','LeadAdapter MCP response timed out; inspect the action before retrying.'));if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});reader.read().then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
 const event=block=>{const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)return null;let value;try{value=JSON.parse(data);}catch{throw fail('invalid_response','LeadAdapter returned malformed MCP stream data.');}return value?.id===id?value:null;};
 try{for(;;){const {done,value}=await read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes)throw fail('response_too_large','LeadAdapter MCP response exceeds the configured size limit.');text+=decoder.decode(value,{stream:true});if(sse){let match;while((match=/\r?\n\r?\n/.exec(text))){const block=text.slice(0,match.index);text=text.slice(match.index+match[0].length);const result=event(block);if(result){await reader.cancel();return result;}}}}text+=decoder.decode();if(sse){const result=event(text);if(result)return result;throw fail('invalid_response','MCP stream ended without the matching response; inspect the action before retrying.');}try{return JSON.parse(text);}catch{throw fail('invalid_response','LeadAdapter returned invalid MCP JSON.');}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export class LeadAdapterMcpClient{
 #key;#fetch;#timeout;#maxPages;#maxBytes;#session;#version='2025-06-18';#sequence=0;#initializing;#ready=false;#tools=new Map();#uncertain=new Set();#closed=false;
 constructor({apiKey,fetchImpl=globalThis.fetch,timeoutMs=30000,maxPages=100,maxBytes=4000000,endpoint:requestedEndpoint}={}){
  if(typeof apiKey!=='string'||!apiKey.trim()||/[\r\n]/.test(apiKey))throw fail('api_key_required','Set LEADADAPTER_API_KEY to a scoped workspace API key.');
  if(requestedEndpoint!==undefined&&requestedEndpoint!==endpoint)throw fail('fixed_origin','This bridge only connects to https://leadadapter.com/mcp.');
  if(typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000||!Number.isInteger(maxPages)||maxPages<1||maxPages>100||!Number.isInteger(maxBytes)||maxBytes<1024||maxBytes>10000000)throw new TypeError('Invalid MCP transport limits.');
  this.#key=apiKey;this.#fetch=fetchImpl;this.#timeout=timeoutMs;this.#maxPages=maxPages;this.#maxBytes=maxBytes;
 }
 async #send(method,params={},notification=false){
  const id=++this.#sequence,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.#timeout);
  const headers={Authorization:`Bearer ${this.#key}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
  if(method!=='initialize')headers['MCP-Protocol-Version']=this.#version;if(this.#session)headers['Mcp-Session-Id']=this.#session;
  try{
   const response=await this.#fetch(endpoint,{method:'POST',redirect:'error',signal:controller.signal,headers,body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id}),method,params})});
   if(response.redirected||response.status>=300&&response.status<400)throw fail('redirect_refused','LeadAdapter MCP redirects are refused; the bridge uses its fixed HTTPS origin.');
   if(!response.ok){if(response.body)await response.body.cancel();const status=response.status;throw fail(status===401?'unauthorized':status===403?'forbidden':status===429?'rate_limited':status===404&&this.#session?'session_expired':'remote_http_error',status===401?'LeadAdapter rejected the API key. Check the owned workspace key and MCP/API access.':status===403?'The key/account lacks permission for this MCP operation. Review its scopes and account access.':status===404&&this.#session?'The remote MCP session expired. Restart discovery; inspect any uncertain action before retrying.':status===429?'LeadAdapter rate-limited this request. Respect Retry-After; no retry was attempted.':`LeadAdapter MCP returned HTTP ${status}; inspect account/action status before retrying.`,{status,retryAfter:response.headers.get('retry-after')});}
   const session=response.headers.get('mcp-session-id');if(session!==null){if(!/^[\x21-\x7e]{1,512}$/.test(session)||this.#session&&session!==this.#session)throw fail('invalid_session','LeadAdapter returned an invalid or changed MCP session.');this.#session=session;}
   if(notification){if(response.body)await response.body.cancel();return;}
   const data=await decode(response,id,this.#maxBytes,controller.signal);
   if(data?.jsonrpc!=='2.0'||data.id!==id)throw fail('invalid_response','LeadAdapter returned an invalid or mismatched JSON-RPC response.');
   if(data.error)throw fail('remote_rpc_error',`LeadAdapter rejected the MCP request (JSON-RPC ${Number.isInteger(data.error.code)?data.error.code:'error'}). Check arguments, scopes and account prerequisites.`,{rpcCode:data.error.code});
   if(!object(data.result))throw fail('invalid_response','LeadAdapter returned no MCP result.');return data.result;
  }catch(error){if(error instanceof LeadAdapterMcpError)throw error;throw fail(controller.signal.aborted?'timeout':'transport_error',controller.signal.aborted?'LeadAdapter MCP request timed out. Inspect any action/job receipt before retrying.':'LeadAdapter MCP transport failed. Check connectivity; inspect any uncertain action before retrying.');}
  finally{clearTimeout(timer);}
 }
 async initialize(){
  if(this.#closed)throw fail('closed','The MCP bridge connection is closed.');if(this.#ready)return;
  if(!this.#initializing)this.#initializing=(async()=>{const result=await this.#send('initialize',{protocolVersion:this.#version,capabilities:{},clientInfo:{name:'leadadapter-stdio-bridge',version:'0.3.0'}});if(!versions.has(result.protocolVersion)||!object(result.capabilities)||typeof result.serverInfo?.name!=='string'||typeof result.serverInfo?.version!=='string')throw fail('invalid_initialize','LeadAdapter returned an unsupported MCP initialization result.');this.#version=result.protocolVersion;await this.#send('notifications/initialized',{},true);this.#ready=true;})();
  try{await this.#initializing;}catch(error){this.#initializing=undefined;throw error;}
 }
 async listTools(){
  await this.initialize();const tools=[],names=new Set(),cursors=new Set();let cursor;
  for(let page=0;page<this.#maxPages;page++){
   const result=await this.#send('tools/list',cursor?{cursor}:{});
   if(!Array.isArray(result.tools))throw fail('invalid_inventory','LeadAdapter tools/list did not return a tool array.');
   for(const tool of result.tools){if(typeof tool?.name!=='string'||!tool.name||!object(tool.inputSchema)||names.has(tool.name))throw fail('invalid_inventory','LeadAdapter returned an invalid or duplicate tool definition.');names.add(tool.name);tools.push(tool);}
   cursor=result.nextCursor;if(cursor===undefined||cursor===null||cursor===''){this.#tools=new Map(tools.map(tool=>[tool.name,tool]));return tools;}
   if(typeof cursor!=='string'||cursor.length>8192||cursors.has(cursor))throw fail('invalid_pagination','LeadAdapter returned an invalid or repeated MCP cursor.');cursors.add(cursor);
  }throw fail('pagination_limit','LeadAdapter tool discovery exceeded its bounded page limit; inventory was not truncated silently.');
 }
 async callTool(name,args={}){
  if(this.#closed)throw fail('closed','The MCP bridge connection is closed.');
  if(typeof name!=='string'||!name||!object(args))throw new TypeError('Tool name and object arguments are required.');
  if(!this.#tools.size)await this.listTools();const tool=this.#tools.get(name);if(!tool)throw fail('tool_not_available','This tool was not discovered for the current authorized account. Refresh discovery and check permissions.');
  const fingerprint=createHash('sha256').update(JSON.stringify([name,args])).digest('hex');if(this.#uncertain.has(fingerprint))throw fail('execution_uncertain','This call previously had an uncertain outcome. Inspect LeadAdapter actions/jobs before explicit reconciliation; it will not be replayed by this bridge.');
  try{const result=await this.#send('tools/call',{name,arguments:args});if(!Array.isArray(result.content))throw fail('invalid_response','LeadAdapter tools/call returned no content.');return result;}
  catch(error){if(tool.annotations?.readOnlyHint!==true&&['timeout','transport_error','invalid_response','remote_http_error'].includes(error.code)){this.#uncertain.add(fingerprint);throw fail('execution_uncertain','The tool call outcome is uncertain. Inspect LeadAdapter actions/jobs before retrying; no automatic retry or approval was performed.');}throw error;}
 }
 async close(){this.#closed=true;if(!this.#session)return;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.#timeout);try{const response=await this.#fetch(endpoint,{method:'DELETE',redirect:'error',signal:controller.signal,headers:{Authorization:`Bearer ${this.#key}`,'Mcp-Session-Id':this.#session,'MCP-Protocol-Version':this.#version}});if(response.body)await response.body.cancel();}catch{}finally{clearTimeout(timer);this.#session=undefined;}}
}
export function createBridge(options={}){
 const remote=options.client??new LeadAdapterMcpClient({...options,apiKey:options.apiKey??process.env.LEADADAPTER_API_KEY});
 const bridge=new McpServer({name:'leadadapter',version:'0.3.0'},{capabilities:{tools:{}}});
 bridge.server.setRequestHandler('tools/list',async()=>({tools:await remote.listTools()}));
 bridge.server.setRequestHandler('tools/call',async request=>{try{return await remote.callTool(request.params.name,request.params.arguments??{});}catch(error){return {content:[{type:'text',text:JSON.stringify({ok:false,code:error.code??'bridge_error',message:error instanceof LeadAdapterMcpError?error.message:'Bridge failed; inspect account access and request arguments.'})}],isError:true};}});
 const oldClose=bridge.close.bind(bridge);bridge.close=async()=>{await remote.close();await oldClose();};return bridge;
}
export function startBridge(options={}){return serveStdio(()=>createBridge(options));}
