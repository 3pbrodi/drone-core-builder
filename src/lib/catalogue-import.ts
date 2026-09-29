import { z } from "zod";
import { allCategoryIds, type Category } from "./build-data";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const optionalNumber = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().finite().nonnegative().optional(),
);

const optionalPositiveNumber = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().finite().positive().optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional(),
);

const optionalPositiveInteger = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const optionalBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return value;
}, z.boolean().optional());

const optionalTextList = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value !== "string" || value.trim() === "") return undefined;
    return value
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  },
  z.array(z.string().min(1)).min(1).optional(),
);

const optionalCategoryList = z.preprocess(
  (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || value.trim() === "") return undefined;
    return value
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  },
  z.array(z.enum(allCategoryIds)).min(1).optional(),
);

const optionalPositiveNumberList = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}, z.array(z.coerce.number().finite().positive()).min(1).optional());

export const catalogueProductCsvColumns = [
  "id",
  "category",
  "display_name",
  "manufacturer",
  "model",
  "variant",
  "mpn",
  "manufacturer_sku",
  "spec_summary",
  "weight_grams",
  "frame_size_inches",
  "motor_mount_pattern",
  "propeller_diameter_inches",
  "motor_size_code",
  "motor_stator_width_mm",
  "motor_stator_height_mm",
  "motor_kv",
  "min_battery_cells",
  "max_battery_cells",
  "connector",
  "esc_input",
  "thrust_grams",
  "peak_current_amps",
  "esc_amps",
  "battery_cells",
  "battery_capacity_mah",
  "battery_discharge_c",
  "video_system",
  "camera_video_interface",
  "camera_min_voltage_v",
  "camera_max_voltage_v",
  "camera_width_mm",
  "camera_height_mm",
  "camera_depth_mm",
  "fc_camera_video_interfaces",
  "fc_camera_power_voltages_v",
  "receiver_protocol",
  "receiver_frequency_min_mhz",
  "receiver_frequency_max_mhz",
  "receiver_min_voltage_v",
  "receiver_max_voltage_v",
  "receiver_signal_interface",
  "receiver_width_mm",
  "receiver_height_mm",
  "receiver_depth_mm",
  "fc_receiver_signal_interfaces",
  "fc_receiver_power_voltages_v",
  "integrated_categories",
  "included_categories",
  "battery_chemistry",
  "battery_connector",
  "fc_peripheral_interfaces",
  "fc_peripheral_power_voltages_v",
  "video_transmitter_system",
  "vtx_camera_video_interfaces",
  "vtx_antenna_connector",
  "vtx_frequency_min_mhz",
  "vtx_frequency_max_mhz",
  "antenna_connector",
  "antenna_frequency_min_mhz",
  "antenna_frequency_max_mhz",
  "radio_protocols",
  "supported_video_systems",
  "charger_battery_chemistries",
  "charger_min_cells",
  "charger_max_cells",
  "charger_connectors",
  "charging_connectors",
  "device_signal_interface",
  "device_min_voltage_v",
  "device_max_voltage_v",
  "image_url",
  "image_source_url",
  "image_alt",
  "image_exact_model_verified",
  "image_provenance",
  "image_license_name",
  "image_license_url",
  "source_external_product_id",
  "source_url",
] as const;

export const productImportSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Use a stable ID with letters, numbers, . _ : or -."),
    category: z.enum(allCategoryIds),
    display_name: z.string().trim().min(1),
    manufacturer: optionalText,
    model: optionalText,
    variant: optionalText,
    mpn: optionalText,
    manufacturer_sku: optionalText,
    spec_summary: optionalText,
    weight_grams: optionalNumber,
    frame_size_inches: optionalPositiveNumber,
    motor_mount_pattern: optionalText,
    propeller_diameter_inches: optionalPositiveNumber,
    motor_size_code: optionalPositiveInteger,
    motor_stator_width_mm: optionalPositiveNumber,
    motor_stator_height_mm: optionalPositiveNumber,
    motor_kv: optionalPositiveInteger,
    min_battery_cells: optionalPositiveInteger,
    max_battery_cells: optionalPositiveInteger,
    connector: optionalText,
    esc_input: optionalText,
    thrust_grams: optionalNumber,
    peak_current_amps: optionalNumber,
    esc_amps: optionalNumber,
    battery_cells: optionalPositiveInteger,
    battery_capacity_mah: optionalPositiveInteger,
    battery_discharge_c: optionalPositiveNumber,
    video_system: optionalText,
    camera_video_interface: optionalText,
    camera_min_voltage_v: optionalPositiveNumber,
    camera_max_voltage_v: optionalPositiveNumber,
    camera_width_mm: optionalPositiveNumber,
    camera_height_mm: optionalPositiveNumber,
    camera_depth_mm: optionalPositiveNumber,
    fc_camera_video_interfaces: optionalTextList,
    fc_camera_power_voltages_v: optionalPositiveNumberList,
    receiver_protocol: optionalText,
    receiver_frequency_min_mhz: optionalPositiveNumber,
    receiver_frequency_max_mhz: optionalPositiveNumber,
    receiver_min_voltage_v: optionalPositiveNumber,
    receiver_max_voltage_v: optionalPositiveNumber,
    receiver_signal_interface: optionalText,
    receiver_width_mm: optionalPositiveNumber,
    receiver_height_mm: optionalPositiveNumber,
    receiver_depth_mm: optionalPositiveNumber,
    fc_receiver_signal_interfaces: optionalTextList,
    fc_receiver_power_voltages_v: optionalPositiveNumberList,
    integrated_categories: optionalCategoryList,
    included_categories: optionalCategoryList,
    battery_chemistry: optionalText,
    battery_connector: optionalText,
    fc_peripheral_interfaces: optionalTextList,
    fc_peripheral_power_voltages_v: optionalPositiveNumberList,
    video_transmitter_system: optionalText,
    vtx_camera_video_interfaces: optionalTextList,
    vtx_antenna_connector: optionalText,
    vtx_frequency_min_mhz: optionalPositiveNumber,
    vtx_frequency_max_mhz: optionalPositiveNumber,
    antenna_connector: optionalText,
    antenna_frequency_min_mhz: optionalPositiveNumber,
    antenna_frequency_max_mhz: optionalPositiveNumber,
    radio_protocols: optionalTextList,
    supported_video_systems: optionalTextList,
    charger_battery_chemistries: optionalTextList,
    charger_min_cells: optionalPositiveInteger,
    charger_max_cells: optionalPositiveInteger,
    charger_connectors: optionalTextList,
    charging_connectors: optionalTextList,
    device_signal_interface: optionalText,
    device_min_voltage_v: optionalPositiveNumber,
    device_max_voltage_v: optionalPositiveNumber,
    image_url: optionalUrl,
    image_source_url: optionalUrl,
    image_alt: optionalText,
    image_exact_model_verified: optionalBoolean,
    image_provenance: optionalText,
    image_license_name: optionalText,
    image_license_url: optionalUrl,
    source_external_product_id: optionalText,
    source_url: optionalUrl,
  })
  .superRefine((row, context) => {
    if (
      row.min_battery_cells !== undefined &&
      row.max_battery_cells !== undefined &&
      row.min_battery_cells > row.max_battery_cells
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max_battery_cells"],
        message: "max_battery_cells must be greater than or equal to min_battery_cells.",
      });
    }

    if (row.image_exact_model_verified && !row.image_url) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["image_exact_model_verified"],
        message: "An image cannot be marked exact-model verified without image_url.",
      });
    }

    for (const [minField, maxField] of [
      ["camera_min_voltage_v", "camera_max_voltage_v"],
      ["receiver_frequency_min_mhz", "receiver_frequency_max_mhz"],
      ["receiver_min_voltage_v", "receiver_max_voltage_v"],
      ["vtx_frequency_min_mhz", "vtx_frequency_max_mhz"],
      ["antenna_frequency_min_mhz", "antenna_frequency_max_mhz"],
      ["device_min_voltage_v", "device_max_voltage_v"],
      ["charger_min_cells", "charger_max_cells"],
    ] as const) {
      const minimum = row[minField];
      const maximum = row[maxField];
      if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [maxField],
          message: `${maxField} must be greater than or equal to ${minField}.`,
        });
      }
    }
  });

export type CatalogueProductImportRow = z.infer<typeof productImportSchema>;

export type ValidatedCatalogueImportRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  data: CatalogueProductImportRow;
  reviewIssues: string[];
};

export type InvalidCatalogueImportRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  errors: string[];
};

export type CatalogueCsvValidationResult = {
  headers: string[];
  validRows: ValidatedCatalogueImportRow[];
  invalidRows: InvalidCatalogueImportRow[];
};

export function parseCsvRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];

    if (quoted) {
      if (char === '"') {
        if (csvText[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (char === "\r") {
      if (csvText[index + 1] !== "\n") {
        record.push(field);
        records.push(record);
        record = [];
        field = "";
      }
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unterminated quoted field.");
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records.filter((row) => row.some((cell) => cell.trim() !== ""));
}

export function reviewIssuesForRow(row: CatalogueProductImportRow): string[] {
  const issues: string[] = [];

  if (!row.manufacturer) {
    issues.push("Manufacturer is missing and must be verified before promotion.");
  }
  if (!row.model) {
    issues.push("Exact model is missing and must be verified before promotion.");
  }
  if (row.image_url && !row.image_source_url) {
    issues.push("Image source URL is missing.");
  }
  if (row.image_url && !row.image_license_name && !row.image_license_url) {
    issues.push("Image licensing metadata is missing.");
  }
  if (!row.source_url) {
    issues.push("Product source URL is missing.");
  }
  if (row.image_exact_model_verified !== true && row.image_url) {
    issues.push("Image exact-model identity has not been verified.");
  }

  const compatibilityRequirements: Partial<Record<Category, (keyof CatalogueProductImportRow)[]>> =
    {
      frame: ["frame_size_inches", "motor_mount_pattern"],
      motors: ["motor_mount_pattern", "motor_size_code", "min_battery_cells", "max_battery_cells"],
      flightController: [
        "min_battery_cells",
        "max_battery_cells",
        "connector",
        "fc_camera_video_interfaces",
        "fc_camera_power_voltages_v",
        "fc_receiver_signal_interfaces",
        "fc_receiver_power_voltages_v",
      ],
      esc: ["min_battery_cells", "max_battery_cells", "esc_input", "esc_amps"],
      propellers: ["propeller_diameter_inches"],
      battery: ["battery_cells", "battery_capacity_mah"],
      camera: [
        "camera_video_interface",
        "camera_min_voltage_v",
        "camera_max_voltage_v",
        "camera_width_mm",
        "camera_height_mm",
        "camera_depth_mm",
      ],
      receiver: [
        "receiver_protocol",
        "receiver_signal_interface",
        "receiver_frequency_min_mhz",
        "receiver_frequency_max_mhz",
        "receiver_min_voltage_v",
        "receiver_max_voltage_v",
      ],
      videoTransmitter: [
        "video_transmitter_system",
        "vtx_camera_video_interfaces",
        "vtx_antenna_connector",
        "vtx_frequency_min_mhz",
        "vtx_frequency_max_mhz",
      ],
      gps: ["device_signal_interface", "device_min_voltage_v", "device_max_voltage_v"],
      buzzer: ["device_signal_interface", "device_min_voltage_v", "device_max_voltage_v"],
      antenna: ["antenna_connector", "antenna_frequency_min_mhz", "antenna_frequency_max_mhz"],
      radioTransmitter: ["radio_protocols"],
      fpvGoggles: ["supported_video_systems"],
      batteryCharger: [
        "charger_battery_chemistries",
        "charger_min_cells",
        "charger_max_cells",
        "charger_connectors",
      ],
      chargingAccessory: ["charging_connectors"],
    };

  for (const field of compatibilityRequirements[row.category] ?? []) {
    if (row[field] === undefined) {
      issues.push(`Compatibility field ${field} is missing.`);
    }
  }

  return issues;
}

export function validateCatalogueProductCsv(csvText: string): CatalogueCsvValidationResult {
  const records = parseCsvRecords(csvText);
  if (records.length === 0) {
    throw new Error("CSV is empty.");
  }

  const headerRow = records[0];
  if (!headerRow) {
    throw new Error("CSV is missing a header row.");
  }

  const headers = headerRow.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim(),
  );

  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length > 0) {
    throw new Error(`CSV contains duplicate headers: ${[...new Set(duplicateHeaders)].join(", ")}`);
  }

  const supportedHeaders = new Set<string>(catalogueProductCsvColumns);
  const unknownHeaders = headers.filter((header) => !supportedHeaders.has(header));
  if (unknownHeaders.length > 0) {
    throw new Error(`CSV contains unsupported columns: ${unknownHeaders.join(", ")}`);
  }

  for (const requiredHeader of ["id", "category", "display_name"]) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`CSV is missing required column: ${requiredHeader}`);
    }
  }

  const validRows: ValidatedCatalogueImportRow[] = [];
  const invalidRows: InvalidCatalogueImportRow[] = [];
  const seenIds = new Set<string>();

  records.slice(1).forEach((cells, recordIndex) => {
    const rowNumber = recordIndex + 2;
    const raw = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));

    if (cells.length !== headers.length) {
      invalidRows.push({
        rowNumber,
        raw,
        errors: [`Expected ${headers.length} columns but found ${cells.length}.`],
      });
      return;
    }

    const parsed = productImportSchema.safeParse(raw);
    if (!parsed.success) {
      invalidRows.push({
        rowNumber,
        raw,
        errors: parsed.error.issues.map((issue) => {
          const field = issue.path.join(".");
          return field ? `${field}: ${issue.message}` : issue.message;
        }),
      });
      return;
    }

    if (seenIds.has(parsed.data.id)) {
      invalidRows.push({
        rowNumber,
        raw,
        errors: [`Duplicate product ID in this CSV: ${parsed.data.id}`],
      });
      return;
    }

    seenIds.add(parsed.data.id);
    validRows.push({
      rowNumber,
      raw,
      data: parsed.data,
      reviewIssues: reviewIssuesForRow(parsed.data),
    });
  });

  return { headers, validRows, invalidRows };
}

export type CatalogueObjectValidationResult = {
  validRows: ValidatedCatalogueImportRow[];
  invalidRows: InvalidCatalogueImportRow[];
};

export function validateCatalogueProductRows(
  rows: readonly unknown[],
): CatalogueObjectValidationResult {
  const validRows: ValidatedCatalogueImportRow[] = [];
  const invalidRows: InvalidCatalogueImportRow[] = [];
  const seenIds = new Set<string>();

  rows.forEach((input, index) => {
    const rowNumber = index + 1;
    const raw =
      input && typeof input === "object" && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : { value: input };

    const parsed = productImportSchema.safeParse(input);
    if (!parsed.success) {
      invalidRows.push({
        rowNumber,
        raw,
        errors: parsed.error.issues.map((issue) => {
          const field = issue.path.join(".");
          return field ? `${field}: ${issue.message}` : issue.message;
        }),
      });
      return;
    }

    if (seenIds.has(parsed.data.id)) {
      invalidRows.push({
        rowNumber,
        raw,
        errors: [`Duplicate product ID in this batch: ${parsed.data.id}`],
      });
      return;
    }

    seenIds.add(parsed.data.id);
    validRows.push({
      rowNumber,
      raw,
      data: parsed.data,
      reviewIssues: reviewIssuesForRow(parsed.data),
    });
  });

  return { validRows, invalidRows };
}
