import { expect, test } from "bun:test";
import evidence from "../qa/step5-four-products-source-evidence.json";

const required: Record<string, string[]> = {
  battery: ["batteryMah", "voltage"],
  propellers: ["propInches"],
  receiver: [
    "receiverProtocol", "receiverSignalInterface",
    "receiverFrequencyMinMhz", "receiverFrequencyMaxMhz",
    "receiverMinVoltageV", "receiverMaxVoltageV",
  ],
  esc: ["escAmps", "escInput", "minVoltage", "maxVoltage"],
};
const rows = evidence.candidates;

test("Step 5 covers exactly four distinct candidate categories and 13 mandatory fields", () => {
  expect(rows).toHaveLength(4);
  expect(rows.map((row) => row.category).sort()).toEqual(Object.keys(required).sort());
  expect(rows.map((row) => row.candidate_id).every((id) => id.startsWith("qa-"))).toBe(true);
  const total = rows.reduce((count, row) =>
    count + Object.keys(row.required_field_evidence).length, 0);
  expect(total).toBe(13);
  expect(total).toBe(evidence.db_required_fields_count);
  for (const row of rows) {
    expect(Object.keys(row.required_field_evidence).sort()).toEqual(
      required[row.category as keyof typeof required].slice().sort()
    );
  }
});

test("No record, field or merchant offer pretends to be database verified", () => {
  expect(evidence.production_permission).toBe(false);
  expect(evidence.publication_permission).toBe(false);
  expect(evidence.ui_image_reuse_permission).toBe(false);
  for (const row of rows) {
    expect(row.image_rights.verified).toBe(false);
    expect(row.offers.length).toBeGreaterThan(0);
    expect(row.offers.every((offer) => offer.offer_verified === false)).toBe(true);
    expect(row.publication_blockers).toContain("identity_reviewer_signoff");
    expect(row.publication_blockers).toContain("fresh_exact_eu_offer_verification");
    expect(row.publication_blockers).toContain("explicit_owner_approval");
    for (const item of Object.values(row.required_field_evidence)) {
      expect(item.verification_status).toBe("pending_review");
      expect(item.source.startsWith("https://")).toBe(true);
    }
  }
});

test("CNHL 3S single-pack SKU must not merge with Production's 6S", () => {
  const item = rows.find((row) => row.category === "battery")!;
  expect(item.manufacturer_sku).toBe("1301303BK");
  expect(item.manufacturer_sku).not.toBe("1301306BK");
  expect(item.package_quantity).toBe(1);
  expect(item.required_field_evidence.voltage.value).toBe(11.1);
  expect(item.required_field_evidence.batteryMah.value).toBe(1300);
});

test("ETHIX P2 uses manufacturer code, not a 13-digit GTIN, and rejects stale stock", () => {
  const item = rows.find((row) => row.category === "propellers")!;
  expect(item.manufacturer_sku).toBe("EthixP2-PK-PC");
  expect(item.gtin).toBe("9313448340470");
  expect(item.gtin).not.toBe(item.manufacturer_sku);
  expect(item.package_quantity).toBe(4);
  expect(item.required_field_evidence.propInches.value).toBe(5.1);
  const rotorama = item.offers.find((offer) => offer.merchant === "Rotorama")!;
  expect(rotorama.stock_from_search).toBe("out_of_stock");
  expect(rotorama.offer_verified).toBe(false);
});

test("TBS SE receiver has exact protocol and antenna bundle identity", () => {
  const item = rows.find((row) => row.category === "receiver")!;
  expect(item.variant).toContain("Special Edition");
  expect(item.supplementary.antenna.value).toContain("Immortal T V2");
  expect(item.required_field_evidence.receiverSignalInterface.value).toBe("CRSF");
  expect(item.required_field_evidence.receiverProtocol.value).toBe("TBS Crossfire");
  expect(item.offers[0].merchant_sku).toBe("TBS_CROSS_NANO_SE");
});

test("ESC input describes FC connection, never DShot signal protocol", () => {
  const item = rows.find((row) => row.category === "esc")!;
  expect(item.required_field_evidence.escInput.value).toContain("8-pin JST-SH");
  expect(item.required_field_evidence.escInput.value).not.toMatch(/DShot/);
  expect(item.required_field_evidence.minVoltage.provenance).toContain("DERIVED");
  expect(item.required_field_evidence.maxVoltage.provenance).toContain("DERIVED");
  expect(item.supplementary.esc_protocol.value).toContain("DShot");
  expect(item.offers[0].stock_from_search).toBe("conflicting");
  expect(item.publication_blockers).toContain("conflicting_shop_stock");
});

test("Every researched product still fails the publication release gate", () => {
  for (const row of rows) {
    expect(row.publication_blockers.length).toBeGreaterThanOrEqual(5);
    expect(row.image_rights.verified).toBe(false);
    expect(row.publication_blockers).toContain("explicit_owner_approval");
  }
});
