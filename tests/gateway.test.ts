import { afterEach, expect, it, vi } from "vitest";
import { fetchCatalog } from "../src/core/gateway.js";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
afterEach(() => vi.unstubAllGlobals());
it.each([401,403,500])("rejects HTTP %s without response secrets", async status => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("secret", {status})));
  await expect(fetchCatalog({baseURL:"http://127.0.0.1/v1", key:"secret", timeoutMs:10})).rejects.toThrow(`HTTP ${status}`);
});
it("rejects malformed payload", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({data:null})));
  await expect(fetchCatalog({baseURL:"http://127.0.0.1/v1",key:"secret",timeoutMs:10})).rejects.toThrow();
});
it("bounds timeout and refuses authenticated redirects", async () => {
  let redirected = false;
  const server=createServer((req,res)=>{
    if(req.url==='/slow/models') return;
    if(req.url==='/target') {redirected=true;res.end('{}');return;}
    res.writeHead(302,{location:'/target'}); res.end();
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await expect(fetchCatalog({baseURL:url+'/slow',key:'secret',timeoutMs:20})).rejects.toThrow();
    await expect(fetchCatalog({baseURL:url,key:'secret',timeoutMs:1000})).rejects.toThrow();
    expect(redirected).toBe(false);
  } finally { server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r())); }
});
