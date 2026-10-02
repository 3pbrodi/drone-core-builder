export const coreRequiredCategoryIds = [
  "frame",
  "motors",
  "flightController",
  "esc",
  "propellers",
  "battery",
  "camera",
  "receiver",
] as const;

export const optionalCategoryIds = [
  "videoTransmitter",
  "gps",
  "buzzer",
  "antenna",
  "powerAccessory",
  "optionalModule",
] as const;

export const pilotGearCategoryIds = [
  "radioTransmitter",
  "fpvGoggles",
  "batteryCharger",
  "chargingAccessory",
] as const;

export const allCategoryIds = [
  ...coreRequiredCategoryIds,
  ...optionalCategoryIds,
  ...pilotGearCategoryIds,
] as const;

export type Category = (typeof allCategoryIds)[number];
export type ConfiguratorSection = "required" | "optional" | "pilotGear";
export type InstallationRole = "drone" | "pilot";

export type ComponentCategoryMetadata = {
  id: Category;
  label: string;
  section: ConfiguratorSection;
  installationRole: InstallationRole;
  requiredByDefault: boolean;
  compatibilityDependencies: readonly Category[];
  canBeFulfilledByIntegration: boolean;
  allowsMultiple: boolean;
};

export const categoryMetadata = {
  frame: {
    id: "frame",
    label: "Frame",
    section: "required",
    installationRole: "drone",
    requiredByDefault: true,
    compatibilityDependencies: ["motors", "propellers"],
    canBeFulfilledByIntegration: false,
    allowsMultiple: false,
  },
  motors: {
    id: "motors",
    label: "Motors",
    section: "required",
    installationRole: "drone",
    requiredByDefault: true,
    compatibilityDependencies: ["frame", "propellers", "battery", "esc"],
    canBeFulfilledByIntegration: false,
    allowsMultiple: false,
  },
  flightController: {
    id: "flightController",
    label: "Flight Controller",
    section: "required",
    installationRole: "drone",
    requiredByDefault: true,
    compatibilityDependencies: ["battery", "esc", "camera", "receiver", "gps", "buzzer"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: false,
  },
  esc: {
    id: "esc",
    label: "ESC",
    section: "required",
    installationRole: "drone",
    requiredByDefault: true,
    compatibilityDependencies: ["battery", "flightController", "motors"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: false,
  },
  propellers: {
    id: "propellers",
    label: "Propellers",
    section: "required",
    installationRole: "drone",
    requiredByDefault: true,
    compatibilityDependencies: ["frame", "motors"],
    canBeFulfilledByIntegration: false,
    allowsMultiple: false,
  },
  battery: {
    id: "battery",
    label: "Battery",
    section: "required",
    installationRole: "drone",
    requiredByDefault: true,
    compatibilityDependencies: [
      "motors",
      "esc",
      "flightController",
      "batteryCharger",
      "chargingAccessory",
    ],
    canBeFulfilledByIntegration: false,
    allowsMultiple: false,
  },
  camera: {
    id: "camera",
    label: "Camera / Video System",
    section: "required",
    installationRole: "drone",
    requiredByDefault: true,
    compatibilityDependencies: ["flightController", "videoTransmitter", "fpvGoggles"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: false,
  },
  receiver: {
    id: "receiver",
    label: "Receiver",
    section: "required",
    installationRole: "drone",
    requiredByDefault: true,
    compatibilityDependencies: ["flightController", "radioTransmitter"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: false,
  },
  videoTransmitter: {
    id: "videoTransmitter",
    label: "Video Transmitter (VTX)",
    section: "optional",
    installationRole: "drone",
    requiredByDefault: false,
    compatibilityDependencies: ["camera", "antenna", "fpvGoggles"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: false,
  },
  gps: {
    id: "gps",
    label: "GPS / GNSS Module",
    section: "optional",
    installationRole: "drone",
    requiredByDefault: false,
    compatibilityDependencies: ["flightController"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: false,
  },
  buzzer: {
    id: "buzzer",
    label: "Buzzer / Lost Model Finder",
    section: "optional",
    installationRole: "drone",
    requiredByDefault: false,
    compatibilityDependencies: ["flightController"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: false,
  },
  antenna: {
    id: "antenna",
    label: "Additional Antennas",
    section: "optional",
    installationRole: "drone",
    requiredByDefault: false,
    compatibilityDependencies: ["videoTransmitter"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: true,
  },
  powerAccessory: {
    id: "powerAccessory",
    label: "Power Accessories",
    section: "optional",
    installationRole: "drone",
    requiredByDefault: false,
    compatibilityDependencies: ["battery", "esc", "flightController"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: true,
  },
  optionalModule: {
    id: "optionalModule",
    label: "Other Optional Modules",
    section: "optional",
    installationRole: "drone",
    requiredByDefault: false,
    compatibilityDependencies: ["flightController"],
    canBeFulfilledByIntegration: true,
    allowsMultiple: true,
  },
  radioTransmitter: {
    id: "radioTransmitter",
    label: "Radio Transmitter / Remote Controller",
    section: "pilotGear",
    installationRole: "pilot",
    requiredByDefault: false,
    compatibilityDependencies: ["receiver"],
    canBeFulfilledByIntegration: false,
    allowsMultiple: false,
  },
  fpvGoggles: {
    id: "fpvGoggles",
    label: "FPV Goggles / Video Receiver",
    section: "pilotGear",
    installationRole: "pilot",
    requiredByDefault: false,
    compatibilityDependencies: ["camera", "videoTransmitter"],
    canBeFulfilledByIntegration: false,
    allowsMultiple: false,
  },
  batteryCharger: {
    id: "batteryCharger",
    label: "Battery Charger",
    section: "pilotGear",
    installationRole: "pilot",
    requiredByDefault: false,
    compatibilityDependencies: ["battery", "chargingAccessory"],
    canBeFulfilledByIntegration: false,
    allowsMultiple: false,
  },
  chargingAccessory: {
    id: "chargingAccessory",
    label: "Charging Accessories",
    section: "pilotGear",
    installationRole: "pilot",
    requiredByDefault: false,
    compatibilityDependencies: ["battery", "batteryCharger"],
    canBeFulfilledByIntegration: false,
    allowsMultiple: true,
  },
} as const satisfies Record<Category, ComponentCategoryMetadata>;

export const categoryNames = Object.fromEntries(
  allCategoryIds.map((category) => [category, categoryMetadata[category].label]),
) as Record<Category, string>;

export const sectionOrder = ["required", "optional", "pilotGear"] as const;
export const sectionMetadata: Record<ConfiguratorSection, { label: string; description: string }> =
  {
    required: {
      label: "Required",
      description:
        "Core components needed by this configuration. Integrated functions are not duplicated.",
    },
    optional: {
      label: "Optional",
      description: "Drone-mounted modules you can add without blocking build completion.",
    },
    pilotGear: {
      label: "Pilot Gear",
      description:
        "External pilot equipment. It is priced separately and never counted as drone-mounted hardware.",
    },
  };
export const droneMountedCategoryIds = allCategoryIds.filter(
  (category) => categoryMetadata[category].installationRole === "drone",
) as Category[];
