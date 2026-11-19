/** Source-backed additions kept in the existing specs.attributes JSON object.
 * No frequency interval, sales-pack count or installed mass is inferred here.
 */
export type ReceiverFrequencyBand = {
  label: string;
  region: string;
  minMhz?: number;
  maxMhz?: number;
};
export type TechnicalAttributes = {
  weightBasis?: "per_item" | "per_package" | "installed_set" | "partial";
  weightScope?: string;
  weightUnitQuantity?: number;
  mountPatterns?: string[];
  motorSize?: number;
  receiverFrequencyBands?: ReceiverFrequencyBand[];
};
const keys = ["weightBasis", "weightScope", "weightUnitQuantity", "mountPatterns", "motorSize", "receiverFrequencyBands"];
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
export function normalizeMountPattern(value: string): string {
  return value.trim().toLowerCase().replace(/mm/g, "").replace(/[×*]/g, "x").replace(/\s/g, "");
}
export function parseTechnicalAttributes(value: unknown): TechnicalAttributes {
  if (!object(value) || Object.keys(value).some(k => !keys.includes(k))) throw new Error("Invalid technical attributes.");
  const result: TechnicalAttributes = {};
  if (["weightBasis", "weightScope", "weightUnitQuantity"].some(k => k in value)) {
    if (!["per_item", "per_package", "installed_set", "partial"].includes(String(value["weightBasis"])) ||
        typeof value["weightScope"] !== "string" || !value["weightScope"].trim() ||
        !positive(value["weightUnitQuantity"]) || !Number.isInteger(value["weightUnitQuantity"]) ||
        (value["weightBasis"] === "per_item" && value["weightUnitQuantity"] !== 1)) throw new Error("Explicit mass basis, scope and measured quantity are required.");
    result.weightBasis = value["weightBasis"] as NonNullable<TechnicalAttributes["weightBasis"]>;
    result.weightScope = value["weightScope"].trim(); result.weightUnitQuantity = value["weightUnitQuantity"];
  }
  if ("motorSize" in value) {
    if (!positive(value["motorSize"])) throw new Error("Invalid nominal motor size.");
    result.motorSize = value["motorSize"];
  }
  if ("mountPatterns" in value) {
    if (!Array.isArray(value["mountPatterns"]) || !value["mountPatterns"].length || value["mountPatterns"].some(v => typeof v !== "string" || !/^\d+(?:\.\d+)?x\d+(?:\.\d+)?$/.test(normalizeMountPattern(v)))) throw new Error("Invalid mounting alternatives.");
    result.mountPatterns = [...new Set(value["mountPatterns"].map(normalizeMountPattern))];
  }
  if ("receiverFrequencyBands" in value) {
    if (!Array.isArray(value["receiverFrequencyBands"]) || !value["receiverFrequencyBands"].length) throw new Error("Frequency bands must be explicit.");
    result.receiverFrequencyBands = value["receiverFrequencyBands"].map(b => {
      if (!object(b) || Object.keys(b).some(k => !["label", "region", "minMhz", "maxMhz"].includes(k)) ||
          typeof b["label"] !== "string" || !b["label"].trim() || typeof b["region"] !== "string" || !b["region"].trim() ||
          (("minMhz" in b || "maxMhz" in b) && (!positive(b["minMhz"]) || !positive(b["maxMhz"]) || b["minMhz"] > b["maxMhz"]))) throw new Error("Invalid regional frequency band.");
      return { label: b["label"].trim(), region: b["region"].trim(), ...(b["minMhz"] === undefined ? {} : { minMhz: b["minMhz"] as number, maxMhz: b["maxMhz"] as number }) };
    });
  }
  return result;
}
