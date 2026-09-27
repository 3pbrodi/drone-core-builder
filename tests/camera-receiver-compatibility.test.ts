import { describe, expect, test } from "bun:test";

import { products, type Product } from "../src/lib/build-data";
import {
  evaluate,
  evaluateCompatibilityRules,
  type CompatibilityRuleCode,
  type CompatibilityVerification,
} from "../src/lib/build-calculations";
import { resolveBuildSelection } from "../src/lib/catalogue-service";
import { resolveStaticCompatibilityEvidence } from "../src/lib/static-catalogue-evidence";

function product(id: string): Product {
  const found = products.find((item) => item.id === id);
  if (!found) throw new Error(`Missing fixture product: ${id}`);
  return found;
}

function rule(
  selected: Parameters<typeof evaluateCompatibilityRules>[0],
  code: CompatibilityRuleCode,
  verification: CompatibilityVerification = {},
) {
  const found = evaluateCompatibilityRules(selected, verification).find(
    (item) => item.code === code,
  );
  if (!found) throw new Error(`Missing rule: ${code}`);
  return found;
}

const camera = product("cameraFpv");
const receiver = product("receiver");

function testFc(overrides: Partial<Product> = {}): Product {
  return {
    id: "test-only-fc",
    category: "flightController",
    name: "Test-only FC",
    spec: "Synthetic test fixture; not a catalogue product",
    price: 0,
    weight: 0,
    ...overrides,
  };
}

describe("camera compatibility data", () => {
  test("RunCam Phoenix 2 source-backed fields are present in the static catalogue", () => {
    expect(camera.cameraVideoInterface).toBe("analog");
    expect(camera.cameraMinVoltageV).toBe(5);
    expect(camera.cameraMaxVoltageV).toBe(36);
    expect(camera.cameraWidthMm).toBe(19);
    expect(camera.cameraHeightMm).toBe(19);
    expect(camera.cameraDepthMm).toBe(19);
  });

  test("live camera + current FC remains unknown because FC camera interface data are missing", () => {
    const selected = resolveBuildSelection({
      flightController: "fcF7",
      camera: "cameraFpv",
    });
    const evidence = resolveStaticCompatibilityEvidence(selected);
    const rules = evaluateCompatibilityRules(
      selected,
      evidence.verification,
      evidence.technicalEvidence,
    );

    const interfaceRule = rules.find(
      (item) => item.code === "CAMERA_FC_VIDEO_INTERFACE",
    );
    const powerRule = rules.find((item) => item.code === "CAMERA_FC_POWER");

    expect(interfaceRule?.status).toBe("unknown");
    expect(interfaceRule?.missingFields).toContain(
      "flightController.fcCameraVideoInterfaces",
    );
    expect(powerRule?.status).toBe("unknown");
    expect(powerRule?.missingFields).toContain(
      "flightController.fcCameraPowerVoltagesV",
    );
  });

  test("camera interface and power can produce verified passes with complete verified fixture data", () => {
    const fc = testFc({
      fcCameraVideoInterfaces: ["analog", "digital"],
      fcCameraPowerVoltagesV: [5, 10],
    });
    const verification: CompatibilityVerification = {
      camera: [
        "cameraVideoInterface",
        "cameraMinVoltageV",
        "cameraMaxVoltageV",
      ],
      flightController: [
        "fcCameraVideoInterfaces",
        "fcCameraPowerVoltagesV",
      ],
    };

    expect(
      rule(
        { camera, flightController: fc },
        "CAMERA_FC_VIDEO_INTERFACE",
        verification,
      ).status,
    ).toBe("pass");
    expect(
      rule(
        { camera, flightController: fc },
        "CAMERA_FC_POWER",
        verification,
      ).status,
    ).toBe("pass");
    expect(
      rule(
        { camera, flightController: fc },
        "CAMERA_FC_POWER",
        verification,
      ).evidenceLevel,
    ).toBe("verified");
  });

  test("camera verified failures require verified FC and camera evidence", () => {
    const fc = testFc({
      fcCameraVideoInterfaces: ["digital"],
      fcCameraPowerVoltagesV: [3.3],
    });
    const verification: CompatibilityVerification = {
      camera: [
        "cameraVideoInterface",
        "cameraMinVoltageV",
        "cameraMaxVoltageV",
      ],
      flightController: [
        "fcCameraVideoInterfaces",
        "fcCameraPowerVoltagesV",
      ],
    };

    const interfaceRule = rule(
      { camera, flightController: fc },
      "CAMERA_FC_VIDEO_INTERFACE",
      verification,
    );
    const powerRule = rule(
      { camera, flightController: fc },
      "CAMERA_FC_POWER",
      verification,
    );

    expect(interfaceRule.status).toBe("fail");
    expect(interfaceRule.evidenceLevel).toBe("verified");
    expect(powerRule.status).toBe("fail");
    expect(powerRule.evidenceLevel).toBe("verified");
  });

  test("unverified camera/FC values cannot create a confirmed build incompatibility", () => {
    const fc = testFc({
      fcCameraVideoInterfaces: ["digital"],
      fcCameraPowerVoltagesV: [3.3],
    });
    const result = evaluate({ camera, flightController: fc });

    expect(
      result.rules.find(
        (item) => item.code === "CAMERA_FC_VIDEO_INTERFACE",
      )?.status,
    ).toBe("fail");
    expect(result.status).toBe("potentially-compatible");
  });
});

describe("receiver compatibility data", () => {
  test("Crossfire Nano RX source-backed interface, frequency, and voltage fields are present", () => {
    expect(receiver.receiverProtocol).toBe("TBS Crossfire");
    expect(receiver.receiverSignalInterface).toBe("CRSF");
    expect(receiver.receiverFrequencyMinMhz).toBe(868);
    expect(receiver.receiverFrequencyMaxMhz).toBe(915);
    expect(receiver.receiverMinVoltageV).toBe(3.3);
    expect(receiver.receiverMaxVoltageV).toBe(8.4);
  });

  test("live receiver + current FC remains unknown because FC receiver integration data are missing", () => {
    const selected = resolveBuildSelection({
      flightController: "fcF7",
      receiver: "receiver",
    });
    const evidence = resolveStaticCompatibilityEvidence(selected);
    const rules = evaluateCompatibilityRules(
      selected,
      evidence.verification,
      evidence.technicalEvidence,
    );

    const interfaceRule = rules.find(
      (item) => item.code === "RECEIVER_FC_SIGNAL_INTERFACE",
    );
    const powerRule = rules.find((item) => item.code === "RECEIVER_FC_POWER");

    expect(interfaceRule?.status).toBe("unknown");
    expect(interfaceRule?.missingFields).toContain(
      "flightController.fcReceiverSignalInterfaces",
    );
    expect(powerRule?.status).toBe("unknown");
    expect(powerRule?.missingFields).toContain(
      "flightController.fcReceiverPowerVoltagesV",
    );
  });

  test("receiver signal and power can produce verified passes with complete verified fixture data", () => {
    const fc = testFc({
      fcReceiverSignalInterfaces: ["CRSF", "SBUS"],
      fcReceiverPowerVoltagesV: [5],
    });
    const verification: CompatibilityVerification = {
      receiver: [
        "receiverSignalInterface",
        "receiverMinVoltageV",
        "receiverMaxVoltageV",
      ],
      flightController: [
        "fcReceiverSignalInterfaces",
        "fcReceiverPowerVoltagesV",
      ],
    };

    expect(
      rule(
        { receiver, flightController: fc },
        "RECEIVER_FC_SIGNAL_INTERFACE",
        verification,
      ).status,
    ).toBe("pass");
    expect(
      rule(
        { receiver, flightController: fc },
        "RECEIVER_FC_POWER",
        verification,
      ).status,
    ).toBe("pass");
  });

  test("receiver verified failures require verified interface and voltage evidence", () => {
    const fc = testFc({
      fcReceiverSignalInterfaces: ["SBUS"],
      fcReceiverPowerVoltagesV: [12],
    });
    const verification: CompatibilityVerification = {
      receiver: [
        "receiverSignalInterface",
        "receiverMinVoltageV",
        "receiverMaxVoltageV",
      ],
      flightController: [
        "fcReceiverSignalInterfaces",
        "fcReceiverPowerVoltagesV",
      ],
    };

    const interfaceRule = rule(
      { receiver, flightController: fc },
      "RECEIVER_FC_SIGNAL_INTERFACE",
      verification,
    );
    const powerRule = rule(
      { receiver, flightController: fc },
      "RECEIVER_FC_POWER",
      verification,
    );

    expect(interfaceRule.status).toBe("fail");
    expect(interfaceRule.evidenceLevel).toBe("verified");
    expect(powerRule.status).toBe("fail");
    expect(powerRule.evidenceLevel).toBe("verified");
  });
});
