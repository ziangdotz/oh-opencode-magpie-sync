import { Model, Plugin, Provider } from "@opencode/plugin";
import { catalogSignature, type MagpieModel } from "../core/catalog.js";
import { fetchCatalog, modelCatalogURL } from "../core/gateway.js";

const PROVIDER_ID = "magpie";
const PROVIDER_NAME = "Magpie Gateway";
const PROVIDER_PACKAGE = "@opencode/ai/providers/openai-compatible";
const KEY_ENV = "MAGPIE_GATEWAY_KEY";

const DEFAULT_REFRESH_SECONDS = 30;
const MIN_REFRESH_SECONDS = 10;
const MAX_REFRESH_SECONDS = 3600;
const DEFAULT_TIMEOUT_MS = 5000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30_000;

const KNOWN_OPTIONS = new Set(["baseURL", "gatewayKey", "refreshSeconds", "timeoutMs"]);

export interface MagpieOptions {
  readonly baseURL: string;
  readonly gatewayKey: string | undefined;
  readonly refreshSeconds: number;
  readonly timeoutMs: number;
}

/** JSON credentials win; the environment is trimmed to tolerate service-manager quoting. */
function resolveGatewayKey(config: MagpieOptions): string | undefined {
  if (config.gatewayKey) return config.gatewayKey;
  const fromEnvironment = process.env[KEY_ENV]?.trim();
  return fromEnvironment ? fromEnvironment : undefined;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

const SAFE_ERROR_PREFIXES = ["Magpie registry reload failed", `${KEY_ENV} missing`];

/**
 * Refresh errors reach host logs. Arbitrary fetch failures may include request
 * details, so only plugin-controlled messages are allowed through verbatim.
 */
function sanitizeRefreshError(error: unknown): Error {
  if (
    error instanceof Error &&
    SAFE_ERROR_PREFIXES.some((prefix) => error.message.startsWith(prefix))
  ) {
    return error;
  }
  return new Error("Magpie discovery unavailable; retaining catalog");
}

/**
 * Reads and validates plugin options. Invalid URLs fail setup before any provider
 * is registered, so a typo can never point inference at an unintended origin.
 */
export function readOptions(input: unknown): MagpieOptions {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  for (const key of Object.keys(obj)) {
    if (!KNOWN_OPTIONS.has(key)) {
      console.warn(`[magpie.sync] Ignoring unknown option "${key}"`);
    }
  }

  const requestedBaseURL = typeof obj.baseURL === "string" ? obj.baseURL.trim() : "";
  if (!requestedBaseURL) {
    throw new Error("Magpie baseURL is required");
  }
  // Validate first, then canonicalise. Keep any path prefix; never rewrite the proxy path.
  modelCatalogURL(requestedBaseURL);
  const baseURL = new URL(requestedBaseURL).href.replace(/\/+$/, "");

  const gatewayKey =
    typeof obj.gatewayKey === "string" && obj.gatewayKey.trim() ? obj.gatewayKey.trim() : undefined;

  return {
    baseURL,
    gatewayKey,
    refreshSeconds: clampInteger(
      obj.refreshSeconds,
      DEFAULT_REFRESH_SECONDS,
      MIN_REFRESH_SECONDS,
      MAX_REFRESH_SECONDS,
    ),
    timeoutMs: clampInteger(obj.timeoutMs, DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
  };
}

export default Plugin.define({
  id: "magpie.sync",
  async setup(ctx) {
    const config = readOptions(ctx.options);
    const providerID = Provider.ID.make(PROVIDER_ID);

    // The credential stays in memory or the server environment; it is never placed
    // in the provider definition, reload payloads or logs.
    const provider = {
      ...Provider.Info.empty(providerID),
      name: PROVIDER_NAME,
      activation: "enabled" as const,
      package: PROVIDER_PACKAGE,
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
      return {
        ...model,
        name: entry.name,
        modelID: Model.ID.make(entry.id),
        capabilities: { tools: false, input: ["text"], output: ["text"] },
        limit: {
          context: entry.contextWindow ?? 0,
          output: entry.maxOutputTokens ?? 0,
        },
      };
    }

    const registration = await ctx.provider.transform((editor) => {
      if (editor.get(providerID)) throw new Error("Magpie provider collision");
      editor.add({ info: provider, models: source.models });
    });

    // OpenCode 2.4 resolves provider credentials through the final request hook.
    // Scope it to this provider and re-check the destination before adding the key.
    const auth = await ctx.session.hook(
      "http.request",
      (event) => {
        if (event.model.providerID !== providerID) return;
        const target = new URL(event.request.url);
        const allowed = new URL(config.baseURL + "/");
        if (target.origin !== allowed.origin || !target.pathname.startsWith(allowed.pathname)) {
          throw new Error("Magpie request outside configured gateway");
        }
        const key = resolveGatewayKey(config);
        if (!key) throw new Error("Magpie gateway key unavailable");
        const headers = new Headers(event.request.headers);
        headers.set("Authorization", `Bearer ${key}`);
        event.request = new Request(event.request, { headers, redirect: "error" });
      },
      { providerID: PROVIDER_ID },
    );

    async function refresh(): Promise<void> {
      if (pending) return pending;
      if (stopped) return;
      pending = Promise.resolve()
        .then(async () => {
          const key = resolveGatewayKey(config);
          if (!key) throw new Error(`${KEY_ENV} missing from OpenCode server environment`);
          const models = await fetchCatalog({ ...config, key });
          if (stopped) return;
          // One transient empty response must not discard a working catalog.
          if (models.length === 0 && source.models.length > 0 && ++emptyCount < 2) return;
          if (models.length > 0) emptyCount = 0;
          const signature = catalogSignature(models);
          if (signature === currentSignature) return;
          const previous = source.models;
          source.models = models.map(toModel);
          try {
            await ctx.provider.reload();
          } catch {
            source.models = previous;
            throw new Error("Magpie registry reload failed");
          }
          currentSignature = signature;
          console.info(`[magpie.sync] Catalog synced: ${models.length} models`);
        })
        .catch((error: unknown) => {
          emptyCount = 0;
          throw sanitizeRefreshError(error);
        })
        .finally(() => {
          pending = undefined;
        });
      return pending;
    }

    // Offline startup is nonfatal; polling keeps retrying in the background.
    await refresh().catch((error: unknown) => {
      console.warn(
        `[magpie.sync] Initial discovery unavailable: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    });

    const timer = setInterval(() => {
      void refresh().catch((error: unknown) => {
        console.warn(
          `[magpie.sync] Refresh failed; keeping last catalog: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      });
    }, config.refreshSeconds * 1000);

    return async () => {
      stopped = true;
      clearInterval(timer);
      await pending?.catch(() => {});
      const results = await Promise.allSettled([auth.dispose(), registration.dispose()]);
      for (const result of results) {
        if (result.status === "rejected") {
          console.warn(
            `[magpie.sync] Cleanup step failed: ${
              result.reason instanceof Error ? result.reason.message : "unknown error"
            }`,
          );
        }
      }
    };
  },
});
