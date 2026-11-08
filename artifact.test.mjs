import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync}from'node:child_process';
test('offline discovery plan does not invent MCP inventory',()=>{const p=JSON.parse(execFileSync(process.execPath,['example.mjs'],{encoding:'utf8'}));assert.equal(p.credential,'LEADADAPTER_API_KEY');assert.equal(p.mode,'dry-run');});
