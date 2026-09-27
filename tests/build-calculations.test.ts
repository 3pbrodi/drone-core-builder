import { describe, expect, test } from "bun:test";
import {
  aiPreset,
  categories,
  presets,
  products,
  type Product,
} from "../src/lib/build-data";
import {
  candidateCheck,
  deriveCompatibilityStatus,
  evaluate,
  evaluateCompatibilityRules,
  type CompatibilityRuleCode,
  type CompatibilityRuleResult,
  type CompatibilityVerification,
} from "../src/lib/build-calculations";
import {
  normalizeBuildSelection,
  productCatalogue,
  resolveBuildSelection,
} from "../src/lib/catalogue-service";

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
    (result) => result.code === code,
  );
  if (!found) throw new Error(`Missing rule result: ${code}`);
  return found;
}

const frame5 = product("frame5");
const frame3 = product("frame3");
const motors5 = product("motors5");
const motors3 = product("motors3");
const props5 = product("props5");
const props3 = product("props3");
const battery6 = product("battery6");
const battery4 = product("battery4");
const fcF7 = product("fcF7");
const fcF4 = product("fcF4");
const esc55 = product("esc55");
const esc20 = product("esc20");
const cameraFpv = product("cameraFpv");

describe("structured compatibility rules", () => {
  test("frame / motor mount reports pass, fail, and missing data", () => {
    const verification: CompatibilityVerification = {
      frame: ["mount"],
      motors: ["mount"],
    };

    const passing = rule(
      { frame: frame5, motors: motors5 },
      "FRAME_MOTOR_MOUNT",
      verification,
    );
    expect(passing.status).toBe("pass");
    expect(passing.evidenceLevel).toBe("verified");

    const failing = rule(
      { frame: frame5, motors: motors3 },
      "FRAME_MOTOR_MOUNT",
      verification,
    );
    expect(failing.status).toBe("fail");
    expect(failing.evidenceLevel).toBe("verified");

    const { mount: _mount, ...motorsWithoutMount } = motors5;
    const missing = rule(
      { frame: frame5, motors: motorsWithoutMount },
      "FRAME_MOTOR_MOUNT",
      verification,
    );
    expect(missing.status).toBe("unknown");
    expect(missing.missingFields).toContain("motors.mount");
  });

  test("frame / propeller clearance reports pass, fail, and missing data", () => {
    const verification: CompatibilityVerification = {
      frame: ["frameInches"],
      propellers: ["propInches"],
    };

    expect(
      rule(
        { frame: frame5, propellers: props5 },
        "FRAME_PROPELLER_CLEARANCE",
        verification,
      ).status,
    ).toBe("pass");

    expect(
      rule(
        { frame: frame3, propellers: props5 },
        "FRAME_PROPELLER_CLEARANCE",
        verification,
      ).status,
    ).toBe("fail");

    const { propInches: _propInches, ...propsWithoutDiameter } = props5;
    const missing = rule(
      { frame: frame5, propellers: propsWithoutDiameter },
      "FRAME_PROPELLER_CLEARANCE",
      verification,
    );
    expect(missing.status).toBe("unknown");
    expect(missing.missingFields).toContain("propellers.propInches");
  });

  test("motor / propeller size remains heuristic instead of becoming a verified pass", () => {
    const suggestedPass = rule(
      { motors: motors5, propellers: props5 },
      "MOTOR_PROPELLER_SIZE_GUIDANCE",
    );
    expect(suggestedPass.status).toBe("unknown");
    expect(suggestedPass.evidenceLevel).toBe("heuristic");
    expect(suggestedPass.advisoryOutcome).toBe("pass");

    const suggestedFail = rule(
      { motors: motors3, propellers: props5 },
      "MOTOR_PROPELLER_SIZE_GUIDANCE",
    );
    expect(suggestedFail.status).toBe("unknown");
    expect(suggestedFail.evidenceLevel).toBe("heuristic");
    expect(suggestedFail.advisoryOutcome).toBe("fail");

    const { motorSize: _motorSize, ...motorsWithoutSize } = motors5;
    const missing = rule(
      { motors: motorsWithoutSize, propellers: props5 },
      "MOTOR_PROPELLER_SIZE_GUIDANCE",
    );
    expect(missing.status).toBe("unknown");
    expect(missing.missingFields).toContain("motors.motorSize");
  });

  test("battery / motor voltage reports pass, fail, and missing data", () => {
    const verification: CompatibilityVerification = {
      battery: ["voltage"],
      motors: ["minVoltage", "maxVoltage"],
    };

    expect(
      rule(
        { battery: battery6, motors: motors5 },
        "BATTERY_MOTOR_VOLTAGE",
        verification,
      ).status,
    ).toBe("pass");

    expect(
      rule(
        { battery: battery6, motors: motors3 },
        "BATTERY_MOTOR_VOLTAGE",
        verification,
      ).status,
    ).toBe("fail");

    const { maxVoltage: _maxVoltage, ...motorsWithoutMaximum } = motors5;
    const missing = rule(
      { battery: battery6, motors: motorsWithoutMaximum },
      "BATTERY_MOTOR_VOLTAGE",
      verification,
    );
    expect(missing.status).toBe("unknown");
    expect(missing.missingFields).toContain("motors.maxVoltage");
  });

  test("battery / ESC voltage reports pass, fail, and missing data", () => {
    const verification: CompatibilityVerification = {
      battery: ["voltage"],
      esc: ["minVoltage", "maxVoltage"],
    };

    expect(
      rule(
        { battery: battery6, esc: esc55 },
        "BATTERY_ESC_VOLTAGE",
        verification,
      ).status,
    ).toBe("pass");

    expect(
      rule(
        { battery: battery6, esc: esc20 },
        "BATTERY_ESC_VOLTAGE",
        verification,
      ).status,
    ).toBe("fail");

    const { minVoltage: _minVoltage, ...escWithoutMinimum } = esc55;
    const missing = rule(
      { battery: battery6, esc: escWithoutMinimum },
      "BATTERY_ESC_VOLTAGE",
      verification,
    );
    expect(missing.status).toBe("unknown");
    expect(missing.missingFields).toContain("esc.minVoltage");
  });

  test("battery / flight-controller voltage reports pass, fail, and missing data", () => {
    const verification: CompatibilityVerification = {
      battery: ["voltage"],
      flightController: ["minVoltage", "maxVoltage"],
    };

    expect(
      rule(
        { battery: battery6, flightController: fcF7 },
        "BATTERY_FC_VOLTAGE",
        verification,
      ).status,
    ).toBe("pass");

    expect(
      rule(
        { battery: battery6, flightController: fcF4 },
        "BATTERY_FC_VOLTAGE",
        verification,
      ).status,
    ).toBe("fail");

    const { voltage: _voltage, ...batteryWithoutCells } = battery6;
    const missing = rule(
      { battery: batteryWithoutCells, flightController: fcF7 },
      "BATTERY_FC_VOLTAGE",
      verification,
    );
    expect(missing.status).toBe("unknown");
    expect(missing.missingFields).toContain("battery.voltage");
  });

  test("FC / ESC connector comparison preserves pass/fail guidance but never claims verified evidence", () => {
    const passing = rule(
      { flightController: fcF7, esc: esc55 },
      "FC_ESC_CONNECTOR",
    );
    expect(passing.status).toBe("pass");
    expect(passing.evidenceLevel).toBe("unverified");
    expect(passing.unverifiedFields).toContain("flightController.connectorPinout");

    const failing = rule(
      { flightController: fcF7, esc: esc20 },
      "FC_ESC_CONNECTOR",
    );
    expect(failing.status).toBe("fail");
    expect(failing.evidenceLevel).toBe("unverified");

    const { escInput: _escInput, ...escWithoutInput } = esc55;
    const missing = rule(
      { flightController: fcF7, esc: escWithoutInput },
      "FC_ESC_CONNECTOR",
    );
    expect(missing.status).toBe("unknown");
    expect(missing.missingFields).toContain("esc.escInput");
  });

  test("motor / ESC current comparison preserves warnings but cannot produce verified evidence", () => {
    const passing = rule(
      { motors: motors5, esc: esc55 },
      "MOTOR_ESC_CURRENT",
    );
    expect(passing.status).toBe("pass");
    expect(passing.evidenceLevel).toBe("unverified");
    expect(passing.unverifiedFields).toContain("motors.currentOperatingConditions");

    const failing = rule(
      { motors: motors5, esc: esc20 },
      "MOTOR_ESC_CURRENT",
    );
    expect(failing.status).toBe("fail");
    expect(failing.evidenceLevel).toBe("unverified");

    const { current: _current, ...motorsWithoutCurrent } = motors5;
    const missing = rule(
      { motors: motorsWithoutCurrent, esc: esc55 },
      "MOTOR_ESC_CURRENT",
    );
    expect(missing.status).toBe("unknown");
    expect(missing.missingFields).toContain("motors.current");
  });
});

describe("build-level compatibility certainty", () => {
  test("empty and incomplete builds remain potentially compatible", () => {
    const empty = evaluate({});
    expect(empty.status).toBe("potentially-compatible");
    expect(empty.complete).toBe(false);
    expect(empty.price).toBe(0);

    const incomplete = evaluate({ frame: frame5 });
    expect(incomplete.status).toBe("potentially-compatible");
    expect(incomplete.complete).toBe(false);
  });

  test("a verified applicable failure makes the build incompatible", () => {
    const verification: CompatibilityVerification = {
      battery: ["voltage"],
      flightController: ["minVoltage", "maxVoltage"],
    };

    const result = evaluate(
      { battery: battery6, flightController: fcF4 },
      verification,
    );
    expect(result.status).toBe("incompatible");

    const voltageRule = result.rules.find(
      (item) => item.code === "BATTERY_FC_VOLTAGE",
    );
    expect(voltageRule?.status).toBe("fail");
    expect(voltageRule?.evidenceLevel).toBe("verified");
  });

  test("unverified or heuristic data never produces verified-compatible", () => {
    const racer = resolveBuildSelection(presets.racer.selection);
    const result = evaluate(racer);

    expect(result.complete).toBe(true);
    expect(result.status).toBe("potentially-compatible");
    expect(
      result.rules.some(
        (item) =>
          item.evidenceLevel === "heuristic" ||
          item.evidenceLevel === "unverified",
      ),
    ).toBe(true);
  });

  test("verified-compatible state requires every applicable rule to be a verified pass", () => {
    const verifiedPass: CompatibilityRuleResult = {
      code: "FRAME_MOTOR_MOUNT",
      categories: ["frame", "motors"],
      applicable: true,
      status: "pass",
      evidenceLevel: "verified",
      explanation: "Verified test rule.",
      evidence: {},
      missingFields: [],
      unverifiedFields: [],
    };

    expect(deriveCompatibilityStatus([verifiedPass], true)).toBe(
      "verified-compatible",
    );
    expect(
      deriveCompatibilityStatus(
        [{ ...verifiedPass, evidenceLevel: "unverified" }],
        true,
      ),
    ).toBe("potentially-compatible");
    expect(
      deriveCompatibilityStatus(
        [{ ...verifiedPass, status: "fail" }],
        true,
      ),
    ).toBe("incompatible");
  });
});

describe("candidate-specific compatibility", () => {
  test("candidate checking does not inherit an unrelated confirmed failure", () => {
    const verification: CompatibilityVerification = {
      battery: ["voltage"],
      flightController: ["minVoltage", "maxVoltage"],
    };
    const existing = {
      battery: battery6,
      flightController: fcF4,
    };

    expect(evaluate(existing, verification).status).toBe("incompatible");

    const cameraCheck = candidateCheck(
      existing,
      "camera",
      cameraFpv,
      verification,
    );
    expect(cameraCheck.status).toBe("potentially-compatible");
    expect(cameraCheck.rules).toHaveLength(0);
    expect(cameraCheck.messages[0]).toContain(
      "No current compatibility rule verifies",
    );
  });

  test("an unverified candidate conflict remains potentially compatible rather than confirmed incompatible", () => {
    const check = candidateCheck(
      { frame: frame5 },
      "motors",
      motors3,
    );

    expect(check.status).toBe("potentially-compatible");
    expect(
      check.rules.find((item) => item.code === "FRAME_MOTOR_MOUNT")?.status,
    ).toBe("fail");
  });
});

describe("existing build flows", () => {
  test("all existing templates keep their stable selections and price calculations", () => {
    for (const preset of Object.values(presets)) {
      const normalized = normalizeBuildSelection(preset.selection);
      for (const category of categories) {
        expect(normalized[category]).toBe(preset.selection[category]);
      }

      const selected = resolveBuildSelection(normalized);
      const result = evaluate(selected);
      const expectedPrice = Object.values(selected).reduce(
        (sum, item) => sum + (item?.price ?? 0),
        0,
      );

      expect(result.complete).toBe(true);
      expect(result.price).toBeCloseTo(expectedPrice, 8);
      expect(result.status).toBe("potentially-compatible");
    }
  });

  test("existing AI seed keeps valid catalogue IDs, selection behavior, and pricing", () => {
    const generated = aiPreset(["footage", "range"], 1200);
    const normalized = normalizeBuildSelection(generated.selection);

    for (const category of categories) {
      expect(normalized[category]).toBe(generated.selection[category]);
      const id = normalized[category];
      if (id) {
        expect(productCatalogue.getProductById(id)?.id).toBe(id);
      }
    }

    const selected = resolveBuildSelection(normalized);
    const result = evaluate(selected);
    const expectedPrice = Object.values(selected).reduce(
      (sum, item) => sum + (item?.price ?? 0),
      0,
    );

    expect(result.complete).toBe(true);
    expect(result.price).toBeCloseTo(expectedPrice, 8);
    expect(result.status).toBe("potentially-compatible");
  });

  test("existing compact seed values still exercise the original current and voltage logic", () => {
    const compact = resolveBuildSelection({
      frame: "frame3",
      motors: "motors3",
      flightController: "fcF4",
      esc: "esc20",
      propellers: "props3",
      battery: "battery4",
      camera: "cameraFpv",
      receiver: "receiver2",
    });

    const result = evaluate(compact);
    expect(result.complete).toBe(true);
    expect(result.price).toBeGreaterThan(0);
    expect(result.rules).toHaveLength(8);
  });
});
