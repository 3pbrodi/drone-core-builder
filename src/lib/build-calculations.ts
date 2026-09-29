import { allCategoryIds, type Category, type Product } from "./build-data";
import { droneMountedCategoryIds } from "./component-categories";
import { requiredCategoriesForSelection, selectionPriceSummary } from "./configurator-selection";

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
  | "RECEIVER_FC_POWER"
  | "RADIO_RECEIVER_PROTOCOL"
  | "GOGGLES_VIDEO_SYSTEM"
  | "BATTERY_CHARGER"
  | "CHARGING_ACCESSORY_CONNECTOR"
  | "VTX_CAMERA_INTERFACE"
  | "VTX_ANTENNA"
  | "GPS_FC_INTEGRATION"
  | "BUZZER_FC_INTEGRATION";

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
    ...(supportedInterfaces === undefined ? ["flightController.fcCameraVideoInterfaces"] : []),
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
        ["flightController.fcCameraVideoInterfaces", supportedInterfaces?.join(", ") ?? undefined],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  if (cameraInterface === undefined || supportedInterfaces === undefined) {
    throw new Error("Camera/FC video rule reached comparison without required values.");
  }

  const status: CompatibilityRuleStatus = supportedInterfaces.includes(cameraInterface)
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
      ["flightController.fcCameraVideoInterfaces", supportedInterfaces.join(", ")],
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
    ...(powerRails === undefined ? ["flightController.fcCameraPowerVoltagesV"] : []),
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
        ["flightController.fcCameraPowerVoltagesV", powerRails?.join(", ") ?? undefined],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  if (minimum === undefined || maximum === undefined || powerRails === undefined) {
    throw new Error("Camera/FC power rule reached comparison without required values.");
  }

  const usableRail = powerRails.find((voltage) => voltage >= minimum && voltage <= maximum);
  const status: CompatibilityRuleStatus = usableRail === undefined ? "fail" : "pass";
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
    ...(receiverInterface === undefined ? ["receiver.receiverSignalInterface"] : []),
    ...(supportedInterfaces === undefined ? ["flightController.fcReceiverSignalInterfaces"] : []),
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

  const status: CompatibilityRuleStatus = supportedInterfaces.includes(receiverInterface)
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
      ["flightController.fcReceiverSignalInterfaces", supportedInterfaces.join(", ")],
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
    ...(powerRails === undefined ? ["flightController.fcReceiverPowerVoltagesV"] : []),
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
        ["flightController.fcReceiverPowerVoltagesV", powerRails?.join(", ") ?? undefined],
      ]),
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  }

  if (minimum === undefined || maximum === undefined || powerRails === undefined) {
    throw new Error("Receiver/FC power rule reached comparison without required values.");
  }

  const usableRail = powerRails.find((voltage) => voltage >= minimum && voltage <= maximum);
  const status: CompatibilityRuleStatus = usableRail === undefined ? "fail" : "pass";
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

function normalizedCompatibilityText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
function listSupports(values: readonly string[], value: string) {
  const expected = normalizedCompatibilityText(value);
  return values.some((item) => normalizedCompatibilityText(item) === expected);
}
function radioReceiverProtocolRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const receiver = selected.receiver,
    radio = selected.radioTransmitter,
    categories: Category[] = ["receiver", "radioTransmitter"];
  if (!receiver || !radio)
    return nonApplicableRule(
      "RADIO_RECEIVER_PROTOCOL",
      categories,
      "Select an onboard receiver and radio transmitter to verify their radio protocol.",
    );
  const missingFields = [
    ...(receiver.receiverProtocol === undefined ? ["receiver.receiverProtocol"] : []),
    ...(radio.radioProtocols === undefined ? ["radioTransmitter.radioProtocols"] : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["receiver", "receiverProtocol"],
    ["radioTransmitter", "radioProtocols"],
  ];
  if (missingFields.length)
    return {
      code: "RADIO_RECEIVER_PROTOCOL",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "The receiver protocol or transmitter protocol support is not documented well enough to verify this link.",
      evidence: {},
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  const status: CompatibilityRuleStatus = listSupports(
      radio.radioProtocols!,
      receiver.receiverProtocol!,
    )
      ? "pass"
      : "fail",
    evidenceLevel = deterministicEvidenceLevel(verification, usedFields);
  return {
    code: "RADIO_RECEIVER_PROTOCOL",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? "The verified radio transmitter protocols include the selected receiver protocol."
          : "The listed radio protocols match, but the evidence is not fully verified."
        : evidenceLevel === "verified"
          ? "The verified radio transmitter protocols do not include the selected receiver protocol."
          : "The listed protocols do not match, but the evidence is not fully verified.",
    evidence: {},
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}
function gogglesVideoSystemRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const goggles = selected.fpvGoggles,
    source = selected.videoTransmitter ?? selected.camera,
    categories: Category[] = source
      ? [source.category, "fpvGoggles"]
      : ["camera", "videoTransmitter", "fpvGoggles"];
  if (!goggles || !source)
    return nonApplicableRule(
      "GOGGLES_VIDEO_SYSTEM",
      categories,
      "Select a video source and FPV goggles to verify the video ecosystem.",
    );
  const sourceField: keyof Product =
      source.category === "videoTransmitter" ? "videoTransmitterSystem" : "video",
    system = source[sourceField] as string | undefined;
  const missingFields = [
    ...(system === undefined ? [source.category + "." + String(sourceField)] : []),
    ...(goggles.supportedVideoSystems === undefined ? ["fpvGoggles.supportedVideoSystems"] : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    [source.category, sourceField],
    ["fpvGoggles", "supportedVideoSystems"],
  ];
  if (missingFields.length)
    return {
      code: "GOGGLES_VIDEO_SYSTEM",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "The selected video system or goggle ecosystem support is missing, so compatibility cannot be verified.",
      evidence: {},
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  const status: CompatibilityRuleStatus = listSupports(goggles.supportedVideoSystems!, system!)
      ? "pass"
      : "fail",
    evidenceLevel = deterministicEvidenceLevel(verification, usedFields);
  return {
    code: "GOGGLES_VIDEO_SYSTEM",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? "The verified goggles support the selected verified video system."
          : "The listed goggles and video system appear to match, but evidence is incomplete."
        : evidenceLevel === "verified"
          ? "The verified goggles do not support the selected video system."
          : "The listed video systems do not match, but evidence is incomplete.",
    evidence: {},
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}
function batteryChargerRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const battery = selected.battery,
    charger = selected.batteryCharger,
    categories: Category[] = ["battery", "batteryCharger"];
  if (!battery || !charger)
    return nonApplicableRule(
      "BATTERY_CHARGER",
      categories,
      "Select a battery and charger to verify charging compatibility.",
    );
  const missingFields = [
    ...(battery.batteryChemistry === undefined ? ["battery.batteryChemistry"] : []),
    ...(battery.voltage === undefined ? ["battery.voltage"] : []),
    ...(battery.batteryConnector === undefined ? ["battery.batteryConnector"] : []),
    ...(charger.chargerBatteryChemistries === undefined
      ? ["batteryCharger.chargerBatteryChemistries"]
      : []),
    ...(charger.chargerMinCells === undefined ? ["batteryCharger.chargerMinCells"] : []),
    ...(charger.chargerMaxCells === undefined ? ["batteryCharger.chargerMaxCells"] : []),
    ...(charger.chargerConnectors === undefined ? ["batteryCharger.chargerConnectors"] : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["battery", "batteryChemistry"],
    ["battery", "voltage"],
    ["battery", "batteryConnector"],
    ["batteryCharger", "chargerBatteryChemistries"],
    ["batteryCharger", "chargerMinCells"],
    ["batteryCharger", "chargerMaxCells"],
    ["batteryCharger", "chargerConnectors"],
  ];
  if (missingFields.length)
    return {
      code: "BATTERY_CHARGER",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation:
        "Battery chemistry, cell count, connector, or charger limits are incomplete, so charging compatibility cannot be verified.",
      evidence: {},
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  const status: CompatibilityRuleStatus =
      listSupports(charger.chargerBatteryChemistries!, battery.batteryChemistry!) &&
      battery.voltage! >= charger.chargerMinCells! &&
      battery.voltage! <= charger.chargerMaxCells! &&
      listSupports(charger.chargerConnectors!, battery.batteryConnector!)
        ? "pass"
        : "fail",
    evidenceLevel = deterministicEvidenceLevel(verification, usedFields);
  return {
    code: "BATTERY_CHARGER",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? "The verified charger supports the battery chemistry, cell count, and connector."
          : "The listed charging requirements match, but some evidence is unverified."
        : evidenceLevel === "verified"
          ? "At least one verified battery charging requirement is not supported by the charger."
          : "At least one listed charging requirement does not match, but some evidence is unverified.",
    evidence: {},
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}
function chargingAccessoryConnectorRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const accessory = selected.chargingAccessory,
    battery = selected.battery,
    charger = selected.batteryCharger,
    categories: Category[] = ["chargingAccessory", "battery", "batteryCharger"];
  if (!accessory || !battery || !charger)
    return nonApplicableRule(
      "CHARGING_ACCESSORY_CONNECTOR",
      categories,
      "Select a charging accessory, battery, and charger to verify connector compatibility.",
    );
  const missingFields = [
    ...(accessory.chargingConnectors === undefined ? ["chargingAccessory.chargingConnectors"] : []),
    ...(battery.batteryConnector === undefined ? ["battery.batteryConnector"] : []),
    ...(charger.chargerConnectors === undefined ? ["batteryCharger.chargerConnectors"] : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["chargingAccessory", "chargingConnectors"],
    ["battery", "batteryConnector"],
    ["batteryCharger", "chargerConnectors"],
  ];
  if (missingFields.length)
    return {
      code: "CHARGING_ACCESSORY_CONNECTOR",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation: "Charging connector data are incomplete.",
      evidence: {},
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  const status: CompatibilityRuleStatus =
      listSupports(accessory.chargingConnectors!, battery.batteryConnector!) &&
      charger.chargerConnectors!.some((item) => listSupports(accessory.chargingConnectors!, item))
        ? "pass"
        : "fail",
    evidenceLevel = deterministicEvidenceLevel(verification, usedFields);
  return {
    code: "CHARGING_ACCESSORY_CONNECTOR",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? "The verified charging accessory exposes connectors compatible with both battery and charger."
          : "The listed charging connectors appear compatible, but evidence is incomplete."
        : evidenceLevel === "verified"
          ? "The verified charging accessory does not bridge the selected battery and charger connectors."
          : "The listed charging connectors do not line up, but evidence is incomplete.",
    evidence: {},
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}
function vtxCameraInterfaceRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const vtx = selected.videoTransmitter,
    camera = selected.camera,
    categories: Category[] = ["videoTransmitter", "camera"];
  if (!vtx || !camera)
    return nonApplicableRule(
      "VTX_CAMERA_INTERFACE",
      categories,
      "Select a camera and standalone VTX to verify their video interface.",
    );
  const missingFields = [
      ...(camera.cameraVideoInterface === undefined ? ["camera.cameraVideoInterface"] : []),
      ...(vtx.vtxCameraVideoInterfaces === undefined
        ? ["videoTransmitter.vtxCameraVideoInterfaces"]
        : []),
    ],
    usedFields: Array<[Category, keyof Product]> = [
      ["camera", "cameraVideoInterface"],
      ["videoTransmitter", "vtxCameraVideoInterfaces"],
    ];
  if (missingFields.length)
    return {
      code: "VTX_CAMERA_INTERFACE",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation: "Camera/VTX interface data are incomplete.",
      evidence: {},
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  const status: CompatibilityRuleStatus = listSupports(
      vtx.vtxCameraVideoInterfaces!,
      camera.cameraVideoInterface!,
    )
      ? "pass"
      : "fail",
    evidenceLevel = deterministicEvidenceLevel(verification, usedFields);
  return {
    code: "VTX_CAMERA_INTERFACE",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? "The verified VTX accepts the selected camera video interface."
          : "The listed camera/VTX interfaces match, but evidence is incomplete."
        : evidenceLevel === "verified"
          ? "The verified VTX does not accept the selected camera video interface."
          : "The listed camera/VTX interfaces do not match, but evidence is incomplete.",
    evidence: {},
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}
function vtxAntennaRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
): CompatibilityRuleResult {
  const vtx = selected.videoTransmitter,
    antenna = selected.antenna,
    categories: Category[] = ["videoTransmitter", "antenna"];
  if (!vtx || !antenna)
    return nonApplicableRule(
      "VTX_ANTENNA",
      categories,
      "Select a standalone VTX and antenna to verify connector and frequency coverage.",
    );
  const missingFields = [
    ...(vtx.vtxAntennaConnector === undefined ? ["videoTransmitter.vtxAntennaConnector"] : []),
    ...(vtx.vtxFrequencyMinMhz === undefined ? ["videoTransmitter.vtxFrequencyMinMhz"] : []),
    ...(vtx.vtxFrequencyMaxMhz === undefined ? ["videoTransmitter.vtxFrequencyMaxMhz"] : []),
    ...(antenna.antennaConnector === undefined ? ["antenna.antennaConnector"] : []),
    ...(antenna.antennaFrequencyMinMhz === undefined ? ["antenna.antennaFrequencyMinMhz"] : []),
    ...(antenna.antennaFrequencyMaxMhz === undefined ? ["antenna.antennaFrequencyMaxMhz"] : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    ["videoTransmitter", "vtxAntennaConnector"],
    ["videoTransmitter", "vtxFrequencyMinMhz"],
    ["videoTransmitter", "vtxFrequencyMaxMhz"],
    ["antenna", "antennaConnector"],
    ["antenna", "antennaFrequencyMinMhz"],
    ["antenna", "antennaFrequencyMaxMhz"],
  ];
  if (missingFields.length)
    return {
      code: "VTX_ANTENNA",
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation: "VTX/antenna connector or frequency data are incomplete.",
      evidence: {},
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  const status: CompatibilityRuleStatus =
      normalizedCompatibilityText(vtx.vtxAntennaConnector!) ===
        normalizedCompatibilityText(antenna.antennaConnector!) &&
      antenna.antennaFrequencyMinMhz! <= vtx.vtxFrequencyMinMhz! &&
      antenna.antennaFrequencyMaxMhz! >= vtx.vtxFrequencyMaxMhz!
        ? "pass"
        : "fail",
    evidenceLevel = deterministicEvidenceLevel(verification, usedFields);
  return {
    code: "VTX_ANTENNA",
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? "The verified antenna connector and frequency range cover the selected VTX."
          : "The listed VTX/antenna data match, but evidence is incomplete."
        : evidenceLevel === "verified"
          ? "The verified antenna connector or frequency range is incompatible with the selected VTX."
          : "The listed VTX/antenna data do not match, but evidence is incomplete.",
    evidence: {},
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}
function peripheralFcRule(
  selected: SelectedProducts,
  verification: CompatibilityVerification,
  category: "gps" | "buzzer",
  code: "GPS_FC_INTEGRATION" | "BUZZER_FC_INTEGRATION",
  label: string,
): CompatibilityRuleResult {
  const device = selected[category],
    fc = selected.flightController,
    categories: Category[] = [category, "flightController"];
  if (!device || !fc)
    return nonApplicableRule(
      code,
      categories,
      `Select both a ${label} and flight controller to verify the interface and power rail.`,
    );
  const missingFields = [
    ...(device.deviceSignalInterface === undefined ? [`${category}.deviceSignalInterface`] : []),
    ...(device.deviceMinVoltageV === undefined ? [`${category}.deviceMinVoltageV`] : []),
    ...(device.deviceMaxVoltageV === undefined ? [`${category}.deviceMaxVoltageV`] : []),
    ...(fc.fcPeripheralInterfaces === undefined ? ["flightController.fcPeripheralInterfaces"] : []),
    ...(fc.fcPeripheralPowerVoltagesV === undefined
      ? ["flightController.fcPeripheralPowerVoltagesV"]
      : []),
  ];
  const usedFields: Array<[Category, keyof Product]> = [
    [category, "deviceSignalInterface"],
    [category, "deviceMinVoltageV"],
    [category, "deviceMaxVoltageV"],
    ["flightController", "fcPeripheralInterfaces"],
    ["flightController", "fcPeripheralPowerVoltagesV"],
  ];
  if (missingFields.length)
    return {
      code,
      categories,
      applicable: true,
      status: "unknown",
      evidenceLevel: "unverified",
      explanation: `${label} interface or power data are incomplete.`,
      evidence: {},
      missingFields,
      unverifiedFields: unverifiedFields(verification, usedFields),
    };
  const status: CompatibilityRuleStatus =
      listSupports(fc.fcPeripheralInterfaces!, device.deviceSignalInterface!) &&
      fc.fcPeripheralPowerVoltagesV!.some(
        (voltage) => voltage >= device.deviceMinVoltageV! && voltage <= device.deviceMaxVoltageV!,
      )
        ? "pass"
        : "fail",
    evidenceLevel = deterministicEvidenceLevel(verification, usedFields);
  return {
    code,
    categories,
    applicable: true,
    status,
    evidenceLevel,
    explanation:
      status === "pass"
        ? evidenceLevel === "verified"
          ? `The verified flight-controller interface and power rail support the selected ${label}.`
          : `The listed ${label}/FC interface and power data match, but evidence is incomplete.`
        : evidenceLevel === "verified"
          ? `The verified flight-controller interface or power rail does not support the selected ${label}.`
          : `The listed ${label}/FC data do not match, but evidence is incomplete.`,
    evidence: {},
    missingFields: [],
    unverifiedFields: unverifiedFields(verification, usedFields),
  };
}
export function evaluateCompatibilityRules(
  selected: SelectedProducts,
  verification: CompatibilityVerification = {},
  technicalEvidence: CompatibilityTechnicalEvidence = {},
): CompatibilityRuleResult[] {
  const rules: CompatibilityRuleResult[] = [
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

  // Preserve the legacy 12-rule surface for builds that use only the original
  // eight categories. Optional/Pilot Gear rules enter evaluation only when the
  // corresponding new category is actually selected.
  if (selected.radioTransmitter) rules.push(radioReceiverProtocolRule(selected, verification));
  if (selected.fpvGoggles) rules.push(gogglesVideoSystemRule(selected, verification));
  if (selected.batteryCharger) rules.push(batteryChargerRule(selected, verification));
  if (selected.chargingAccessory)
    rules.push(chargingAccessoryConnectorRule(selected, verification));
  if (selected.videoTransmitter) rules.push(vtxCameraInterfaceRule(selected, verification));
  if (selected.antenna) rules.push(vtxAntennaRule(selected, verification));
  if (selected.gps) {
    rules.push(
      peripheralFcRule(selected, verification, "gps", "GPS_FC_INTEGRATION", "GPS / GNSS module"),
    );
  }
  if (selected.buzzer) {
    rules.push(
      peripheralFcRule(selected, verification, "buzzer", "BUZZER_FC_INTEGRATION", "buzzer"),
    );
  }

  return rules;
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
  const requiredCategories = requiredCategoriesForSelection(selected);
  const complete = requiredCategories.every((category) => !!selected[category]);
  const count = allCategoryIds.filter((category) => !!selected[category]).length;
  const pricing = selectionPriceSummary(selected);
  const price = pricing.overall;

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
        droneMountedCategoryIds.reduce(
          (sum, category) => sum + (selected[category]?.weight ?? 0),
          0,
        ) + 80,
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
    dronePrice: pricing.drone,
    pilotGearPrice: pricing.pilotGear,
    totalPrice: pricing.overall,
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
    applicableRules.length > 0 &&
    applicableRules.every((rule) => rule.status === "pass" && rule.evidenceLevel === "verified")
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
