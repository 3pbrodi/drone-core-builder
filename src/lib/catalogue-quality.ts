import type { Category } from "./build-data";

export type CatalogueIdentityStatus =
  "verified" | "partially-verified" | "unverified" | "conflicting";

export type CatalogueTechnicalStatus =
  "verified" | "partially-verified" | "unverified" | "conflicting";

export type CatalogueImageStatus =
  "verified-exact-model" | "partially-verified" | "unverified" | "missing";

export type CatalogueProductKind = "standalone" | "bundle" | "unknown";

export type CatalogueEvidenceSource = {
  id: string;
  sourceType: "manufacturer" | "retailer" | "internal";
  sourceName: string;
  url?: string;
  checkedAt: string;
  exactModelAssociation: boolean;
  supports: string[];
};

export type CatalogueQualityReview = {
  productId: string;
  category: Category;
  identityStatus: CatalogueIdentityStatus;
  technicalStatus: CatalogueTechnicalStatus;
  imageStatus: CatalogueImageStatus;
  productKind: CatalogueProductKind;
  manufacturer?: string;
  exactModel?: string;
  variant?: string;
  priceStatus: "illustrative";
  issues: string[];
  remediation: string[];
  humanReviewRequired: boolean;
  sourceIds: string[];
};

const checkedAt = "2026-09-28";

export const catalogueEvidenceSources: readonly CatalogueEvidenceSource[] = [
  {
    id: "iflight-evoque-f5-v2",
    sourceType: "manufacturer",
    sourceName: "iFlight",
    url: "https://shop.iflight.com/Evoque-F5-V2-Frame-Kit-Pro1887",
    checkedAt,
    exactModelAssociation: true,
    supports: [
      "identity",
      "motor mounting 16x16 mm",
      "flight-stack mounting 20x20 mm",
      "frame dimensions",
      "weight range",
    ],
  },
  {
    id: "tmotor-f60-pro-v",
    sourceType: "manufacturer",
    sourceName: "T-Motor",
    url: "https://store.tmotor.com/product/f60prov-fpv-motor.html",
    checkedAt,
    exactModelAssociation: false,
    supports: [
      "F60 PRO V product family",
      "1750/1950/2020/2550 KV variants",
      "variant-specific voltage",
      "variant-specific peak current",
      "variant-specific weight",
    ],
  },
  {
    id: "iflight-blitz-f7-v12",
    sourceType: "manufacturer",
    sourceName: "iFlight",
    url: "https://shop.iflight.com/product-cat123/BLITZ-F7-Flight-Controller-Pro1692?limit=15",
    checkedAt,
    exactModelAssociation: false,
    supports: [
      "BLITZ F7 V1.2 standalone flight-controller identity",
      "mount pattern",
      "dimensions",
      "weight",
      "UART count",
      "BEC outputs",
    ],
  },
  {
    id: "iflight-blitz-f7-stack",
    sourceType: "manufacturer",
    sourceName: "iFlight",
    url: "https://shop.iflight.com/BLITZ-F7-Stack-E55-4-IN-1-ESC-Pro1695",
    checkedAt,
    exactModelAssociation: false,
    supports: [
      "BLITZ F7 stack bundle identity",
      "stack includes BLITZ F7 V1.2 FC and E55 4-in-1 ESC",
      "E55 ESC 2-6S support",
      "E55 ESC continuous and burst current",
    ],
  },
  {
    id: "tmotor-f55a-pro-ii",
    sourceType: "manufacturer",
    sourceName: "T-Motor",
    url: "https://store.tmotor.com/product/f55a-pro-v2-4in1-fpv-esc.html",
    checkedAt,
    exactModelAssociation: true,
    supports: ["F55A Pro II identity", "55 A rating", "3-6S support", "4-in-1 ESC identity"],
  },
  {
    id: "hqprop-35-catalogue",
    sourceType: "manufacturer",
    sourceName: "HQProp",
    url: "https://www.hqprop.com/c/35quot-0402",
    checkedAt,
    exactModelAssociation: false,
    supports: [
      "current 3.5-inch HQProp catalogue",
      "absence of an exact T3.5x3.0x3 listing in the accessible manufacturer catalogue",
    ],
  },
  {
    id: "cnhl-black-1500-6s-130c",
    sourceType: "manufacturer",
    sourceName: "ChinaHobbyLine",
    url: "https://chinahobbyline.com/de/collections/cnhl-black-series-lipo-batteries/products/2-packs-cnhl-black-series-v2-0-1500mah-22-2v-6s-130c-lipo-battery-with-xt60-plug",
    checkedAt,
    exactModelAssociation: false,
    supports: [
      "current Black Series V2.0 1500mAh 6S identity",
      "130C continuous / 260C burst rating",
      "XT60 connector",
      "dimensions",
      "weight",
    ],
  },
  {
    id: "runcam-phoenix-2",
    sourceType: "manufacturer",
    sourceName: "RunCam",
    url: "https://shop.runcam.com/runcam-phoenix-2/",
    checkedAt,
    exactModelAssociation: true,
    supports: [
      "RunCam Phoenix 2 identity",
      "analog PAL/NTSC signal",
      "5-36V power range",
      "weight",
      "dimensions",
    ],
  },
  {
    id: "tbs-crossfire-nano-rx",
    sourceType: "manufacturer",
    sourceName: "Team BlackSheep",
    url: "https://www.team-blacksheep.com/products/prod:crossfire_nano_rx",
    checkedAt,
    exactModelAssociation: true,
    supports: [
      "TBS Crossfire Nano RX identity",
      "CRSF signal format",
      "868-915 MHz frequency range",
      "3.3-8.4V input range",
      "weight",
      "dimensions",
    ],
  },
] as const;

export const catalogueQualityReviews: readonly CatalogueQualityReview[] = [
  {
    productId: "frame5",
    category: "frame",
    identityStatus: "verified",
    technicalStatus: "partially-verified",
    imageStatus: "missing",
    productKind: "standalone",
    manufacturer: "iFlight",
    exactModel: "Nazgul Evoque F5 V2 Frame Kit",
    priceStatus: "illustrative",
    issues: [
      "The static record does not distinguish F5X Squashed X from F5D DeadCat geometry.",
      "The static 245 g weight is within one published manufacturer tolerance range but is not tied to a selected geometry.",
    ],
    remediation: [
      "Preserve the stable ID.",
      "Add geometry/revision identity before treating weight and physical dimensions as exact.",
      "Keep 16x16 mm motor mounting source-backed.",
    ],
    humanReviewRequired: true,
    sourceIds: ["iflight-evoque-f5-v2"],
  },
  {
    productId: "frame7",
    category: "frame",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["Explorer 7 is a generic demo identity with no manufacturer/model source."],
    remediation: [
      "Retain as an explicitly unverified demo record until a real product identity is selected.",
    ],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "frame3",
    category: "frame",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: [
      "Cinewhoop 3-inch Frame is a generic demo identity with no exact source-backed model.",
    ],
    remediation: ["Retain as an explicitly unverified demo record."],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "motors5",
    category: "motors",
    identityStatus: "conflicting",
    technicalStatus: "conflicting",
    imageStatus: "partially-verified",
    productKind: "standalone",
    manufacturer: "T-Motor",
    exactModel: "F60 PRO V",
    priceStatus: "illustrative",
    issues: [
      "The static name includes 2020 while the spec says 1950 KV.",
      "Manufacturer data lists 1950KV and 2020KV as distinct variants with different weight and peak-current values.",
      "The static 38 A current does not match the accessible manufacturer peak-current value for either the 1950KV or 2020KV variant.",
    ],
    remediation: [
      "Do not choose the variant from the current name/spec conflict.",
      "Resolve the intended KV variant before canonical promotion.",
      "Treat current and thrust values as unverified until tied to documented operating conditions.",
    ],
    humanReviewRequired: true,
    sourceIds: ["tmotor-f60-pro-v"],
  },
  {
    productId: "motors7",
    category: "motors",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["Long-Range 2806.5 1300KV Motor is a generic demo identity."],
    remediation: ["Retain as unverified until an exact manufacturer/model is chosen."],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "motors3",
    category: "motors",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["1404 Cine Motor is a generic demo identity."],
    remediation: ["Retain as unverified until an exact manufacturer/model is chosen."],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "fcF7",
    category: "flightController",
    identityStatus: "partially-verified",
    technicalStatus: "conflicting",
    imageStatus: "missing",
    productKind: "standalone",
    manufacturer: "iFlight",
    exactModel: "BLITZ F7",
    priceStatus: "illustrative",
    issues: [
      "iFlight currently documents a standalone BLITZ F7 V1.2 Flight Controller.",
      "The static spec describes this record as a Flight Controller + ESC Stack even though the category and build flows treat it as a standalone FC.",
      "The static record does not identify the exact revision.",
      "The existing connector and battery-range values are not sufficiently source-backed for verified compatibility.",
    ],
    remediation: [
      "Keep the category as Flight Controller.",
      "Resolve the intended BLITZ F7 revision before canonical promotion.",
      "Remove bundle wording only when the intended standalone revision is confirmed.",
    ],
    humanReviewRequired: true,
    sourceIds: ["iflight-blitz-f7-v12", "iflight-blitz-f7-stack"],
  },
  {
    productId: "fcF4",
    category: "flightController",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["Compact F4 Controller is a generic demo identity."],
    remediation: ["Retain as an explicitly unverified demo record."],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "esc55",
    category: "esc",
    identityStatus: "verified",
    technicalStatus: "partially-verified",
    imageStatus: "verified-exact-model",
    productKind: "standalone",
    manufacturer: "T-Motor",
    exactModel: "F55A Pro II 4-in-1 ESC",
    priceStatus: "illustrative",
    issues: [
      "Manufacturer evidence supports 55 A and 3-6S.",
      "The static 8-pin connector label and 18 g weight were not established from the accessible manufacturer text used in this review.",
    ],
    remediation: [
      "Keep 55 A and 3-6S as source-backed fields.",
      "Leave connector/pinout and weight unverified until exact documentation is captured.",
    ],
    humanReviewRequired: true,
    sourceIds: ["tmotor-f55a-pro-ii"],
  },
  {
    productId: "esc20",
    category: "esc",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["BLHeli_S 20A ESC is a generic demo identity."],
    remediation: ["Retain as unverified until an exact ESC model is selected."],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "props5",
    category: "propellers",
    identityStatus: "conflicting",
    technicalStatus: "conflicting",
    imageStatus: "missing",
    productKind: "standalone",
    manufacturer: "HQProp",
    exactModel: "T3.5x3.0x3",
    priceStatus: "illustrative",
    issues: [
      "The product name implies a 3.5-inch propeller while the typed propInches value is 5.",
      "The accessible HQProp 3.5-inch manufacturer catalogue does not show an exact T3.5x3.0x3 listing.",
      "The static spec text says 5-inch demo clearance and should not be treated as manufacturer evidence.",
    ],
    remediation: [
      "Do not silently change the diameter to either 3.5 or 5 inches.",
      "Resolve the exact manufacturer product identity first; otherwise retain as an unverified demo record.",
    ],
    humanReviewRequired: true,
    sourceIds: ["hqprop-35-catalogue"],
  },
  {
    productId: "props7",
    category: "propellers",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["7x3.5 Tri-Blade has no manufacturer/model identity in the static catalogue."],
    remediation: ["Retain as unverified until an exact propeller model is chosen."],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "props3",
    category: "propellers",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "standalone",
    manufacturer: "Gemfan",
    exactModel: "D76 5-Blade",
    priceStatus: "illustrative",
    issues: [
      "An exact accessible manufacturer listing matching D76 5-Blade was not established during this review.",
    ],
    remediation: ["Keep the record unverified until exact manufacturer documentation is captured."],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "battery6",
    category: "battery",
    identityStatus: "conflicting",
    technicalStatus: "conflicting",
    imageStatus: "missing",
    productKind: "standalone",
    manufacturer: "CNHL",
    exactModel: "Black Series 1500mAh 6S",
    priceStatus: "illustrative",
    issues: [
      "The static record says 150C.",
      "The accessible current CNHL Black Series 1500mAh 6S product is documented as 130C continuous / 260C burst.",
      "A separate CNHL Speedy Pizza Pro 1500mAh 6S product exists at 150C, so the 150C number cannot be reassigned to Black Series without evidence.",
    ],
    remediation: [
      "Do not change the C rating by inference.",
      "Resolve whether this stable ID represents an older Black Series revision or a mistaken demo value.",
    ],
    humanReviewRequired: true,
    sourceIds: ["cnhl-black-1500-6s-130c"],
  },
  {
    productId: "battery6long",
    category: "battery",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["Li-ion 6S 4000mAh Pack is a generic demo identity."],
    remediation: [
      "Retain as unverified until chemistry, cell construction, connector, dimensions, and manufacturer/model are sourced.",
    ],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "battery4",
    category: "battery",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["4S 850mAh 100C LiPo is a generic demo identity."],
    remediation: ["Retain as unverified until an exact product is selected."],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "cameraFpv",
    category: "camera",
    identityStatus: "verified",
    technicalStatus: "partially-verified",
    imageStatus: "verified-exact-model",
    productKind: "standalone",
    manufacturer: "RunCam",
    exactModel: "Phoenix 2",
    priceStatus: "illustrative",
    issues: [
      "Manufacturer evidence supports PAL/NTSC analog video, 5-36V power, 9 g weight, and 19 mm-class dimensions.",
      "The live Product type cannot yet represent camera voltage range, dimensions, or interface details.",
    ],
    remediation: [
      "Preserve identity and image provenance; normalize camera-specific fields in a later evidence-aware schema phase.",
    ],
    humanReviewRequired: false,
    sourceIds: ["runcam-phoenix-2"],
  },
  {
    productId: "camera4k",
    category: "camera",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["Action Camera 4K Module is a generic demo identity."],
    remediation: [
      "Retain as unverified; do not equate 4K recording capability with an FPV video interface.",
    ],
    humanReviewRequired: true,
    sourceIds: [],
  },
  {
    productId: "receiver",
    category: "receiver",
    identityStatus: "verified",
    technicalStatus: "partially-verified",
    imageStatus: "verified-exact-model",
    productKind: "standalone",
    manufacturer: "Team BlackSheep",
    exactModel: "TBS Crossfire Nano RX",
    priceStatus: "illustrative",
    issues: [
      "Manufacturer evidence supports CRSF, 868-915 MHz, 3.3-8.4V input, and 0.5 g weight.",
      "The static spec text mentions only 915 MHz and therefore does not represent the full documented frequency range.",
      "The live Product type has no typed receiver protocol, frequency, voltage, or interface fields.",
    ],
    remediation: [
      "Normalize receiver-specific fields in the later camera/receiver data phase; retain exact identity and source-backed image.",
    ],
    humanReviewRequired: false,
    sourceIds: ["tbs-crossfire-nano-rx"],
  },
  {
    productId: "receiver2",
    category: "receiver",
    identityStatus: "unverified",
    technicalStatus: "unverified",
    imageStatus: "missing",
    productKind: "unknown",
    priceStatus: "illustrative",
    issues: ["Demo ELRS Receiver 2.4GHz is explicitly a generic demo identity."],
    remediation: ["Retain as unverified until an exact receiver model is selected."],
    humanReviewRequired: true,
    sourceIds: [],
  },
] as const;

export const catalogueQualityById = new Map(
  catalogueQualityReviews.map((review) => [review.productId, review]),
);
