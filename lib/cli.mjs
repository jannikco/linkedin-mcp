#!/usr/bin/env node
import{startBridge}from'./index.mjs';
if(process.argv.includes('--help'))process.stdout.write('LeadAdapter MCP0.3: set LEADADAPTER_API_KEY and launch this command as a stdio MCP server. Remote endpoint is fixed to https://leadadapter.com/mcp. No PipMCP key is used.\n');
else try{if(!process.env.LEADADAPTER_API_KEY)throw new Error('Set LEADADAPTER_API_KEY to an owned workspace API key.');startBridge();}catch(error){console.error(error.message);process.exitCode=1;}
