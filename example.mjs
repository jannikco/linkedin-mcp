/** Offline setup inspection by default; --live lists tools, never calls them. */
import {clientConfigs,checkConnection} from './lib/index.mjs';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('./integration.json',import.meta.url)));
const tokenEnv="LEADADAPTER_API_KEY";
const endpoint=process.env.PIPMCP_ENDPOINT || manifest.endpoint;
if (process.argv.includes('--setup') || !endpoint) {
 console.log(JSON.stringify({app:manifest.appName||manifest.title,appSlug:manifest.appSlug,authentication:manifest.authentication||{},providerDocs:manifest.providerDocs,providerWebsite:manifest.providerWebsite,setupUrl:"https://leadadapter.com/register?utm_source=github&utm_campaign=github-linkedin-mcp",requiredEnvironment:['PIPMCP_ENDPOINT',tokenEnv],note:'Connect provider credentials only in the hosted product. This utility never reads provider credential values.'},null,2));
 if (!endpoint || process.argv.includes('--setup')) process.exit(0);
}
if (process.argv.includes('--live')) console.log(JSON.stringify(await checkConnection({endpoint,token:process.env[tokenEnv]}),null,2));
else console.log(JSON.stringify(clientConfigs(endpoint,{name:manifest.id,tokenEnv}),null,2));
