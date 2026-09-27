import { z } from "zod";
import { categories, type Category } from "./build-data";

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
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return value;
}, z.boolean().optional());

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
  "receiver_protocol",
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

const productImportSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Use a stable ID with letters, numbers, . _ : or -."),
    category: z.enum(categories),
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
    receiver_protocol: optionalText,
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
  });

export type CatalogueProductImportRow = z.infer<typeof productImportSchema>;

export type ValidatedCatalogueImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  data: CatalogueProductImportRow;
  reviewIssues: string[];
};

export type InvalidCatalogueImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
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

function reviewIssuesForRow(row: CatalogueProductImportRow): string[] {
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
      flightController: ["min_battery_cells", "max_battery_cells", "connector"],
      esc: ["min_battery_cells", "max_battery_cells", "esc_input", "esc_amps"],
      propellers: ["propeller_diameter_inches"],
      battery: ["battery_cells", "battery_capacity_mah"],
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
