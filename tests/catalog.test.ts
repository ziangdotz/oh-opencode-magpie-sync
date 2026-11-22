import { describe, expect, it } from "vitest";
import { parseCatalog, catalogSignature } from "../src/core/catalog.js";
import { modelCatalogURL } from "../src/core/gateway.js";

describe("Magpie model catalog", () => {
  it("prefers the complete Magpie label without altering nested route IDs", () => {
    const [model] = parseCatalog({data:[{id:"remote-magpie/cursor/x",magpie_label:"Model X · 完整分组名称",name:"X",display_name:"Short X"}]});
    expect(model.name).toBe("Model X · 完整分组名称");
    expect(model.id).toBe("remote-magpie/cursor/x");
    expect(parseCatalog({data:[{id:"x",magpie_label:"\u001b[31m",display_name:"Safe"}]} )[0].name).toBe("Safe");
  });
  it("accepts Magpie's generic model type", () => {
    expect(parseCatalog({data:[{id:"trae-cn/example",type:"model"}]}).map(m=>m.id)).toEqual(["trae-cn/example"]);
  });
  it("preserves exact IDs, sorts, and captures known limits", () => {
    const result = parseCatalog({ data: [
      { id: "cursor/gpt-x", name: "X", context_window: 100000, max_output_tokens: 8192 },
      { id: "group/auto", display_name: "Automatic route" },
    ] });
    expect(result.map((x) => x.id)).toEqual(["cursor/gpt-x", "group/auto"]);
    expect(result[0].contextWindow).toBe(100000);
    expect(result[1].name).toBe("Automatic route");
  });

  it("rejects malformed catalogs and duplicates", () => {
    expect(() => parseCatalog({ data: {} })).toThrow();
    expect(() => parseCatalog({ data: [{ id: "x" }, { id: "x" }] })).toThrow();
    expect(() => parseCatalog({ data: [{ id: "evil#variant" }] })).toThrow();
  });

  it("does not show explicit non-chat models", () => {
    expect(parseCatalog({ data: [
      { id: "embed", type: "embedding" },
      { id: "talk", type: "chat" },
    ] }).map((x) => x.id)).toEqual(["talk"]);
  });

  it("signatures ignore API list order", () => {
    const a = parseCatalog({ data: [{ id: "b" }, { id: "a" }] });
    const b = parseCatalog({ data: [{ id: "a" }, { id: "b" }] });
    expect(catalogSignature(a)).toBe(catalogSignature(b));
  });
});

describe("gateway URL", () => {
  it("keeps remote API prefix", () => {
    expect(modelCatalogURL("http://192.168.22.100:3425/v1")).toBe("http://192.168.22.100:3425/v1/models");
    expect(modelCatalogURL("https://example.test/prefix/v1/")).toBe("https://example.test/prefix/v1/models");
  });
  it("rejects embedded credentials", () => {
    expect(() => modelCatalogURL("https://alice:secret@example.test/v1")).toThrow();
  });
});
