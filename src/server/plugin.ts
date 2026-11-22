import { Model, Plugin, Provider } from "@opencode/plugin";
import { catalogSignature, type MagpieModel } from "../core/catalog.js";
import { fetchCatalog, modelCatalogURL } from "../core/gateway.js";

const PROVIDER_ID = "magpie";
const DEFAULT_URL = "http://192.168.22.100:3425/v1";
const KEY_ENV = "MAGPIE_GATEWAY_KEY";

function options(input: unknown) {
  const obj = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const baseURL = typeof obj.baseURL === "string" ? obj.baseURL : DEFAULT_URL;
  const gatewayKey = typeof obj.gatewayKey === "string" && obj.gatewayKey.trim()
    ? obj.gatewayKey : undefined;
  const refreshSeconds =
    typeof obj.refreshSeconds === "number" && Number.isInteger(obj.refreshSeconds)
      ? Math.max(10, Math.min(3600, obj.refreshSeconds))
      : 30;
  const timeoutMs =
    typeof obj.timeoutMs === "number" && Number.isInteger(obj.timeoutMs)
      ? Math.max(1000, Math.min(30000, obj.timeoutMs))
      : 5000;
  modelCatalogURL(baseURL); // Validate before registering provider.
  return { baseURL: baseURL.replace(/\/+$/, ""), gatewayKey, refreshSeconds, timeoutMs };
}

export default Plugin.define({
  id: "magpie.sync",
  async setup(ctx) {
    const config = options(ctx.options);
    const providerID = Provider.ID.make(PROVIDER_ID);
    // Credential stays in the environment, not the provider definition or logs.
    const provider = {
      ...Provider.Info.empty(providerID),
      name: "Magpie Gateway",
      activation: "enabled" as const,
      package: "@opencode/ai/providers/openai-compatible",
      settings: { baseURL: config.baseURL },
    };

    type ModelInfo = Model.Info;
    const source: { models: ModelInfo[] } = { models: [] };
    let currentSignature: string | undefined;
    let pending: Promise<void> | undefined;
    let stopped = false;
    let emptyCount = 0;

    function toModel(entry: MagpieModel): ModelInfo {
      const model = Model.Info.default(providerID, Model.ID.make(entry.id));
      return { ...model, name: entry.name, modelID: Model.ID.make(entry.id),
        capabilities: { tools: false, input: ["text"], output: ["text"] },
        limit: { context: entry.contextWindow ?? 0, output: entry.maxOutputTokens ?? 0 } };
    }

    const registration = await ctx.provider.transform((editor) => {
      if (editor.get(providerID)) throw new Error("Magpie provider collision");
      editor.add({ info: provider, models: source.models });
    });
    // SDK 2.3.2 has no Provider.Info.env. Use its documented final HTTP hook.
    const auth = await ctx.session.hook("http.request", (event) => {
      if (event.model.providerID !== providerID) return;
      const target = new URL(event.request.url);
      const allowed = new URL(config.baseURL + "/");
      if (target.origin !== allowed.origin || !target.pathname.startsWith(allowed.pathname))
        throw new Error("Magpie request outside configured gateway");
      const key = config.gatewayKey ?? process.env[KEY_ENV];
      if (!key) throw new Error("Magpie gateway key unavailable");
      const headers = new Headers(event.request.headers);
      headers.set("Authorization", `Bearer ${key}`);
      event.request = new Request(event.request, { headers, redirect: "error" });
    });

    async function refresh(): Promise<void> {
      if (pending) return pending;
      if (stopped) return;
      pending = Promise.resolve().then(async () => {
        const key = config.gatewayKey ?? process.env[KEY_ENV];
        if (!key) throw new Error(`${KEY_ENV} missing from OpenCode server environment`);
        const models = await fetchCatalog({ ...config, key });
        if (stopped) return;
        // Avoid discarding an existing catalog after one transient empty response.
        if (models.length === 0 && source.models.length > 0 && ++emptyCount < 2) return;
        if (models.length > 0) emptyCount = 0;
        const signature = catalogSignature(models);
        if (signature === currentSignature) return;
        const previous = source.models;
        source.models = models.map(toModel);
        try { await ctx.provider.reload(); } catch { source.models = previous; throw new Error("Magpie registry reload failed"); }
        currentSignature = signature;
        console.info(`[magpie.sync] Catalog synced: ${models.length} models`);
      }).catch(() => { emptyCount = 0; throw new Error("Magpie discovery unavailable; retaining catalog"); }).finally(() => { pending = undefined; });
      return pending;
    }

    // Offline startup remains nonfatal. Polling handles later reconnection.
    await refresh().catch((err: unknown) => {
      console.warn(`[magpie.sync] Initial discovery unavailable: ${err instanceof Error ? err.message : "unknown error"}`);
    });
    const timer = setInterval(() => {
      void refresh().catch((err: unknown) => {
        console.warn(`[magpie.sync] Refresh failed; keeping last catalog: ${err instanceof Error ? err.message : "unknown error"}`);
      });
    }, config.refreshSeconds * 1000);

    return async () => {
      stopped = true;
      clearInterval(timer);
      await pending?.catch(() => {});
      await auth.dispose();
      await registration.dispose();
    };
  },
});
