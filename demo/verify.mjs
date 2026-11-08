/** Read-only account preflight and explicitly selected read proof. Never chooses customer operations itself. */
import{createHash}from'node:crypto';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const code=e=>typeof e?.code==='string'&&/^[A-Za-z0-9_:.-]{1,100}$/.test(e.code)?e.code:'account_preflight_failed';
export async function verifyRevenueFlow(flow,{adapters,env=process.env,executeRead=false,confirmReadOnly=false,tool,operation,arguments:args={},params={},idempotencyKey,fetchImpl}={}){
 const base={schemaVersion:1,flowId:flow.id,repository:flow.repositoryId,connectorId:flow.connectorId,sourceRevision:flow.sourceRevision,checkedAt:new Date().toISOString(),verificationMode:fetchImpl?'synthetic-contract':'authorized-account',providerExecution:'not-run',liveVerified:false};
 const blocked=(reason,details={})=>({...base,status:'blocked',blocker:reason,...details});
 const apiKey=env[flow.credential];if(!apiKey)return blocked('missing_product_key',{requiredAccess:[flow.credential],uncheckedPrerequisites:[flow.product==='leadadapter'?'Authorized connected LinkedIn profile':flow.connectorId==='custom-api'?'Reviewed published private API integration and connection':`Authorized ${flow.connectorId} connection in PipMCP`],message:`An authorized ${flow.product} workspace API key is required. No provider operation was attempted.`});
 if(executeRead&&confirmReadOnly!==true)return blocked('explicit_read_confirmation_required');
 const options={integrationId:env.PIPMCP_INTEGRATION_ID,connectionId:env.PIPMCP_CONNECTION_ID};
 if(flow.connectorId==='custom-api'&&!options.integrationId)return blocked('missing_published_private_api',{requiredAccess:['PIPMCP_INTEGRATION_ID'],message:'Review and publish a private API, configure its connection, and select its integration ID. Import drafts are not callable.'});
 try{
  let receipt,selected;
  if(flow.transport==='pipmcp-gateway'||flow.transport==='private-import-preview'){
   const client=new adapters.PipMCPGatewayClient({apiKey,...(fetchImpl?{fetchImpl}:{})}),inventory=await client.getTools(flow.connectorId,options);
   const tools=inventory.data?.tools;if(!Array.isArray(tools))return blocked('invalid_discovery_response');
   if(!executeRead)return {...base,status:'preflight-passed',operationExecuted:false,availableReadTools:tools.filter(t=>t.readOnly===true&&t.approvalRequired!==true).map(t=>t.name),message:'Authenticated discovery only; this is not provider execution or activation.'};
   if(!tool)return blocked('explicit_tool_selection_required');selected=tools.find(t=>t.name===tool);
   if(!selected)return blocked('selected_tool_unavailable');if(selected.readOnly!==true||selected.approvalRequired===true)return blocked('selected_tool_is_not_unapproved_read');
   if(typeof idempotencyKey!=='string'||!/^[A-Za-z0-9._:-]{16,200}$/.test(idempotencyKey))return blocked('stable_read_idempotency_key_required');
   receipt=(await client.callTool(flow.connectorId,selected.name,args,{...options,idempotencyKey})).data;
   if(receipt.status!=='succeeded')return {...base,status:'read-not-completed',receiptStatus:receipt.status,operation:selected.name,callId:receipt.id,automaticRetryAllowed:false};
  }else if(flow.transport==='leadadapter-mcp'){
   const client=new adapters.LeadAdapterMcpClient({apiKey,...(fetchImpl?{fetchImpl}:{})}),tools=await client.listTools();
   if(!executeRead)return {...base,status:'preflight-passed',operationExecuted:false,availableReadTools:tools.filter(t=>t.annotations?.readOnlyHint===true).map(t=>t.name),message:'Authorized MCP inventory only; this is not provider activation.'};
   selected=tools.find(t=>t.name===tool);if(!selected)return blocked('selected_tool_unavailable');if(selected.annotations?.readOnlyHint!==true)return blocked('selected_tool_is_not_read_only');
   const called=await client.callTool(selected.name,args);if(called.isError)return blocked('provider_read_refused');
   try{receipt=called.structuredContent??JSON.parse(called.content.find(c=>c.type==='text')?.text);}catch{return {...base,status:'read-outcome-unverified',operation:selected.name,message:'No recognizable completed provider receipt; no Live claim.'};}
   if(!['succeeded','done'].includes(receipt?.status??receipt?.data?.status))return {...base,status:'read-outcome-unverified',operation:selected.name};
  }else{
   const client=new adapters.LeadAdapterClient({apiKey,...(fetchImpl?{fetch:fetchImpl}:{})});
   if(!executeRead){await client.request('get_extension_status_get');return {...base,status:'preflight-passed',operationExecuted:false,message:'Account connection metadata checked only; LinkedIn reads still require an authorized connected profile and explicit task input.'};}
   if(!['search_post','enrich_post','list_post_engagers_post'].includes(operation))return blocked('explicit_supported_provider_read_required',{allowedOperations:['search_post','enrich_post','list_post_engagers_post']});
   if(params.body?.dry_run===true)return blocked('dry_run_is_not_provider_execution');const op=adapters.operations[operation];if(op.scope!=='api:read')return blocked('selected_operation_is_not_read_only');
   if(!idempotencyKey)return blocked('stable_read_idempotency_key_required');selected={name:operation};receipt=await client.request(operation,{...params,idempotencyKey});
   const jobId=receipt.job_id??receipt.data?.job_id;if(jobId)receipt=await client.jobs.wait(jobId,{timeoutMs:30000,intervalMs:1000});
   if(receipt.data?.finished!==true||receipt.data?.status!=='done'||receipt.data?.error||receipt.data?.result==null||receipt.data?.result?.ok===false)return {...base,status:'read-outcome-unverified',operation,automaticRetryAllowed:false};
  }
  return {...base,status:fetchImpl?'verified-contract-read':'verified-live-read',providerExecution:fetchImpl?'not-run':'succeeded',liveVerified:!fetchImpl,operation:selected.name,executedAt:new Date().toISOString(),responseDigest:digest(receipt),...(receipt.id?{callId:receipt.id}:{}),proofScope:'Exactly this authorized read and source revision; no write, onboarding conversion or broader provider parity claim.'};
 }catch(error){return blocked(code(error),{message:'Inspect product access, explicit connector/connection selection, scopes and account prerequisites. No automatic retry or write was attempted.'});}
}
