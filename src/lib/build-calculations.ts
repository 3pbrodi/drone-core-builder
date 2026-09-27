import { categories, type Category, type Product } from "./build-data";

export type CompatibilityRuleStatus = "pass" | "fail" | "unknown";
export type CompatibilityEvidenceLevel = "verified" | "unverified" | "heuristic";
export type CompatibilityState =
  | "incompatible"
  | "potentially-compatible"
  | "verified-compatible";

export type CompatibilityRuleCode =
  | "FRAME_MOTOR_MOUNT"
  | "FRAME_PROPELLER_CLEARANCE"
  | "MOTOR_PROPELLER_SIZE_GUIDANCE"
  | "BATTERY_MOTOR_VOLTAGE"
  | "BATTERY_ESC_VOLTAGE"
  | "BATTERY_FC_VOLTAGE"
  | "FC_ESC_CONNECTOR"
  | "MOTOR_ESC_CURRENT";

export type CompatibilityEvidenceValue = string | number | boolean | null;

export type CompatibilityRuleResult = {
  code: CompatibilityRuleCode;
  categories: Category[];
  applicable: boolean;
  status: CompatibilityRuleStatus;
  evidenceLevel: CompatibilityEvidenceLevel;
  explanation: string;
  evidence: Record<string, CompatibilityEvidenceValue>;
  missingFields: string[];
  unverifiedFields: string[];
  advisoryOutcome?: "pass" | "fail";
};

export type SelectedProducts = Partial<Record<Category, Product>>;

export type CompatibilityVerification = Partial<
  Record<Category, readonly (keyof Product)[]>
>;

export type CompatibilityEvaluation = {
  selected: SelectedProducts;
  count: number;
  price: number;
  weight: number | null;
  speed: number | null;
  score: number | null;
  status: CompatibilityState;
  statusExplanation: string;
  rules: CompatibilityRuleResult[];
  warnings: string[];
  missing: string[];
  complete: boolean;
};

export type CandidateCheck = {
  status: CompatibilityState;
  messages: string[];
  rules: CompatibilityRuleResult[];
};

const evidence = (
  entries: Array<[string, CompatibilityEvidenceValue | undefined]>,
): Record<string, CompatibilityEvidenceValue> =>
  Object.fromEntries(
    entries
      .filter((entry): entry is [string, CompatibilityEvidenceValue] => entry[1] !== undefined)
      .map(([key, value]) => [key, value]),
  );

function isFieldVerified(
  verification: CompatibilityVerification,
  category: Category,
  field: keyof Product,
) {
  return verification[category]?.includes(field) ?? false;
}

function unverifiedFields(
  verification: CompatibilityVerification,
  fields: Array<[Category, keyof Product]>,
) {
  return fields
    .filter(([category, field]) => !isFieldVerified(verification, category, field))
    .map(([category, field]) => `${category}.${String(field)}`);
}

function deterministicEvidenceLevel(
  verification: CompatibilityVerification,
  fields: Array<[Category, keyof Product]>,
): CompatibilityEvidenceLevel {
  return fields.every(([category, field]) => isFieldVerified(verification, category, field))
    ? "verified"
    : "unverified";
}

function nonApplicableRule(
  code: CompatibilityRuleCode,
  affectedCategories: Category[],
  explanation: string,
): CompatibilityRuleResult {
  return {
    code,
    categories: affectedCategories,
    applicable: false,
    status: "unknown",
    evidenceLevel: "unverified",
    explanation,
    evidence: {},
    missingFields: [],
    unverifiedFields: [],
  };
}

function frameMotorMountRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const frame = selected.frame;
  const motors = selected.motors;
  const categories: Category[] = ["frame", "motors"];

  if (!frame || !motors) {
    return nonApplicableRule(
      "FRAME_MOTOR_MOUNT",
      categories,
      "Select both a frame and motors to check whether the motor mounting pattern fits.",
    );
  }

  const missingFields = [
    ...(frame.mount === undefined ? ["frame.mount"] : []),
    ...(motors.mount === undefined ? ["motors.mount"] : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["frame", "mount"],
    ["motors", "mount"],
  ];

  if (missingFields.length > 0) {
    return {
      code: "FRAME_MOTOR_MOUNT",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "The frame or motor mounting pattern is missing, so motor fit cannot be confirmed.",
      evidence: evidence([
        ["frame.mount", frame.mount],
        ["motors.mount", motors.mount],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  const status: CompatibilityRuleStatus = frame.mount === motors.mount ? "pass" : "fail";
  const evidenceLevel = deterministicEvidenceLevel(verification, usedFields);

  return {
    code: "FRAME_MOTOR_MOUNT",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? `The frame and motors use the same verified mounting pattern (${frame.mount}).`
          : `The frame and motors list the same mounting pattern (${frame.mount}), but those catalogue values are not verified.`
        : evidenceLevel === "verified"
          ? `The frame uses a ${frame.mount} motor mount, while the motors require ${motors.mount}, so they do not fit.`
          : `The demo specifications list a ${frame.mount} frame mount and a ${motors.mount} motor mount. That suggests they may not fit, but the source values are not verified.`,
    evidence: evidence([
      ["frame.mount", frame.mount],
      ["motors.mount", motors.mount],
    ]),
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}

function framePropellerClearanceRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const frame = selected.frame;
  const propellers = selected.propellers;
  const categories: Category[] = ["frame", "propellers"];

  if (!frame || !propellers) {
    return nonApplicableRule(
      "FRAME_PROPELLER_CLEARANCE",
      categories,
      "Select both a frame and propellers to compare nominal propeller clearance.",
    );
  }

  const missingFields = [
    ...(frame.frameInches === undefined ? ["frame.frameInches"] : []),
    ...(propellers.propInches === undefined ? ["propellers.propInches"] : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["frame", "frameInches"],
    ["propellers", "propInches"],
  ];

  if (missingFields.length > 0) {
    return {
      code: "FRAME_PROPELLER_CLEARANCE",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "Frame size or propeller diameter is missing, so nominal propeller clearance cannot be checked.",
      evidence: evidence([
        ["frame.frameInches", frame.frameInches],
        ["propellers.propInches", propellers.propInches],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  const status: CompatibilityRuleStatus =
    propellers.propInches <= frame.frameInches ? "pass" : "fail";
  const evidenceLevel = deterministicEvidenceLevel(verification, usedFields);

  return {
    code: "FRAME_PROPELLER_CLEARANCE",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? `The ${propellers.propInches}″ propellers are within the frame's verified ${frame.frameInches}″ nominal size.`
          : `The listed ${propellers.propInches}″ propellers are within the frame's ${frame.frameInches}″ nominal size, but the catalogue values are not verified.`
        : evidenceLevel === "verified"
          ? `The ${propellers.propInches}″ propellers exceed the frame's verified ${frame.frameInches}″ nominal size.`
          : `The demo values show ${propellers.propInches}″ propellers on a ${frame.frameInches}″ frame. That suggests insufficient clearance, but the source values are not verified.`,
    evidence: evidence([
      ["frame.frameInches", frame.frameInches],
      ["propellers.propInches", propellers.propInches],
    ]),
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}

function motorPropellerGuidanceRule(selected: SelectedProducts): CompatibilityRuleResult {
  const motors = selected.motors;
  const propellers = selected.propellers;
  const categories: Category[] = ["motors", "propellers"];

  if (!motors || !propellers) {
    return nonApplicableRule(
      "MOTOR_PROPELLER_SIZE_GUIDANCE",
      categories,
      "Select both motors and propellers before applying the demo size guidance.",
    );
  }

  const missingFields = [
    ...(motors.motorSize === undefined ? ["motors.motorSize"] : []),
    ...(propellers.propInches === undefined ? ["propellers.propInches"] : []),
  ];

  if (missingFields.length > 0) {
    return {
      code: "MOTOR_PROPELLER_SIZE_GUIDANCE",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "heuristic",
      explanation:
        "Motor size or propeller diameter is missing. Manufacturer motor/propeller/battery operating data are required for a reliable check.",
      evidence: evidence([
        ["motors.motorSize", motors.motorSize],
        ["propellers.propInches", propellers.propInches],
      ]),
      missingFields,
      unverifiedFields: [],
    };
  }

  const suggestedFit =
    motors.motorSize >= 2600
      ? propellers.propInches >= 6 && propellers.propInches <= 7
      : motors.motorSize >= 2000
        ? propellers.propInches >= 4 && propellers.propInches <= 5
        : propellers.propInches <= 3;

  return {
    code: "MOTOR_PROPELLER_SIZE_GUIDANCE",
    categories,
    applicable: true,
    status: "unknown",
    evidenceLevel: "heuristic",
    advisoryOutcome: suggestedFit ? "pass" : "fail",
    explanation: suggestedFit
      ? `The demo size heuristic considers motor size ${motors.motorSize} with ${propellers.propInches}″ propellers plausible, but motor size alone cannot verify compatibility. Manufacturer operating data for the motor, propeller and battery are still needed.`
      : `The demo size heuristic flags motor size ${motors.motorSize} with ${propellers.propInches}″ propellers as unusual. Motor size alone cannot confirm incompatibility, so verify the manufacturer's motor/propeller/battery operating data.`,
    evidence: evidence([
      ["motors.motorSize", motors.motorSize],
      ["propellers.propInches", propellers.propInches],
    ]),
    missingFields: [],
    unverifiedFields: [
      "motors.manufacturerOperatingData",
      "propellers.manufacturerOperatingData",
      "battery.operatingPoint",
    ],
  };
}

function batteryVoltageRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
  partCategory: "motors" | "esc" | "flightController",
  code: "BATTERY_MOTOR_VOLTAGE" | "BATTERY_ESC_VOLTAGE" | "BATTERY_FC_VOLTAGE",
  partLabel: string,
): CompatibilityRuleResult {
  const battery = selected.battery;
  const part = selected[partCategory];
  const affectedCategories: Category[] = ["battery", partCategory];

  if (!battery || !part) {
    return nonApplicableRule(
      code,
      affectedCategories,
      `Select both a battery and ${partLabel.toLowerCase()} to compare supported cell count.`,
    );
  }

  const missingFields = [
    ...(battery.voltage === undefined ? ["battery.voltage"] : []),
    ...(part.minVoltage === undefined ? [`${partCategory}.minVoltage`] : []),
    ...(part.maxVoltage === undefined ? [`${partCategory}.maxVoltage`] : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["battery", "voltage"],
    [partCategory, "minVoltage"],
    [partCategory, "maxVoltage"],
  ];

  if (missingFields.length > 0) {
    return {
      code,
      categories: affectedCategories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation: `Battery cell count or the ${partLabel.toLowerCase()} voltage range is missing, so this electrical check cannot be confirmed.`,
      evidence: evidence([
        ["battery.voltage", battery.voltage],
        [`${partCategory}.minVoltage`, part.minVoltage],
        [`${partCategory}.maxVoltage`, part.maxVoltage],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  const status: CompatibilityRuleStatus =
    battery.voltage >= part.minVoltage && battery.voltage <= part.maxVoltage
      ? "pass"
      : "fail";
  const evidenceLevel = deterministicEvidenceLevel(verification, usedFields);

  return {
    code,
    categories: affectedCategories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? `The ${battery.voltage}S battery is within the ${partLabel.toLowerCase()}'s verified ${part.minVoltage}–${part.maxVoltage}S range.`
          : `The demo values place the ${battery.voltage}S battery within the ${partLabel.toLowerCase()}'s listed ${part.minVoltage}–${part.maxVoltage}S range, but those values are not verified.`
        : evidenceLevel === "verified"
          ? `The ${battery.voltage}S battery is outside the ${partLabel.toLowerCase()}'s verified ${part.minVoltage}–${part.maxVoltage}S range.`
          : `The demo values put the ${battery.voltage}S battery outside the ${partLabel.toLowerCase()}'s listed ${part.minVoltage}–${part.maxVoltage}S range. Treat this as a warning until the source specifications are verified.`,
    evidence: evidence([
      ["battery.voltage", battery.voltage],
      [`${partCategory}.minVoltage`, part.minVoltage],
      [`${partCategory}.maxVoltage`, part.maxVoltage],
    ]),
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}

function fcEscConnectorRule(selected: SelectedProducts): CompatibilityRuleResult {
  const flightController = selected.flightController;
  const esc = selected.esc;
  const categories: Category[] = ["flightController", "esc"];

  if (!flightController || !esc) {
    return nonApplicableRule(
      "FC_ESC_CONNECTOR",
      categories,
      "Select both a flight controller and ESC to compare their listed connector names.",
    );
  }

  const missingFields = [
    ...(flightController.connector === undefined ? ["flightController.connector"] : []),
    ...(esc.escInput === undefined ? ["esc.escInput"] : []),
  ];

  if (missingFields.length > 0) {
    return {
      code: "FC_ESC_CONNECTOR",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "A flight-controller or ESC connector name is missing. Exact connector type and pinout are needed before direct-plug compatibility can be confirmed.",
      evidence: evidence([
        ["flightController.connector", flightController.connector],
        ["esc.escInput", esc.escInput],
      ]),
      missingFields,
      unverifiedFields: ["flightController.connectorPinout", "esc.connectorPinout"],
    };
  }

  const status: CompatibilityRuleStatus =
    flightController.connector === esc.escInput ? "pass" : "fail";

  return {
    code: "FC_ESC_CONNECTOR",
    categories,
    applicable: true,
    status,
    evidenceLevel: "unverified",
    explanation:
      status === "pass"
        ? `Both parts list a ${flightController.connector} connector, but matching connector names do not verify pinout or wire order.`
        : `The flight controller lists ${flightController.connector}, while the ESC lists ${esc.escInput}. That suggests they may not plug together directly, but connector names alone do not prove electrical incompatibility.`,
    evidence: evidence([
      ["flightController.connector", flightController.connector],
      ["esc.escInput", esc.escInput],
    ]),
    missingFields: [],
    unverifiedFields: [
      "flightController.connectorPinout",
      "esc.connectorPinout",
    ],
  };
}

function motorEscCurrentRule(selected: SelectedProducts): CompatibilityRuleResult {
  const motors = selected.motors;
  const esc = selected.esc;
  const categories: Category[] = ["motors", "esc"];

  if (!motors || !esc) {
    return nonApplicableRule(
      "MOTOR_ESC_CURRENT",
      categories,
      "Select both motors and an ESC to compare the listed current ratings.",
    );
  }

  const missingFields = [
    ...(motors.current === undefined ? ["motors.current"] : []),
    ...(esc.escAmps === undefined ? ["esc.escAmps"] : []),
  ];

  if (missingFields.length > 0) {
    return {
      code: "MOTOR_ESC_CURRENT",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "A motor or ESC current rating is missing. Verified operating conditions and rating type are needed for a reliable current check.",
      evidence: evidence([
        ["motors.current", motors.current],
        ["esc.escAmps", esc.escAmps],
      ]),
      missingFields,
      unverifiedFields: [
        "motors.currentOperatingConditions",
        "esc.currentRatingType",
      ],
    };
  }

  const status: CompatibilityRuleStatus =
    motors.current <= esc.escAmps ? "pass" : "fail";

  return {
    code: "MOTOR_ESC_CURRENT",
    categories,
    applicable: true,
    status,
    evidenceLevel: "unverified",
    explanation:
      status === "pass"
        ? `The listed motor current (${motors.current} A) is below the listed ESC rating (${esc.escAmps} A), but the motor operating conditions and ESC rating type are not verified.`
        : `The listed motor current (${motors.current} A) exceeds the listed ESC rating (${esc.escAmps} A). Treat this as a warning until the motor operating conditions and ESC rating type are verified.`,
    evidence: evidence([
      ["motors.current", motors.current],
      ["esc.escAmps", esc.escAmps],
    ]),
    missingFields: [],
    unverifiedFields: [
      "motors.currentOperatingConditions",
      "esc.currentRatingType",
    ],
  };
}

export function evaluateCompatibilityRules(
  selected: SelectedProducts,
  verification: CompatibilityVerification = {},
): CompatibilityRuleResult[] {
  return [
    frameMotorMountRule(selected, verification),
    framePropellerClearanceRule(selected, verification),
    motorPropellerGuidanceRule(selected),
    batteryVoltageRule(
      selected,
      verification,
      "motors",
      "BATTERY_MOTOR_VOLTAGE",
      "Motors",
    ),
    batteryVoltageRule(
      selected,
      verification,
      "esc",
      "BATTERY_ESC_VOLTAGE",
      "ESC",
    ),
    batteryVoltageRule(
      selected,
      verification,
      "flightController",
      "BATTERY_FC_VOLTAGE",
      "Flight controller",
    ),
    fcEscConnectorRule(selected),
    motorEscCurrentRule(selected),
  ];
}

export function deriveCompatibilityStatus(
  rules: readonly CompatibilityRuleResult[],
  complete: boolean,
): CompatibilityState {
  if (
    rules.some(
      (rule) =>
        rule.applicable &&
        rule.status === "fail" &&
        rule.evidenceLevel === "verified",
    )
  ) {
    return "incompatible";
  }

  if (!complete) return "potentially-compatible";

  const applicableRules = rules.filter((rule) => rule.applicable);
  if (applicableRules.length === 0) return "potentially-compatible";

  if (
    applicableRules.some(
      (rule) =>
        rule.status !== "pass" || rule.evidenceLevel !== "verified",
    )
  ) {
    return "potentially-compatible";
  }

  return "verified-compatible";
}

function compatibilityStatusExplanation(status: CompatibilityState) {
  if (status === "incompatible") {
    return "At least one compatibility rule has a confirmed failure using verified specifications.";
  }
  if (status === "verified-compatible") {
    return "All currently applicable compatibility rules pass using verified specifications. This is not a flight-safety guarantee.";
  }
  return "No verified incompatibility is confirmed, but some checks are incomplete, unverified, or heuristic.";
}

export function evaluate(
  selected: SelectedProducts,
  verification: CompatibilityVerification = {},
): CompatibilityEvaluation {
  const frame = selected.frame;
  const motors = selected.motors;
  const props = selected.propellers;
  const battery = selected.battery;
  const esc = selected.esc;

  const rules = evaluateCompatibilityRules(selected, verification);
  const complete = categories.every((category) => !!selected[category]);
  const count = categories.filter((category) => !!selected[category]).length;
  const price = categories.reduce(
    (sum, category) => sum + (selected[category]?.price ?? 0),
    0,
  );

  const warnings = rules
    .filter(
      (rule) =>
        rule.applicable &&
        (rule.status === "fail" || rule.advisoryOutcome === "fail"),
    )
    .map((rule) => rule.explanation);

  const missing = rules
    .filter(
      (rule) =>
        rule.applicable &&
        rule.status === "unknown" &&
        rule.missingFields.length > 0,
    )
    .map((rule) => rule.explanation);

  const enoughPerformance = !!(frame && motors && props && battery && esc);
  const weight = enoughPerformance
    ? Math.round(
        categories.reduce(
          (sum, category) => sum + (selected[category]?.weight ?? 0),
          0,
        ) + 80,
      )
    : null;
  const speed =
    enoughPerformance &&
    weight &&
    motors?.thrust &&
    battery?.voltage &&
    props?.propInches
      ? Math.round(
          Math.min(
            180,
            ((motors.thrust * 4) / weight) * 12 +
              battery.voltage * 4 +
              props.propInches * 3,
          ),
        )
      : null;

  const blocksPerformanceScore =
    warnings.length > 0 || missing.length > 0;
  const score =
    complete && !blocksPerformanceScore
      ? Math.max(
          1,
          Math.min(
            100,
            Math.round(
              70 +
                (motors?.thrust ?? 0) / 120 -
                (weight ?? 0) / 110 +
                (battery?.batteryMah ?? 0) / 900,
            ),
          ),
        )
      : null;

  const status = deriveCompatibilityStatus(rules, complete);

  return {
    selected,
    count,
    price,
    weight,
    speed,
    score,
    status,
    statusExplanation: compatibilityStatusExplanation(status),
    rules,
    warnings,
    missing,
    complete,
  };
}

export function candidateCheck(
  selected: SelectedProducts,
  category: Category,
  candidate: Product,
  verification: CompatibilityVerification = {},
): CandidateCheck {
  const result = evaluate(
    { ...selected, [category]: candidate },
    verification,
  );
  const relevantRules = result.rules.filter((rule) =>
    rule.categories.includes(category),
  );
  const applicableRules = relevantRules.filter((rule) => rule.applicable);

  let status: CompatibilityState = "potentially-compatible";

  if (
    applicableRules.some(
      (rule) =>
        rule.status === "fail" &&
        rule.evidenceLevel === "verified",
    )
  ) {
    status = "incompatible";
  } else if (
    relevantRules.length > 0 &&
    relevantRules.every(
      (rule) =>
        rule.applicable &&
        rule.status === "pass" &&
        rule.evidenceLevel === "verified",
    )
  ) {
    status = "verified-compatible";
  }

  const messages = Array.from(
    new Set(
      relevantRules
        .filter(
          (rule) =>
            !rule.applicable ||
            rule.status !== "pass" ||
            rule.evidenceLevel !== "verified",
        )
        .map((rule) => rule.explanation),
    ),
  );

  if (relevantRules.length === 0) {
    messages.push(
      "No current compatibility rule verifies this component category yet.",
    );
  } else if (messages.length === 0 && status === "verified-compatible") {
    messages.push(
      "This component passes every currently applicable verified compatibility rule. This is not a flight-safety guarantee.",
    );
  }

  return { status, messages, rules: relevantRules };
}
