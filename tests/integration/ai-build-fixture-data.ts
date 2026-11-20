// Synthetic-only planner and browser data. No database connection.
import type { Product, Category } from "../../src/lib/build-data";
import type { CatalogueEvidenceSnapshot } from "../../src/lib/catalogue-evidence";
const stamp = "2026-11-19T00:00:00Z";
export function fixture() {
  const make = (category: Category, extra: Partial<Product> = {}): Product => ({
    id: "synthetic-" + category,
    category,
    name: "Synthetic " + category,
    model: "Synthetic exact model",
    manufacturer: "Fixture maker",
    variant: "Black",
    packageQuantity: 1,
    price: 10,
    weight: 2,
    weightBasis: "per_item",
    weightScope: "complete synthetic component",
    weightUnitQuantity: 1,
    spec: "Synthetic test fixture only",
    offer: {
      freshness: "stale",
      url: "https://example.invalid/item",
      merchantName: "Synthetic EU retailer",
      merchantHost: "example.invalid",
      checkedAt: stamp,
      currency: "EUR",
      region: "EU",
    },
    ...extra,
  });
  const products = [
    make("frame", { frameInches: 5, mount: "16x16", weight: 40 }),
    make("motors", {
      motorSize: 2207,
      motorKv: 1950,
      mount: "16x16",
      minVoltage: 4,
      maxVoltage: 6,
      current: 30,
    }),
    make("propellers", { propInches: 5, packageQuantity: 4 }),
    make("battery", { voltage: 6, batteryMah: 1300, batteryConnector: "XT60", weight: 100 }),
    make("flightController", {
      minVoltage: 4,
      maxVoltage: 6,
      connector: "8pin",
      fcCameraVideoInterfaces: ["analog"],
      fcCameraPowerVoltagesV: [5],
      fcReceiverSignalInterfaces: ["CRSF"],
      fcReceiverPowerVoltagesV: [5],
      fcPeripheralInterfaces: ["UART"],
      fcPeripheralPowerVoltagesV: [5],
    }),
    make("esc", { escAmps: 60, escInput: "8pin", minVoltage: 4, maxVoltage: 6 }),
    make("camera", {
      cameraVideoInterface: "analog",
      video: "analog",
      cameraMinVoltageV: 5,
      cameraMaxVoltageV: 12,
    }),
    make("receiver", {
      receiverProtocol: "ELRS",
      receiverSignalInterface: "CRSF",
      receiverMinVoltageV: 5,
      receiverMaxVoltageV: 5,
    }),
    make("videoTransmitter", {
      videoTransmitterSystem: "analog",
      vtxCameraVideoInterfaces: ["analog"],
      vtxAntennaConnector: "U.FL",
      vtxFrequencyMinMhz: 5362,
      vtxFrequencyMaxMhz: 5945,
    }),
    make("antenna", {
      antennaConnector: "U.FL",
      antennaFrequencyMinMhz: 5362,
      antennaFrequencyMaxMhz: 5945,
    }),
    make("gps", { deviceSignalInterface: "UART", deviceMinVoltageV: 5, deviceMaxVoltageV: 5 }),
  ];
  return { products, make };
}
export function proofs(products: Product[]): CatalogueEvidenceSnapshot {
  const fields = products.flatMap((p) =>
    Object.entries(p)
      .filter(
        ([k]) =>
          !["offer", "id", "name", "category", "manufacturer", "model", "variant", "spec"].includes(
            k,
          ),
      )
      .map(([field, value]) => ({
        productId: p.id,
        field: field as keyof Product,
        value: value as any,
        sourceId: "synthetic-primary",
        sourceUrl: "https://example.invalid/proof",
        authority: "manufacturer" as const,
        exactModelAssociation: true,
        verificationStatus: "verified" as const,
        retrievedAt: stamp,
        verifiedAt: stamp,
      })),
  );
  const motors = products.filter((p) => p.category === "motors"),
    props = products.filter((p) => p.category === "propellers"),
    esc = products.filter((p) => p.category === "esc"),
    fc = products.filter((p) => p.category === "flightController");
  const verified = {
    verificationStatus: "verified" as const,
    retrievedAt: stamp,
    verifiedAt: stamp,
    exactProductsVerified: true,
  };
  return {
    fields,
    motorPropeller: motors.flatMap((m) =>
      props.map((p) => ({
        ...verified,
        motorId: m.id,
        propellerId: p.id,
        result: "compatible" as const,
        authority: "manufacturer" as const,
        operatingConditions: { synthetic: true },
      })),
    ),
    motorEscCurrent: motors.flatMap((m) =>
      esc.map((e) => ({
        ...verified,
        motorId: m.id,
        escId: e.id,
        motorCurrentAmps: m.current!,
        escCurrentAmps: e.escAmps!,
        motorRatingType: "continuous" as const,
        escRatingType: "continuous" as const,
        ratingTypesVerified: true,
        motorOperatingConditionsVerified: true,
        operatingConditions: { synthetic: true },
      })),
    ),
    fcEscConnection: fc.flatMap((f) =>
      esc.map((e) => ({
        ...verified,
        flightControllerId: f.id,
        escId: e.id,
        result: "compatible" as const,
        authority: "manufacturer" as const,
        connectorFamilyVerified: true,
        pinoutVerified: true,
        wireOrderVerified: true,
        signalCompatibilityVerified: true,
        voltageCompatibilityVerified: true,
      })),
    ),
  };
}
