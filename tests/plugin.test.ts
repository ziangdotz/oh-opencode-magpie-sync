import { afterEach, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Plugin } from "@opencode/plugin";
import plugin from "../src/index.js";
import { readOptions } from "../src/server/plugin.js";

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("discovers over HTTP, authenticates inference and disposes", async () => {
  let payload: unknown = { data: [{ id: "remote-magpie/cursor/x" }] };
  let status = 200;
  let discoveryAuth = "";
  const server = createServer((req, res) => {
    discoveryAuth = req.headers.authorization ?? "";
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/prefix/v1`;
  vi.stubEnv("MAGPIE_GATEWAY_KEY", "environment-fallback-not-selected");
  let transform: Parameters<Plugin.Context["provider"]["transform"]>[0] | undefined;
  let hook: Parameters<Plugin.Context["session"]["hook"]>[1] | undefined;
  let hookOptions: unknown;
  const dispose = vi.fn(async () => {});
  const snapshots: unknown[] = [];
  const reload = vi.fn(async () => {
    await transform?.({ get: () => undefined, add: (value: unknown) => snapshots.push(value) } as never);
  });
  const ctx = { options: { baseURL, refreshSeconds: 10, gatewayKey: "test-secret" }, provider: {
    transform: async (fn: typeof transform) => { transform = fn; return { dispose }; }, reload,
  }, session: { hook: async (_: string, fn: typeof hook, opts?: unknown) => { hook = fn; hookOptions = opts; return { dispose }; } } };
  let cleanup: (() => Promise<void>) | undefined;
  try {
    cleanup = await plugin.setup(ctx as unknown as Plugin.Context) as typeof cleanup;
    expect(discoveryAuth).toBe("Bearer test-secret");
    expect(hookOptions).toEqual({ providerID: "magpie" });
    expect(JSON.stringify(snapshots)).toContain('"modelID":"remote-magpie/cursor/x"');
    expect(() =>
      transform?.({ get: () => ({}), add: () => {} } as never),
    ).toThrow("Magpie provider collision");
    const event = { model: { providerID: "magpie" }, request: new Request(baseURL + "/chat/completions", { method: "POST", body: JSON.stringify({ model: "remote-magpie/cursor/x" }) }) };
    type HttpEvent = typeof event;
    await (hook as unknown as (input: HttpEvent) => void)(event);
    expect(event.request.headers.get("authorization")).toBe("Bearer test-secret");
    expect(event.request.redirect).toBe("error");
    expect((await event.request.json()).model).toBe("remote-magpie/cursor/x");
  } finally { await cleanup?.(); await new Promise<void>(resolve => server.close(() => resolve())); }
  expect(dispose).toHaveBeenCalledTimes(2);
});

it("polls without overlap, ignores order, retains on errors, confirms empties and recovers", async () => {
  vi.useFakeTimers();
  vi.stubEnv("MAGPIE_GATEWAY_KEY", "secret-value");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  let payload: unknown = {data:[{id:"b"},{id:"a"}]};
  let fail = false;
  let release: (() => void) | undefined;
  const fetcher = vi.fn(async () => {
    if (release) await new Promise<void>(resolve => { release = resolve; });
    if (fail) throw new Error("secret-value");
    return Response.json(payload);
  });
  vi.stubGlobal("fetch", fetcher);
  const reload = vi.fn(async () => {});
  const dispose = vi.fn(async () => {});
  const ctx = {options:{baseURL:"http://127.0.0.1/v1"}, provider:{transform:async () => ({dispose}),reload}, session:{hook:async () => ({dispose})}};
  const cleanup = await plugin.setup(ctx as unknown as Plugin.Context) as () => Promise<void>;
  const poll = () => vi.advanceTimersByTimeAsync(30000);
  try {
    expect(reload).toHaveBeenCalledTimes(1);
    payload = {data:[{id:"a"},{id:"b"}]}; await poll();
    expect(reload).toHaveBeenCalledTimes(1);
    fail=true; await poll(); await poll();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.flat().join()).not.toContain("secret-value");
    fail=false; payload={data:[{id:"c"}]}; await poll();
    expect(reload).toHaveBeenCalledTimes(2);
    payload={data:[]}; await poll(); expect(reload).toHaveBeenCalledTimes(2);
    await poll(); expect(reload).toHaveBeenCalledTimes(3);
    payload={data:null}; await poll(); expect(reload).toHaveBeenCalledTimes(3);
    reload.mockRejectedValueOnce(new Error("secret-value"));
    payload={data:[{id:"after-reload-failure"}]};
    await poll(); expect(reload).toHaveBeenCalledTimes(4);
    expect(warn.mock.calls.flat().join()).toContain("Magpie registry reload failed");
    await poll(); expect(reload).toHaveBeenCalledTimes(5);
    release=()=>{};
    const before=fetcher.mock.calls.length;
    await poll(); await poll(); expect(fetcher.mock.calls.length).toBe(before+1);
    release?.(); release=undefined; await vi.advanceTimersByTimeAsync(0);
  } finally { await cleanup(); warn.mockRestore(); }
  const calls=fetcher.mock.calls.length; await poll(); expect(fetcher.mock.calls.length).toBe(calls);
});

it("reports a safe missing-key diagnostic without contacting the gateway", async () => {
  vi.stubEnv("MAGPIE_GATEWAY_KEY", "");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const dispose = vi.fn(async () => {});
  const ctx = {
    options: { baseURL: "http://127.0.0.1/v1" },
    provider: { transform: async () => ({ dispose }), reload: vi.fn(async () => {}) },
    session: { hook: async () => ({ dispose }) },
  };
  let cleanup: (() => Promise<void>) | undefined;
  try {
    cleanup = await plugin.setup(ctx as unknown as Plugin.Context) as typeof cleanup;
    expect(fetcher).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join()).toContain("MAGPIE_GATEWAY_KEY missing");
  } finally {
    await cleanup?.();
    warn.mockRestore();
  }
});

it("normalises options, clamps ranges and warns about unknown keys", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const config = readOptions({
      baseURL: "  https://example.test/proxy/v1/  ",
      gatewayKey: "  secret  ",
      refreshSeconds: 1,
      timeoutMs: 99_999,
      typo: true,
    });
    expect(config).toEqual({
      baseURL: "https://example.test/proxy/v1",
      gatewayKey: "secret",
      refreshSeconds: 10,
      timeoutMs: 30_000,
    });
    expect(warn).toHaveBeenCalledWith('[magpie.sync] Ignoring unknown option "typo"');
  } finally {
    warn.mockRestore();
  }
});

it("rejects unsafe or missing gateway URLs before registering a provider", async () => {
  await expect(
    plugin.setup({ options: {} } as unknown as Plugin.Context),
  ).rejects.toThrow("baseURL is required");
  await expect(
    plugin.setup({ options: { baseURL: "ftp://example.test/v1" } } as unknown as Plugin.Context),
  ).rejects.toThrow("http or https");
  await expect(
    plugin.setup({
      options: { baseURL: "https://alice:secret@example.test/v1" },
    } as unknown as Plugin.Context),
  ).rejects.toThrow("must not contain credentials");
});
