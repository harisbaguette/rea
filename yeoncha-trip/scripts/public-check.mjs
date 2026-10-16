import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const base=new URL(arg('--base','https://air.bluekite.co.kr'));
assert.ok(['http:','https:'].includes(base.protocol)&&!base.username&&!base.password);
const results=[];
async function check(path,status,verify,headers={}){
  const response=await fetch(new URL(path,base),{redirect:'manual',signal:AbortSignal.timeout(20000),headers});
  assert.equal(response.status,status,`${path}: 예상 ${status}, 실제 ${response.status}`);
  const body=await response.text();if(verify)verify(response,body);
  results.push({path,status:response.status});
}
for(const path of ['/api/health','/api/routes','/api/overview','/api/flights','/api/history','/api/itineraries'])await check(path,401,(r,b)=>{assert.equal(JSON.parse(b).error.code,'AUTH_REQUIRED');assert.match(r.headers.get('cache-control'),/no-store/);});
if(base.hostname==='air.bluekite.co.kr'){
  for(const path of ['/?view=saved','/api/health'])await check(`http://${base.host}${path}`,308,r=>assert.equal(r.headers.get('location'),`https://${base.host}${path}`));
}
for(const path of ['/','/index.html','/about.html','/src/app.js','/assets/brand/favicon.svg','/assets/brand/og-cover.webp','/.env','/.openai/hosting.json','/server/api.js','/api/book'])await check(path,303,r=>{assert.match(r.headers.get('location'),/^\/auth\/login/);assert.match(r.headers.get('cache-control'),/no-store/);});
await check('/auth/login',200,(r,b)=>{assert.match(b,/비밀번호로 입장/);assert.match(r.headers.get('content-security-policy'),/script-src 'nonce-/);assert.equal(r.headers.get('x-frame-options'),'DENY');assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);if(base.protocol==='https:')assert.match(r.headers.get('strict-transport-security'),/max-age=/);});
await check('/robots.txt',200,(_,b)=>assert.match(b,/Disallow: \//));
const result={passed:true,base:base.origin,anonymous:true,checks:results};
const output=arg('--output','artifacts/public-check.json');await mkdir('artifacts',{recursive:true});await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,anonymous:true,checks:results.length,output}));
