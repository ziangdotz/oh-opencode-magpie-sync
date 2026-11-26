import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(process.env.OPENCODE_TEST_ROOT ?? '.host/smoke');
const packageRoot = resolve(process.env.OPENCODE_TEST_PACKAGE ?? '.');
const isolatedEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(OPENCODE_|MAGPIE_|XDG_)/i.test(key)));
await mkdir(root, {recursive:true});
const allowInference = process.argv.includes('--inference');
let requests=0;
let inference=0;
const server=createServer(async (req,res)=>{
  requests++;
  if(req.headers.authorization !== 'Bearer mock-only-key') {res.writeHead(401);res.end();return;}
  res.setHeader('content-type','application/json');
  if(req.url === '/v1/chat/completions') {
    if (!allowInference) { inference++; res.writeHead(403); res.end(); return; }
    let body=''; for await (const chunk of req) body+=chunk;
    const input=JSON.parse(body);
    if(input.model !== 'remote-magpie/cursor/mock') {res.writeHead(400);res.end();return;}
    inference++;
    res.setHeader('content-type','text/event-stream');
    for(const delta of [{role:'assistant',content:'mock gateway reply'},{ }])
      res.write(`data: ${JSON.stringify({id:'mock',object:'chat.completion.chunk',created:1,model:input.model,choices:[{index:0,delta,finish_reason:delta.content?null:'stop'}]})}\n\n`);
    res.end('data: [DONE]\n\n'); return;
  }
  if (req.method !== 'GET' || req.url !== '/v1/models') { res.writeHead(404); res.end(); return; }
  res.end(JSON.stringify({data:[{id:'remote-magpie/cursor/mock',context_window:32768,max_output_tokens:4096}]}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const config=resolve(root,'opencode.json');
await writeFile(config,JSON.stringify({plugins:[{package:pathToFileURL(packageRoot).href,options:{baseURL:`http://127.0.0.1:${server.address().port}/v1`}}]}));
try {
  async function run(args) {
  const child=spawn(process.env.OPENCODE_BIN ?? 'opencode', args, {cwd:root,env:{...isolatedEnv,OPENCODE_CONFIG:config,OPENCODE_CONFIG_DIR:resolve(root,'config/opencode'),XDG_STATE_HOME:resolve(root,'state'),XDG_CONFIG_HOME:resolve(root,'config'),XDG_DATA_HOME:resolve(root,'data'),XDG_CACHE_HOME:resolve(root,'cache'),OPENCODE_CONFIG_CONTENT:JSON.stringify({}),MAGPIE_GATEWAY_KEY:'mock-only-key'},windowsHide:true});
  child.stdin.end();
  let output='';
  child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
  const timer=setTimeout(()=>{
    if(process.platform==='win32') spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    else child.kill();
  },30000);
  const code=await new Promise((r,j)=>{child.on('exit',r);child.on('error',j)});
  clearTimeout(timer);
  // No real key is used; output is safe to retain for diagnostics.
  await writeFile(resolve(root,'result.txt'),output,{flag:'a'});
  return {code,output};
  }
  const {code,output}=await run(['models','--standalone']);
  if(code!==0 || !requests || !output.includes('magpie/remote-magpie/cursor/mock')) throw new Error(`Host smoke failed (exit ${code}, discovery requests ${requests}); see .host/smoke/result.txt`);
  console.log('OpenCode loaded local package and listed authenticated nested model ID');
  if (!allowInference) {
    if (inference !== 0) throw new Error('Unexpected inference request in discovery-only validation');
    console.log('Discovery-only validation: zero inference requests');
    process.exitCode=0;
  }
  else {
  const completion=await run(['run','--standalone','--model','magpie/remote-magpie/cursor/mock','Reply hello']);
  if(completion.code!==0 || !inference || !completion.output.includes('mock gateway reply')) throw new Error('Host inference failed; see .host/smoke/result.txt');
  console.log('OpenCode streaming inference authenticated and preserved wire model ID');
  }
} finally { await new Promise(r=>server.close(r)); }
