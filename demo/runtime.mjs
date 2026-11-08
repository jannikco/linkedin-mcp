/** Synthetic-only task runner. All network-shaped requests use an injected local fixture. */
import{createHash}from'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function normalizeReviewRecords(flow,records){
 const rule=flow.synthetic.normalize;return records.map((record,index)=>{const row={...record};if(!rule)return row;
  if(rule.type==='elapsed-days')row[flow.synthetic.field]=Math.floor((Date.parse(flow.synthetic.asOf)-Date.parse(row[rule.sourceField]))/86400000);
  else if(rule.type==='budget-variance')row[flow.synthetic.field]=row.budget>0?(row.actual-row.budget)/row.budget*100:0;
  else if(rule.type==='email-present'){const value=row[rule.sourceField];row[flow.synthetic.field]=Array.isArray(value)?value.some(v=>typeof v==='string'&&v.includes('@')):typeof value==='string'&&value.includes('@');}
  else if(rule.type==='value-present')row[flow.synthetic.field]=typeof row[rule.sourceField]==='string'&&row[rule.sourceField].trim().length>0;
  else if(rule.type==='calendar-conflicts'){row.conflictsWith=records.filter((other,i)=>i!==index&&Date.parse(row.start)<Date.parse(other.end)&&Date.parse(other.start)<Date.parse(row.end)).map(other=>other.id);row[flow.synthetic.field]=row.conflictsWith.length>0;}
  return row;
 });
}
export async function runSyntheticFlow(flow,adapters){
 const trace=[],records=structuredClone(flow.synthetic.records),key=flow.product==='pipmcp'?'pmk_revenue_synthetic_fixture_key':'revenue-synthetic-fixture-key';
 const fakeName='fixture_read_'+flow.id.replaceAll('-','_');
 const validate=(raw,init,origin)=>{const u=new URL(raw);if(u.origin!==origin||init.headers.Authorization!=='Bearer '+key||init.redirect!=='error')throw Error('Unexpected synthetic transport');trace.push({method:init.method,path:u.pathname});return u;};
 let output,receipt;
 if(flow.transport==='private-import-preview'){
  const document={openapi:'3.1.0',info:{title:'Synthetic Inventory',version:'1.0.0'},servers:[{url:'https://api.example.com'}],paths:{'/stock':{get:{operationId:'readSyntheticStock',summary:'Read synthetic stock',responses:{200:{description:'Stock records'}}}}}};
  const preview=adapters.buildImportRequest('openapi',JSON.stringify(document),{name:'Synthetic inventory preview'});
  output={format:'openapi',operationCount:1,operation:'readSyntheticStock',method:preview.method,destination:preview.url,publication:'not-requested',connection:'not-configured'};receipt={status:'previewed'};
 }else if(flow.transport==='pipmcp-gateway'){
  const client=new adapters.PipMCPGatewayClient({apiKey:key,fetchImpl:async(raw,init)=>{
   const u=validate(raw,init,'https://pipmcp.com');let data;
   if(init.method==='GET'&&u.pathname===`/api/v1/connectors/${flow.connectorId}/tools`)data={connector_id:flow.connectorId,integration_id:'synthetic-integration',connection_id:'synthetic-connection',tools:[{name:fakeName,description:flow.readTask.intent,readOnly:true,approvalRequired:false,inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:10}},required:['limit'],additionalProperties:false}}]};
   else if(init.method==='POST'&&u.pathname===`/api/v1/connectors/${flow.connectorId}/calls`){const body=JSON.parse(init.body);if(body.tool!==fakeName||body.arguments.limit!==10)throw Error('Use the discovered synthetic read tool and schema');if(!init.headers['Idempotency-Key'])throw Error('A stable idempotency key is required');data={id:'synthetic-'+flow.id,connector_id:flow.connectorId,status:'succeeded',result:{data:{records}}};}
   else throw Error('Unexpected fixture operation');return Response.json({data});
  }});
  const inventory=await client.getTools(flow.connectorId),tool=inventory.data.tools.find(t=>t.readOnly===true&&t.approvalRequired===false);if(!tool)throw Error('No fixture read tool discovered');
  receipt=(await client.callTool(flow.connectorId,tool.name,{limit:10},{integrationId:inventory.data.integration_id,connectionId:inventory.data.connection_id,idempotencyKey:'synthetic-read-'+flow.id})).data;if(receipt.status!=='succeeded')throw Error('Synthetic call did not complete');output=receipt.result.data.records;
 }else if(flow.transport==='leadadapter-mcp'){
  const client=new adapters.LeadAdapterMcpClient({apiKey:key,fetchImpl:async(raw,init)=>{validate(raw,init,'https://leadadapter.com');const msg=JSON.parse(init.body);if(msg.method==='notifications/initialized')return new Response(null,{status:202});let result;
   if(msg.method==='initialize')result={protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'synthetic-leadadapter',version:'1'}};
   else if(msg.method==='tools/list')result={tools:[{name:fakeName,description:flow.readTask.intent,inputSchema:{type:'object',properties:{limit:{type:'integer'}},required:['limit']},annotations:{readOnlyHint:true,destructiveHint:false}}]};
   else if(msg.method==='tools/call'){if(msg.params.name!==fakeName||msg.params.arguments.limit!==10)throw Error('Use the discovered MCP tool');result={content:[{type:'text',text:JSON.stringify({status:'succeeded',records})}],isError:false};}
   else throw Error('Unexpected MCP fixture method');return Response.json({jsonrpc:'2.0',id:msg.id,result});
  }});const tools=await client.listTools(),tool=tools.find(t=>t.annotations?.readOnlyHint===true);if(!tool)throw Error('No read-only tool');const called=await client.callTool(tool.name,{limit:10});if(called.isError)throw Error('Fixture MCP failed');receipt=JSON.parse(called.content[0].text);if(receipt.status!=='succeeded')throw Error('Fixture receipt not completed');output=receipt.records;
 }else{
  const client=new adapters.LeadAdapterClient({apiKey:key,fetch:async(raw,init)=>{const u=validate(raw,init,'https://leadadapter.com');if(init.method==='POST'){if(!init.headers['Idempotency-Key'])throw Error('Missing read request idempotency key');return Response.json({ok:true,job_id:'synthetic-job',status:'queued'});}if(init.method==='GET'&&u.pathname.endsWith('/jobs/synthetic-job'))return Response.json({ok:true,data:{job_id:'synthetic-job',status:'done',finished:true,result:{records}}});throw Error('Unexpected LeadAdapter fixture operation');}});
  const options={idempotencyKey:'synthetic-read-'+flow.id};let queued;
  if(flow.repositoryId==='linkedin-profile-api')queued=await client.profiles.enrich({public_id:'synthetic-person'},options);
  else if(flow.repositoryId==='linkedin-post-engagers')queued=await client.posts.engagers({post_urn:'urn:li:share:synthetic-post'},options);
  else queued=await client.people.search({keywords:['B2B software'],profile_id:'synthetic-profile'},options);
  const completed=await client.jobs.wait(queued.job_id,{timeoutMs:1000,intervalMs:1});if(completed.data.status!=='done')throw Error('Synthetic job not complete');receipt={status:'succeeded',jobId:completed.data.job_id};output=completed.data.result.records;
 }
 const selected=Array.isArray(output)?normalizeReviewRecords(flow,output).filter(row=>flow.synthetic.strategy==='score'?row[flow.synthetic.field]>=flow.synthetic.value:row[flow.synthetic.field]===flow.synthetic.value):[];
 return {schemaVersion:1,flowId:flow.id,repository:flow.repositoryId,title:flow.title,mode:'synthetic-demo',status:flow.transport==='private-import-preview'?'previewed':'completed',providerExecution:'not-run',authentication:'synthetic-fixture-only',source:'Invented task-shaped records; no customer or provider data',summary:{inputRecords:Array.isArray(output)?output.length:0,reviewRecords:selected.length,action:'review-only',writesExecuted:0},review:selected,...(!Array.isArray(output)?{preview:output}:{}),receipt:{status:receipt.status,digest:hash(receipt)},requestTrace:trace};
}
