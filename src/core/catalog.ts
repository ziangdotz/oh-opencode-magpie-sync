/** Minimal trusted representation of Magpie's OpenAI-compatible catalog. */
export interface MagpieModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxOutputTokens?: number;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

/** Strict enough to avoid accidentally replacing a valid catalog with malformed data. */
export function parseCatalog(payload: unknown): MagpieModel[] {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("Invalid Magpie model catalog: missing data");
  }
  const { data } = payload as { data: unknown };
  if (!Array.isArray(data)) {
    throw new Error("Invalid Magpie model catalog: data must be an array");
  }

  const byID = new Map<string, MagpieModel>();
  for (const raw of data) {
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid Magpie model catalog: item is not an object");
    }
    const m = raw as Record<string, unknown>;
    if (typeof m.id !== "string" || !m.id.trim() || m.id !== m.id.trim() || m.id.includes("#") || /[\x00-\x1f\x7f]/.test(m.id)) {
      throw new Error("Invalid Magpie model catalog: unsafe model ID");
    }
    // Non-chat models should not appear in OpenCode's session selector.
    // Magpie's generic catalog entries use type "model", not "chat".
    if (typeof m.type === "string" && m.type !== "chat" && m.type !== "model") continue;
    const name =
      (typeof m.magpie_label === "string" && m.magpie_label.trim() && !/[\x00-\x1f\x7f]/.test(m.magpie_label) ? m.magpie_label : undefined) ??
      (typeof m.name === "string" && m.name.trim() ? m.name : undefined) ??
      (typeof m.display_name === "string" && m.display_name.trim() ? m.display_name : undefined) ??
      m.id;
    const entry: MagpieModel = {
      id: m.id,
      name,
      contextWindow: positiveInteger(m.context_window),
      maxOutputTokens: positiveInteger(m.max_output_tokens),
    };
    // Duplicate IDs are invalid; otherwise we might silently select a different route.
    if (byID.has(m.id)) throw new Error("Duplicate Magpie model ID");
    byID.set(m.id, entry);
  }
  return [...byID.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function catalogSignature(models: readonly MagpieModel[]): string {
  return JSON.stringify(models);
}
