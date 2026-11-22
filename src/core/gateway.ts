import { parseCatalog, type MagpieModel } from "./catalog.js";

export interface GatewayConfig {
  baseURL: string;
  key: string;
  timeoutMs: number;
}

/** Use the configured /v1 path. Do not silently rewrite proxy prefixes. */
export function modelCatalogURL(baseURL: string): string {
  const url = new URL(baseURL);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Magpie gateway must use http or https");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Magpie gateway URL must not contain credentials, query or fragment");
  }
  return new URL("models", url.href.replace(/\/+$/, "") + "/").href;
}

export async function fetchCatalog(config: GatewayConfig): Promise<MagpieModel[]> {
  const res = await fetch(modelCatalogURL(config.baseURL), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.key}`,
      Accept: "application/json",
    },
    redirect: "error",
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  // Never include response body or request headers in errors: they may contain sensitive data.
  if (!res.ok) throw new Error(`Magpie catalog HTTP ${res.status}`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > 8 * 1024 * 1024) throw new Error("Magpie catalog too large");
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Magpie catalog body missing");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024) throw new Error("Magpie catalog too large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("Invalid Magpie JSON"); }
  return parseCatalog(payload);
}
