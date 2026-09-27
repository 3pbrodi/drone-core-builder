import { categories, type Category, type Product } from "./build-data";

export type CompatibilityRuleStatus = "pass" | "fail" | "unknown";
export type CompatibilityEvidenceLevel = "verified" | "unverified" | "heuristic";
export type CompatibilityState = "incompatible" | "potentially-compatible" | "verified-compatible";

export type CompatibilityRuleCode =
  | "FRAME_MOTOR_MOUNT"
  | "FRAME_PROPELLER_CLEARANCE"
  | "MOTOR_PROPELLER_SIZE_GUIDANCE"
  | "BATTERY_MOTOR_VOLTAGE"
  | "BATTERY_ESC_VOLTAGE"
  | "BATTERY_FC_VOLTAGE"
  | "FC_ESC_CONNECTOR"
  | "MOTOR_ESC_CURRENT"
  | "CAMERA_FC_VIDEO_INTERFACE"
  | "CAMERA_FC_POWER"
  | "RECEIVER_FC_SIGNAL_INTERFACE"
  | "RECEIVER_FC_POWER";

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

export type CompatibilityVerification = Partial<Record<Category, readonly (keyof Product)[]>>;

export type CurrentRatingType = "continuous" | "burst" | "peak";

export type CompatibilityTechnicalEvidence = {
  motorPropeller?: {
    motorId: string;
    propellerId: string;
    manufacturerCompatibility?: "compatible" | "incompatible";
    manufacturerEvidenceVerified?: boolean;
    operatingConditionsVerified?: boolean;
  };
  motorEscCurrent?: {
    motorId: string;
    escId: string;
    motorRatingType?: CurrentRatingType;
    escRatingType?: CurrentRatingType;
    ratingTypesVerified?: boolean;
    motorOperatingConditionsVerified?: boolean;
  };
  fcEscConnector?: {
    flightControllerId: string;
    escId: string;
    directConnectionCompatibility?: "compatible" | "incompatible";
    connectorFamilyVerified?: boolean;
    pinoutVerified?: boolean;
    wireOrderVerified?: boolean;
    signalCompatibilityVerified?: boolean;
    voltageCompatibilityVerified?: boolean;
  };
};

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

  const frameInches = frame.frameInches;
  const propInches = propellers.propInches;
  const missingFields = [
    ...(frameInches === undefined ? ["frame.frameInches"] : []),
    ...(propInches === undefined ? ["propellers.propInches"] : []),
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

  if (frameInches === undefined || propInches === undefined) {
    throw new Error("Frame/propeller rule reached comparison without required values.");
  }

  const status: CompatibilityRuleStatus = propInches <= frameInches ? "pass" : "fail";
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
          ? `The ${propInches}″ propellers are within the frame's verified ${frameInches}″ nominal size.`
          : `The listed ${propInches}″ propellers are within the frame's ${frameInches}″ nominal size, but the catalogue values are not verified.`
        : evidenceLevel === "verified"
          ? `The ${propInches}″ propellers exceed the frame's verified ${frameInches}″ nominal size.`
          : `The demo values show ${propInches}″ propellers on a ${frameInches}″ frame. That suggests insufficient clearance, but the source values are not verified.`,
    evidence: evidence([
      ["frame.frameInches", frame.frameInches],
      ["propellers.propInches", propellers.propInches],
    ]),
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}

function motorPropellerGuidanceRule(
  selected: SelectedProducts,
  technicalEvidence: CompatibilityTechnicalEvidence,
): CompatibilityRuleResult {
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

  const motorSize = motors.motorSize;
  const propInches = propellers.propInches;
  const missingFields = [
    ...(motorSize === undefined ? ["motors.motorSize"] : []),
    ...(propInches === undefined ? ["propellers.propInches"] : []),
  ];
  const verifiedPair = technicalEvidence.motorPropeller;
  const evidenceMatchesSelection =
    verifiedPair?.motorId === motors.id && verifiedPair.propellerId === propellers.id;
  const canUseVerifiedManufacturerEvidence =
    evidenceMatchesSelection &&
    verifiedPair?.manufacturerEvidenceVerified === true &&
    verifiedPair.operatingConditionsVerified === true &&
    verifiedPair.manufacturerCompatibility !== undefined;

  if (canUseVerifiedManufacturerEvidence) {
    const verifiedStatus: CompatibilityRuleStatus =
      verifiedPair.manufacturerCompatibility === "compatible" ? "pass" : "fail";

    return {
      code: "MOTOR_PROPELLER_SIZE_GUIDANCE",
      categories,
      applicable: true,
      status: verifiedStatus,
      evidenceLevel: "verified",
      explanation:
        verifiedStatus === "pass"
          ? "Verified manufacturer-supported operating data confirms this motor and propeller combination for the documented operating conditions."
          : "Verified manufacturer-supported operating data identifies this motor and propeller combination as incompatible for the documented operating conditions.",
      evidence: evidence([
        ["motors.motorSize", motorSize],
        ["propellers.propInches", propInches],
        ["evidence.motorId", verifiedPair.motorId],
        ["evidence.propellerId", verifiedPair.propellerId],
        ["manufacturerCompatibility", verifiedPair.manufacturerCompatibility],
        ["manufacturerEvidenceVerified", true],
        ["operatingConditionsVerified", true],
      ]),
      missingFields,
      unverifiedFields: [],
    };
  }

  if (missingFields.length > 0) {
    return {
      code: "MOTOR_PROPELLER_SIZE_GUIDANCE",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "heuristic",
      explanation:
        "Motor size or propeller diameter is missing. Verified manufacturer motor/propeller operating data are required for a reliable compatibility result.",
      evidence: evidence([
        ["motors.motorSize", motorSize],
        ["propellers.propInches", propInches],
      ]),
      missingFields,
      unverifiedFields: [
        "motors.manufacturerOperatingData",
        "propellers.manufacturerOperatingData",
        "motorPropeller.operatingConditions",
      ],
    };
  }

  if (motorSize === undefined || propInches === undefined) {
    throw new Error("Motor/propeller guidance reached comparison without required values.");
  }

  const suggestedFit =
    motorSize >= 2600
      ? propInches >= 6 && propInches <= 7
      : motorSize >= 2000
        ? propInches >= 4 && propInches <= 5
        : propInches <= 3;

  return {
    code: "MOTOR_PROPELLER_SIZE_GUIDANCE",
    categories,
    applicable: true,
    status: "unknown",
    evidenceLevel: "heuristic",
    advisoryOutcome: suggestedFit ? "pass" : "fail",
    explanation: suggestedFit
      ? `The demo size heuristic considers motor size ${motorSize} with ${propInches}″ propellers plausible, but motor size alone cannot verify compatibility. Verified manufacturer operating data for this motor/propeller combination are still required.`
      : `The demo size heuristic flags motor size ${motorSize} with ${propInches}″ propellers as questionable. This is advisory only: motor size alone cannot confirm incompatibility, so verify manufacturer-supported operating data for the exact combination.`,
    evidence: evidence([
      ["motors.motorSize", motorSize],
      ["propellers.propInches", propInches],
      ["manufacturerCompatibility", verifiedPair?.manufacturerCompatibility],
      ["manufacturerEvidenceVerified", verifiedPair?.manufacturerEvidenceVerified],
      ["operatingConditionsVerified", verifiedPair?.operatingConditionsVerified],
    ]),
    missingFields: [],
    unverifiedFields: [
      ...(evidenceMatchesSelection ? [] : ["motorPropeller.selectionBinding"]),
      ...(verifiedPair?.manufacturerEvidenceVerified === true
        ? []
        : ["motorPropeller.manufacturerEvidence"]),
      ...(verifiedPair?.operatingConditionsVerified === true
        ? []
        : ["motorPropeller.operatingConditions"]),
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

  const batteryVoltage = battery.voltage;
  const partMinVoltage = part.minVoltage;
  const partMaxVoltage = part.maxVoltage;
  const missingFields = [
    ...(batteryVoltage === undefined ? ["battery.voltage"] : []),
    ...(partMinVoltage === undefined ? [`${partCategory}.minVoltage`] : []),
    ...(partMaxVoltage === undefined ? [`${partCategory}.maxVoltage`] : []),
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

  if (
    batteryVoltage === undefined ||
    partMinVoltage === undefined ||
    partMaxVoltage === undefined
  ) {
    throw new Error("Battery voltage rule reached comparison without required values.");
  }

  const status: CompatibilityRuleStatus =
    batteryVoltage >= partMinVoltage && batteryVoltage <= partMaxVoltage ? "pass" : "fail";
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
          ? `The ${batteryVoltage}S battery is within the ${partLabel.toLowerCase()}'s verified ${partMinVoltage}–${partMaxVoltage}S range.`
          : `The demo values place the ${batteryVoltage}S battery within the ${partLabel.toLowerCase()}'s listed ${partMinVoltage}–${partMaxVoltage}S range, but those values are not verified.`
        : evidenceLevel === "verified"
          ? `The ${batteryVoltage}S battery is outside the ${partLabel.toLowerCase()}'s verified ${partMinVoltage}–${partMaxVoltage}S range.`
          : `The demo values put the ${batteryVoltage}S battery outside the ${partLabel.toLowerCase()}'s listed ${partMinVoltage}–${partMaxVoltage}S range. Treat this as a warning until the source specifications are verified.`,
    evidence: evidence([
      ["battery.voltage", battery.voltage],
      [`${partCategory}.minVoltage`, part.minVoltage],
      [`${partCategory}.maxVoltage`, part.maxVoltage],
    ]),
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}

function fcEscConnectorRule(
  selected: SelectedProducts,
  technicalEvidence: CompatibilityTechnicalEvidence,
): CompatibilityRuleResult {
  const flightController = selected.flightController;
  const esc = selected.esc;
  const categories: Category[] = ["flightController", "esc"];

  if (!flightController || !esc) {
    return nonApplicableRule(
      "FC_ESC_CONNECTOR",
      categories,
      "Select both a flight controller and ESC to compare their connector information.",
    );
  }

  const fcConnector = flightController.connector;
  const escConnector = esc.escInput;
  const missingFields = [
    ...(fcConnector === undefined ? ["flightController.connector"] : []),
    ...(escConnector === undefined ? ["esc.escInput"] : []),
  ];
  const verifiedConnection = technicalEvidence.fcEscConnector;
  const evidenceMatchesSelection =
    verifiedConnection?.flightControllerId === flightController.id &&
    verifiedConnection.escId === esc.id;
  const allDirectConnectionEvidenceVerified =
    evidenceMatchesSelection &&
    verifiedConnection?.connectorFamilyVerified === true &&
    verifiedConnection.pinoutVerified === true &&
    verifiedConnection.wireOrderVerified === true &&
    verifiedConnection.signalCompatibilityVerified === true &&
    verifiedConnection.voltageCompatibilityVerified === true &&
    verifiedConnection.directConnectionCompatibility !== undefined;

  if (allDirectConnectionEvidenceVerified) {
    const verifiedStatus: CompatibilityRuleStatus =
      verifiedConnection.directConnectionCompatibility === "compatible" ? "pass" : "fail";

    return {
      code: "FC_ESC_CONNECTOR",
      categories,
      applicable: true,
      status: verifiedStatus,
      evidenceLevel: "verified",
      explanation:
        verifiedStatus === "pass"
          ? "Verified connector-family, pinout, wire-order, signal, and voltage evidence confirms direct FC-to-ESC connection compatibility."
          : "Verified connector-family, pinout, wire-order, signal, and voltage evidence confirms a direct FC-to-ESC connection conflict.",
      evidence: evidence([
        ["flightController.connector", fcConnector],
        ["esc.escInput", escConnector],
        ["evidence.flightControllerId", verifiedConnection.flightControllerId],
        ["evidence.escId", verifiedConnection.escId],
        ["directConnectionCompatibility", verifiedConnection.directConnectionCompatibility],
        ["connectorFamilyVerified", true],
        ["pinoutVerified", true],
        ["wireOrderVerified", true],
        ["signalCompatibilityVerified", true],
        ["voltageCompatibilityVerified", true],
      ]),
      missingFields,
      unverifiedFields: [],
    };
  }

  if (missingFields.length > 0) {
    return {
      code: "FC_ESC_CONNECTOR",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "A connector name is missing. Direct FC-to-ESC compatibility also requires verified connector family, pinout, wire order, signal, and relevant voltage information.",
      evidence: evidence([
        ["flightController.connector", fcConnector],
        ["esc.escInput", escConnector],
      ]),
      missingFields,
      unverifiedFields: [
        "fcEscConnector.connectorFamily",
        "fcEscConnector.pinout",
        "fcEscConnector.wireOrder",
        "fcEscConnector.signalCompatibility",
        "fcEscConnector.voltageCompatibility",
      ],
    };
  }

  const namesMatch = fcConnector === escConnector;

  return {
    code: "FC_ESC_CONNECTOR",
    categories,
    applicable: true,
    status: "unknown",
    evidenceLevel: "unverified",
    advisoryOutcome: namesMatch ? "pass" : "fail",
    explanation: namesMatch
      ? `Both parts list a ${fcConnector} connector. That is a useful clue, but a matching connector name does not verify pinout, wire order, signal compatibility, or voltage compatibility.`
      : `The flight controller lists ${fcConnector}, while the ESC lists ${escConnector}. They may not plug together directly, but different connector names alone do not prove an electrical incompatibility. Verify connector family, pinout, wire order, signals, and relevant voltages.`,
    evidence: evidence([
      ["flightController.connector", fcConnector],
      ["esc.escInput", escConnector],
      ["directConnectionCompatibility", verifiedConnection?.directConnectionCompatibility],
      ["connectorFamilyVerified", verifiedConnection?.connectorFamilyVerified],
      ["pinoutVerified", verifiedConnection?.pinoutVerified],
      ["wireOrderVerified", verifiedConnection?.wireOrderVerified],
      ["signalCompatibilityVerified", verifiedConnection?.signalCompatibilityVerified],
      ["voltageCompatibilityVerified", verifiedConnection?.voltageCompatibilityVerified],
    ]),
    missingFields: [],
    unverifiedFields: [
      ...(evidenceMatchesSelection ? [] : ["fcEscConnector.selectionBinding"]),
      ...(verifiedConnection?.connectorFamilyVerified === true
        ? []
        : ["fcEscConnector.connectorFamily"]),
      ...(verifiedConnection?.pinoutVerified === true ? [] : ["fcEscConnector.pinout"]),
      ...(verifiedConnection?.wireOrderVerified === true ? [] : ["fcEscConnector.wireOrder"]),
      ...(verifiedConnection?.signalCompatibilityVerified === true
        ? []
        : ["fcEscConnector.signalCompatibility"]),
      ...(verifiedConnection?.voltageCompatibilityVerified === true
        ? []
        : ["fcEscConnector.voltageCompatibility"]),
    ],
  };
}

function motorEscCurrentRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
  technicalEvidence: CompatibilityTechnicalEvidence,
): CompatibilityRuleResult {
  const motors = selected.motors;
  const esc = selected.esc;
  const categories: Category[] = ["motors", "esc"];

  if (!motors || !esc) {
    return nonApplicableRule(
      "MOTOR_ESC_CURRENT",
      categories,
      "Select both motors and an ESC to compare their current information.",
    );
  }

  const motorCurrent = motors.current;
  const escAmps = esc.escAmps;
  const missingFields = [
    ...(motorCurrent === undefined ? ["motors.current"] : []),
    ...(escAmps === undefined ? ["esc.escAmps"] : []),
  ];
  const ratingEvidence = technicalEvidence.motorEscCurrent;
  const motorCurrentVerified = isFieldVerified(verification, "motors", "current");
  const escCurrentVerified = isFieldVerified(verification, "esc", "escAmps");

  if (missingFields.length > 0) {
    return {
      code: "MOTOR_ESC_CURRENT",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "A motor or ESC current value is missing. A reliable comparison also needs verified rating types and the motor's operating conditions.",
      evidence: evidence([
        ["motors.current", motorCurrent],
        ["esc.escAmps", escAmps],
        ["motorRatingType", ratingEvidence?.motorRatingType],
        ["escRatingType", ratingEvidence?.escRatingType],
      ]),
      missingFields,
      unverifiedFields: [
        "motorEscCurrent.motorRatingType",
        "motorEscCurrent.escRatingType",
        "motorEscCurrent.motorOperatingConditions",
      ],
    };
  }

  if (motorCurrent === undefined || escAmps === undefined) {
    throw new Error("Motor/ESC current rule reached comparison without required values.");
  }

  const evidenceMatchesSelection =
    ratingEvidence?.motorId === motors.id && ratingEvidence.escId === esc.id;
  const motorRatingType = ratingEvidence?.motorRatingType;
  const escRatingType = ratingEvidence?.escRatingType;
  const ratingTypesVerified = ratingEvidence?.ratingTypesVerified === true;
  const operatingConditionsVerified = ratingEvidence?.motorOperatingConditionsVerified === true;
  const ratingTypesComparable = motorRatingType === "continuous" && escRatingType === "continuous";
  const canCompareAsVerified =
    evidenceMatchesSelection &&
    motorCurrentVerified &&
    escCurrentVerified &&
    ratingTypesVerified &&
    operatingConditionsVerified &&
    ratingTypesComparable;

  if (canCompareAsVerified) {
    const verifiedStatus: CompatibilityRuleStatus = motorCurrent <= escAmps ? "pass" : "fail";

    return {
      code: "MOTOR_ESC_CURRENT",
      categories,
      applicable: true,
      status: verifiedStatus,
      evidenceLevel: "verified",
      explanation:
        verifiedStatus === "pass"
          ? `The verified continuous motor current (${motorCurrent} A) does not exceed the verified continuous ESC rating (${escAmps} A) under the documented motor operating conditions.`
          : `The verified continuous motor current (${motorCurrent} A) exceeds the verified continuous ESC rating (${escAmps} A) under the documented motor operating conditions.`,
      evidence: evidence([
        ["motors.current", motorCurrent],
        ["esc.escAmps", escAmps],
        ["evidence.motorId", ratingEvidence?.motorId],
        ["evidence.escId", ratingEvidence?.escId],
        ["motorRatingType", motorRatingType],
        ["escRatingType", escRatingType],
        ["ratingTypesVerified", true],
        ["motorOperatingConditionsVerified", true],
      ]),
      missingFields: [],
      unverifiedFields: [],
    };
  }

  const rawComparison = motorCurrent <= escAmps ? "pass" : "fail";
  const ratingMismatch =
    motorRatingType !== undefined &&
    escRatingType !== undefined &&
    motorRatingType !== escRatingType;

  let explanation: string;
  if (ratingMismatch) {
    explanation = `The motor current is listed as ${motorCurrent} A (${motorRatingType}) and the ESC as ${escAmps} A (${escRatingType}). Those rating types are not directly comparable, so this check remains unknown.`;
  } else if (
    motorRatingType !== undefined &&
    escRatingType !== undefined &&
    !ratingTypesComparable
  ) {
    explanation = `Both current values have ${motorRatingType} / ${escRatingType} rating labels, but only verified continuous ratings with verified motor operating conditions are treated as directly comparable here.`;
  } else {
    explanation = `The catalogue lists ${motorCurrent} A for the motor and ${escAmps} A for the ESC, but rating type or motor operating conditions are missing or unverified. The raw numbers alone cannot establish compatibility.`;
  }

  return {
    code: "MOTOR_ESC_CURRENT",
    categories,
    applicable: true,
    status: "unknown",
    evidenceLevel: "unverified",
    ...(ratingMismatch ? {} : { advisoryOutcome: rawComparison }),
    explanation,
    evidence: evidence([
      ["motors.current", motorCurrent],
      ["esc.escAmps", escAmps],
      ["evidence.motorId", ratingEvidence?.motorId],
      ["evidence.escId", ratingEvidence?.escId],
      ["motorRatingType", motorRatingType],
      ["escRatingType", escRatingType],
      ["ratingTypesVerified", ratingEvidence?.ratingTypesVerified],
      ["motorOperatingConditionsVerified", ratingEvidence?.motorOperatingConditionsVerified],
    ]),
    missingFields: [],
    unverifiedFields: [
      ...(evidenceMatchesSelection ? [] : ["motorEscCurrent.selectionBinding"]),
      ...(motorCurrentVerified ? [] : ["motors.current"]),
      ...(escCurrentVerified ? [] : ["esc.escAmps"]),
      ...(ratingTypesVerified
        ? []
        : ["motorEscCurrent.motorRatingType", "motorEscCurrent.escRatingType"]),
      ...(operatingConditionsVerified ? [] : ["motorEscCurrent.motorOperatingConditions"]),
      ...(!ratingTypesComparable && !ratingMismatch
        ? ["motorEscCurrent.comparableContinuousRatings"]
        : []),
    ],
  };
}

function cameraFcVideoInterfaceRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const camera = selected.camera;
  const flightController = selected.flightController;
  const categories: Category[] = ["camera", "flightController"];

  if (!camera || !flightController) {
    return nonApplicableRule(
      "CAMERA_FC_VIDEO_INTERFACE",
      categories,
      "Select both a camera and flight controller to check the camera video interface.",
    );
  }

  const cameraInterface = camera.cameraVideoInterface;
  const supportedInterfaces = flightController.fcCameraVideoInterfaces;
  const missingFields = [
    ...(cameraInterface === undefined ? ["camera.cameraVideoInterface"] : []),
    ...(supportedInterfaces === undefined
      ? ["flightController.fcCameraVideoInterfaces"]
      : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["camera", "cameraVideoInterface"],
    ["flightController", "fcCameraVideoInterfaces"],
  ];

  if (missingFields.length > 0) {
    return {
      code: "CAMERA_FC_VIDEO_INTERFACE",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "The camera video interface or the flight controller's supported camera interfaces are not documented well enough to confirm this connection.",
      evidence: evidence([
        ["camera.cameraVideoInterface", cameraInterface],
        [
          "flightController.fcCameraVideoInterfaces",
          supportedInterfaces?.join(", ") ?? undefined,
        ],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  if (cameraInterface === undefined || supportedInterfaces === undefined) {
    throw new Error("Camera/FC video rule reached comparison without required values.");
  }

  const status: CompatibilityRuleStatus = supportedInterfaces.includes(
    cameraInterface,
  )
    ? "pass"
    : "fail";
  const evidenceLevel = deterministicEvidenceLevel(verification, usedFields);

  return {
    code: "CAMERA_FC_VIDEO_INTERFACE",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? `The verified camera interface (${cameraInterface}) is supported by the selected flight controller.`
          : `The listed camera interface (${cameraInterface}) appears in the flight controller's supported interfaces, but one or both values are not verified.`
        : evidenceLevel === "verified"
          ? `The verified camera interface (${cameraInterface}) is not supported by the selected flight controller.`
          : `The listed camera interface (${cameraInterface}) does not appear in the flight controller's listed interfaces, but the available data are not verified enough to confirm an incompatibility.`,
    evidence: evidence([
      ["camera.cameraVideoInterface", cameraInterface],
      [
        "flightController.fcCameraVideoInterfaces",
        supportedInterfaces.join(", "),
      ],
    ]),
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}

function cameraFcPowerRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const camera = selected.camera;
  const flightController = selected.flightController;
  const categories: Category[] = ["camera", "flightController"];

  if (!camera || !flightController) {
    return nonApplicableRule(
      "CAMERA_FC_POWER",
      categories,
      "Select both a camera and flight controller to check camera power compatibility.",
    );
  }

  const minimum = camera.cameraMinVoltageV;
  const maximum = camera.cameraMaxVoltageV;
  const powerRails = flightController.fcCameraPowerVoltagesV;
  const missingFields = [
    ...(minimum === undefined ? ["camera.cameraMinVoltageV"] : []),
    ...(maximum === undefined ? ["camera.cameraMaxVoltageV"] : []),
    ...(powerRails === undefined
      ? ["flightController.fcCameraPowerVoltagesV"]
      : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["camera", "cameraMinVoltageV"],
    ["camera", "cameraMaxVoltageV"],
    ["flightController", "fcCameraPowerVoltagesV"],
  ];

  if (missingFields.length > 0) {
    return {
      code: "CAMERA_FC_POWER",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "The camera input-voltage range or the flight controller's available camera power rails are missing, so camera power compatibility cannot be confirmed.",
      evidence: evidence([
        ["camera.cameraMinVoltageV", minimum],
        ["camera.cameraMaxVoltageV", maximum],
        [
          "flightController.fcCameraPowerVoltagesV",
          powerRails?.join(", ") ?? undefined,
        ],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  if (minimum === undefined || maximum === undefined || powerRails === undefined) {
    throw new Error("Camera/FC power rule reached comparison without required values.");
  }

  if (minimum === undefined || maximum === undefined || powerRails === undefined) {
    throw new Error("Receiver/FC power rule reached comparison without required values.");
  }

  const usableRail = powerRails.find(
    (voltage) => voltage >= minimum && voltage <= maximum,
  );
  const status: CompatibilityRuleStatus =
    usableRail === undefined ? "fail" : "pass";
  const evidenceLevel = deterministicEvidenceLevel(verification, usedFields);

  return {
    code: "CAMERA_FC_POWER",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? `A verified ${usableRail}V flight-controller power rail is within the camera's verified ${minimum}–${maximum}V input range.`
          : `A listed ${usableRail}V power rail is within the camera's listed ${minimum}–${maximum}V range, but the available data are not fully verified.`
        : evidenceLevel === "verified"
          ? `None of the flight controller's verified camera power rails are within the camera's verified ${minimum}–${maximum}V input range.`
          : `None of the listed camera power rails fall within the camera's listed ${minimum}–${maximum}V range, but the available data are not verified enough to confirm an incompatibility.`,
    evidence: evidence([
      ["camera.cameraMinVoltageV", minimum],
      ["camera.cameraMaxVoltageV", maximum],
      ["flightController.fcCameraPowerVoltagesV", powerRails.join(", ")],
      ["matchingPowerRailV", usableRail],
    ]),
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}

function receiverFcSignalRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const receiver = selected.receiver;
  const flightController = selected.flightController;
  const categories: Category[] = ["receiver", "flightController"];

  if (!receiver || !flightController) {
    return nonApplicableRule(
      "RECEIVER_FC_SIGNAL_INTERFACE",
      categories,
      "Select both a receiver and flight controller to check their signal interface.",
    );
  }

  const receiverInterface = receiver.receiverSignalInterface;
  const supportedInterfaces = flightController.fcReceiverSignalInterfaces;
  const missingFields = [
    ...(receiverInterface === undefined
      ? ["receiver.receiverSignalInterface"]
      : []),
    ...(supportedInterfaces === undefined
      ? ["flightController.fcReceiverSignalInterfaces"]
      : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["receiver", "receiverSignalInterface"],
    ["flightController", "fcReceiverSignalInterfaces"],
  ];

  if (missingFields.length > 0) {
    return {
      code: "RECEIVER_FC_SIGNAL_INTERFACE",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "The receiver signal interface or the flight controller's supported receiver interfaces are missing, so receiver integration cannot be confirmed.",
      evidence: evidence([
        ["receiver.receiverSignalInterface", receiverInterface],
        [
          "flightController.fcReceiverSignalInterfaces",
          supportedInterfaces?.join(", ") ?? undefined,
        ],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  if (receiverInterface === undefined || supportedInterfaces === undefined) {
    throw new Error("Receiver/FC signal rule reached comparison without required values.");
  }

  const status: CompatibilityRuleStatus = supportedInterfaces.includes(
    receiverInterface,
  )
    ? "pass"
    : "fail";
  const evidenceLevel = deterministicEvidenceLevel(verification, usedFields);

  return {
    code: "RECEIVER_FC_SIGNAL_INTERFACE",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? `The verified receiver interface (${receiverInterface}) is supported by the selected flight controller.`
          : `The listed receiver interface (${receiverInterface}) appears to be supported by the flight controller, but one or both values are not verified.`
        : evidenceLevel === "verified"
          ? `The verified receiver interface (${receiverInterface}) is not supported by the selected flight controller.`
          : `The listed receiver interface (${receiverInterface}) is not in the flight controller's listed receiver interfaces, but the available data are not verified enough to confirm an incompatibility.`,
    evidence: evidence([
      ["receiver.receiverSignalInterface", receiverInterface],
      [
        "flightController.fcReceiverSignalInterfaces",
        supportedInterfaces.join(", "),
      ],
    ]),
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}

function receiverFcPowerRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const receiver = selected.receiver;
  const flightController = selected.flightController;
  const categories: Category[] = ["receiver", "flightController"];

  if (!receiver || !flightController) {
    return nonApplicableRule(
      "RECEIVER_FC_POWER",
      categories,
      "Select both a receiver and flight controller to check receiver power compatibility.",
    );
  }

  const minimum = receiver.receiverMinVoltageV;
  const maximum = receiver.receiverMaxVoltageV;
  const powerRails = flightController.fcReceiverPowerVoltagesV;
  const missingFields = [
    ...(minimum === undefined ? ["receiver.receiverMinVoltageV"] : []),
    ...(maximum === undefined ? ["receiver.receiverMaxVoltageV"] : []),
    ...(powerRails === undefined
      ? ["flightController.fcReceiverPowerVoltagesV"]
      : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["receiver", "receiverMinVoltageV"],
    ["receiver", "receiverMaxVoltageV"],
    ["flightController", "fcReceiverPowerVoltagesV"],
  ];

  if (missingFields.length > 0) {
    return {
      code: "RECEIVER_FC_POWER",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "The receiver input-voltage range or the flight controller's receiver power rails are missing, so receiver power compatibility cannot be confirmed.",
      evidence: evidence([
        ["receiver.receiverMinVoltageV", minimum],
        ["receiver.receiverMaxVoltageV", maximum],
        [
          "flightController.fcReceiverPowerVoltagesV",
          powerRails?.join(", ") ?? undefined,
        ],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  const usableRail = powerRails.find(
    (voltage) => voltage >= minimum && voltage <= maximum,
  );
  const status: CompatibilityRuleStatus =
    usableRail === undefined ? "fail" : "pass";
  const evidenceLevel = deterministicEvidenceLevel(verification, usedFields);

  return {
    code: "RECEIVER_FC_POWER",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? `A verified ${usableRail}V flight-controller rail is within the receiver's verified ${minimum}–${maximum}V input range.`
          : `A listed ${usableRail}V flight-controller rail is within the receiver's listed ${minimum}–${maximum}V range, but the available data are not fully verified.`
        : evidenceLevel === "verified"
          ? `None of the flight controller's verified receiver power rails are within the receiver's verified ${minimum}–${maximum}V input range.`
          : `None of the listed receiver power rails fall within the receiver's listed ${minimum}–${maximum}V range, but the available data are not verified enough to confirm an incompatibility.`,
    evidence: evidence([
      ["receiver.receiverMinVoltageV", minimum],
      ["receiver.receiverMaxVoltageV", maximum],
      ["flightController.fcReceiverPowerVoltagesV", powerRails.join(", ")],
      ["matchingPowerRailV", usableRail],
    ]),
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}

export function evaluateCompatibilityRules(
  selected: SelectedProducts,
  verification: CompatibilityVerification = {},
  technicalEvidence: CompatibilityTechnicalEvidence = {},
): CompatibilityRuleResult[] {
  return [
    frameMotorMountRule(selected, verification),
    framePropellerClearanceRule(selected, verification),
    motorPropellerGuidanceRule(selected, technicalEvidence),
    batteryVoltageRule(selected, verification, "motors", "BATTERY_MOTOR_VOLTAGE", "Motors"),
    batteryVoltageRule(selected, verification, "esc", "BATTERY_ESC_VOLTAGE", "ESC"),
    batteryVoltageRule(
      selected,
      verification,
      "flightController",
      "BATTERY_FC_VOLTAGE",
      "Flight controller",
    ),
    fcEscConnectorRule(selected, technicalEvidence),
    motorEscCurrentRule(selected, verification, technicalEvidence),
    cameraFcVideoInterfaceRule(selected, verification),
    cameraFcPowerRule(selected, verification),
    receiverFcSignalRule(selected, verification),
    receiverFcPowerRule(selected, verification),
  ];
}

export function deriveCompatibilityStatus(
  rules: readonly CompatibilityRuleResult[],
  complete: boolean,
): CompatibilityState {
  if (
    rules.some(
      (rule) => rule.applicable && rule.status === "fail" && rule.evidenceLevel === "verified",
    )
  ) {
    return "incompatible";
  }

  if (!complete) return "potentially-compatible";

  const applicableRules = rules.filter((rule) => rule.applicable);
  if (applicableRules.length === 0) return "potentially-compatible";

  if (applicableRules.some((rule) => rule.status !== "pass" || rule.evidenceLevel !== "verified")) {
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
  technicalEvidence: CompatibilityTechnicalEvidence = {},
): CompatibilityEvaluation {
  const frame = selected.frame;
  const motors = selected.motors;
  const props = selected.propellers;
  const battery = selected.battery;
  const esc = selected.esc;

  const rules = evaluateCompatibilityRules(selected, verification, technicalEvidence);
  const complete = categories.every((category) => !!selected[category]);
  const count = categories.filter((category) => !!selected[category]).length;
  const price = categories.reduce((sum, category) => sum + (selected[category]?.price ?? 0), 0);

  const warnings = rules
    .filter(
      (rule) => rule.applicable && (rule.status === "fail" || rule.advisoryOutcome === "fail"),
    )
    .map((rule) => rule.explanation);

  const missing = rules
    .filter((rule) => rule.applicable && rule.status === "unknown" && rule.missingFields.length > 0)
    .map((rule) => rule.explanation);

  const enoughPerformance = !!(frame && motors && props && battery && esc);
  const weight = enoughPerformance
    ? Math.round(
        categories.reduce((sum, category) => sum + (selected[category]?.weight ?? 0), 0) + 80,
      )
    : null;
  const speed =
    enoughPerformance && weight && motors?.thrust && battery?.voltage && props?.propInches
      ? Math.round(
          Math.min(
            180,
            ((motors.thrust * 4) / weight) * 12 + battery.voltage * 4 + props.propInches * 3,
          ),
        )
      : null;

  const legacyScoreRuleCodes = new Set<CompatibilityRuleCode>([
    "FRAME_MOTOR_MOUNT",
    "FRAME_PROPELLER_CLEARANCE",
    "MOTOR_PROPELLER_SIZE_GUIDANCE",
    "BATTERY_MOTOR_VOLTAGE",
    "BATTERY_ESC_VOLTAGE",
    "BATTERY_FC_VOLTAGE",
    "FC_ESC_CONNECTOR",
    "MOTOR_ESC_CURRENT",
  ]);
  const blocksPerformanceScore = rules.some(
    (rule) =>
      legacyScoreRuleCodes.has(rule.code) &&
      rule.applicable &&
      (rule.status === "fail" ||
        rule.advisoryOutcome === "fail" ||
        (rule.status === "unknown" && rule.missingFields.length > 0)),
  );
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
  technicalEvidence: CompatibilityTechnicalEvidence = {},
): CandidateCheck {
  const result = evaluate({ ...selected, [category]: candidate }, verification, technicalEvidence);
  const relevantRules = result.rules.filter((rule) => rule.categories.includes(category));
  const applicableRules = relevantRules.filter((rule) => rule.applicable);

  let status: CompatibilityState = "potentially-compatible";

  if (applicableRules.some((rule) => rule.status === "fail" && rule.evidenceLevel === "verified")) {
    status = "incompatible";
  } else if (
    relevantRules.length > 0 &&
    relevantRules.every(
      (rule) => rule.applicable && rule.status === "pass" && rule.evidenceLevel === "verified",
    )
  ) {
    status = "verified-compatible";
  }

  const messages = Array.from(
    new Set(
      relevantRules
        .filter(
          (rule) => !rule.applicable || rule.status !== "pass" || rule.evidenceLevel !== "verified",
        )
        .map((rule) => rule.explanation),
    ),
  );

  if (relevantRules.length === 0) {
    messages.push("No current compatibility rule verifies this component category yet.");
  } else if (messages.length === 0 && status === "verified-compatible") {
    messages.push(
      "This component passes every currently applicable verified compatibility rule. This is not a flight-safety guarantee.",
    );
  }

  return { status, messages, rules: relevantRules };
}
