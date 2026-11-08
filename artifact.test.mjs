import test from 'node:test';
import assert from 'node:assert/strict';
import {clientConfigs,validateEndpoint,checkConnection} from './lib/index.mjs';
test('configuration helper accepts hosted HTTPS endpoint',()=>{ const url='https://pipmcp.com/mcp/test'; assert.ok(validateEndpoint(url)); assert.ok(clientConfigs(url,{name:"linkedin-mcp",tokenEnv:"LEADADAPTER_API_KEY"})); });
test('mock tool discovery never executes a provider tool',async()=>{const methods=[];const result=await checkConnection({endpoint:'https://pipmcp.com/mcp/test',token:'fixture-token',fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);methods.push(body.method);return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result:{tools:[{name:'fixture_read',inputSchema:{type:'object'}}]}}),{headers:{'content-type':'application/json'}});}});assert.equal(result.toolCount,1);assert.ok(methods.every(method=>method==='tools/list'));assert.equal(result.providerLiveValidation,'not-run');});
