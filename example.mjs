import {LeadAdapterMcpClient} from './lib/index.mjs';
if(!process.argv.includes('--live'))console.log(JSON.stringify({mode:'dry-run',endpoint:'https://leadadapter.com/mcp',credential:'LEADADAPTER_API_KEY',discovery:'actual remote tools/list'}));
else {const client=new LeadAdapterMcpClient({apiKey:process.env.LEADADAPTER_API_KEY});try{console.log(JSON.stringify(await client.listTools(),null,2));}finally{await client.close();}}
