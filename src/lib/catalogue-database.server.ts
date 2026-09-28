import "@tanstack/react-start/server-only";

import {
  type Category,
  type Product,
  type StockStatus,
} from "./build-data";
import {
  emptyCatalogueEvidenceSnapshot,
  type CatalogueEvidenceSnapshot,
} from "./catalogue-evidence";
import { fetchCatalogueEvidenceSnapshotForProductIds } from "./catalogue-evidence.server";
import {
  validateRuntimeCatalogue,
  type RuntimeCatalogueValidation,
} from "./catalogue-runtime";
import { isDatabaseCatalogueEnabled, supabaseRestRequest } from "./supabase-rest.server";

type RuntimeProductRow = {
  id: string;
  category: Category;
  display_name: string;
  spec_summary: string | null;
  weight_grams: number | null;
  manufacturer_name: string | null;
  model: string;
  variant: string | null;
  mpn: string | null;
  manufacturer_sku: string | null;
  frame_size_inches: number | null;
  motor_mount_pattern: string | null;
  propeller_diameter_inches: number | null;
  motor_size_code: number | null;
  min_battery_cells: number | null;
  max_battery_cells: number | null;
  connector: string | null;
  esc_input: string | null;
  thrust_grams: number | null;
  peak_current_amps: number | null;
  esc_amps: number | null;
  battery_cells: number | null;
  battery_capacity_mah: number | null;
  video_system: string | null;
  camera_video_interface: string | null;
  camera_min_voltage_v: number | null;
  camera_max_voltage_v: number | null;
  camera_width_mm: number | null;
  camera_height_mm: number | null;
  camera_depth_mm: number | null;
  fc_camera_video_interfaces: string[] | null;
  fc_camera_power_voltages_v: number[] | null;
  receiver_protocol: string | null;
  receiver_frequency_min_mhz: number | null;
  receiver_frequency_max_mhz: number | null;
  receiver_min_voltage_v: number | null;
  receiver_max_voltage_v: number | null;
  receiver_signal_interface: string | null;
  receiver_width_mm: number | null;
  receiver_height_mm: number | null;
  receiver_depth_mm: number | null;
  fc_receiver_signal_interfaces: string[] | null;
  fc_receiver_power_voltages_v: number[] | null;
  image_url: string | null;
  image_alt: string | null;
  image_source_url: string | null;
  price_amount: number | null;
  currency: string | null;
  stock_status: StockStatus | null;
  offer_url: string | null;
  last_checked_at: string | null;
  offer_region: string | null;
  record_class: "demo_seed" | "canonical";
};

export type DatabaseCatalogueLoadResult = {
  products: Product[];
  rejectedProductIds: string[];
};

export type ServerCatalogueSnapshot = {
  source: "database" | "unavailable";
  status: "ready" | "database_disabled" | "database_unavailable" | "coverage_failed";
  products: Product[];
  evidence: CatalogueEvidenceSnapshot;
  validation: RuntimeCatalogueValidation;
  error?: string;
};

function withOptionalNumber<K extends keyof Product>(
  key: K,
  value: number | null,
): Partial<Product> {
  return value === null ? {} : ({ [key]: value } as Partial<Product>);
}

function withOptionalString<K extends keyof Product>(
  key: K,
  value: string | null,
): Partial<Product> {
  return value === null || value === "" ? {} : ({ [key]: value } as Partial<Product>);
}

function withOptionalArray<K extends keyof Product>(
  key: K,
  value: string[] | number[] | null,
): Partial<Product> {
  return value === null || value.length === 0 ? {} : ({ [key]: value } as Partial<Product>);
}

function runtimeRowToProduct(row: RuntimeProductRow): Product | null {
  if (
    row.record_class !== "canonical" ||
    row.price_amount === null ||
    row.weight_grams === null ||
    row.currency !== "EUR" ||
    row.offer_region !== "EU"
  ) {
    return null;
  }

  return {
    id: row.id,
    category: row.category,
    name: row.display_name,
    spec: row.spec_summary ?? "",
    price: row.price_amount,
    weight: row.weight_grams,
    ...(row.stock_status ? { stockStatus: row.stock_status } : {}),
    ...(row.image_url
      ? {
          image: {
            src: row.image_url,
            alt: row.image_alt ?? row.display_name,
            sourceUrl: row.image_source_url ?? row.image_url,
          },
        }
      : {}),
    ...withOptionalNumber("frameInches", row.frame_size_inches),
    ...withOptionalString("mount", row.motor_mount_pattern),
    ...withOptionalNumber("propInches", row.propeller_diameter_inches),
    ...withOptionalNumber("motorSize", row.motor_size_code),
    ...withOptionalNumber("voltage", row.battery_cells),
    ...withOptionalNumber("minVoltage", row.min_battery_cells),
    ...withOptionalNumber("maxVoltage", row.max_battery_cells),
    ...withOptionalString("connector", row.connector),
    ...withOptionalString("escInput", row.esc_input),
    ...withOptionalNumber("thrust", row.thrust_grams),
    ...withOptionalNumber("current", row.peak_current_amps),
    ...withOptionalNumber("escAmps", row.esc_amps),
    ...withOptionalNumber("batteryMah", row.battery_capacity_mah),
    ...withOptionalString("video", row.video_system),
    ...withOptionalString("cameraVideoInterface", row.camera_video_interface),
    ...withOptionalNumber("cameraMinVoltageV", row.camera_min_voltage_v),
    ...withOptionalNumber("cameraMaxVoltageV", row.camera_max_voltage_v),
    ...withOptionalNumber("cameraWidthMm", row.camera_width_mm),
    ...withOptionalNumber("cameraHeightMm", row.camera_height_mm),
    ...withOptionalNumber("cameraDepthMm", row.camera_depth_mm),
    ...withOptionalArray("fcCameraVideoInterfaces", row.fc_camera_video_interfaces),
    ...withOptionalArray("fcCameraPowerVoltagesV", row.fc_camera_power_voltages_v),
    ...withOptionalString("receiverProtocol", row.receiver_protocol),
    ...withOptionalNumber("receiverFrequencyMinMhz", row.receiver_frequency_min_mhz),
    ...withOptionalNumber("receiverFrequencyMaxMhz", row.receiver_frequency_max_mhz),
    ...withOptionalNumber("receiverMinVoltageV", row.receiver_min_voltage_v),
    ...withOptionalNumber("receiverMaxVoltageV", row.receiver_max_voltage_v),
    ...withOptionalString("receiverSignalInterface", row.receiver_signal_interface),
    ...withOptionalNumber("receiverWidthMm", row.receiver_width_mm),
    ...withOptionalNumber("receiverHeightMm", row.receiver_height_mm),
    ...withOptionalNumber("receiverDepthMm", row.receiver_depth_mm),
    ...withOptionalArray("fcReceiverSignalInterfaces", row.fc_receiver_signal_interfaces),
    ...withOptionalArray("fcReceiverPowerVoltagesV", row.fc_receiver_power_voltages_v),
  };
}

export async function fetchDatabaseRuntimeProducts(): Promise<DatabaseCatalogueLoadResult> {
  const rows = await supabaseRestRequest<RuntimeProductRow[]>(
    "catalogue_runtime_products?select=*&order=id.asc",
  );

  const products: Product[] = [];
  const rejectedProductIds: string[] = [];

  for (const row of rows) {
    const product = runtimeRowToProduct(row);
    if (product) products.push(product);
    else rejectedProductIds.push(row.id);
  }

  return { products, rejectedProductIds };
}

function unavailableSnapshot(
  status: Exclude<ServerCatalogueSnapshot["status"], "ready">,
  error?: string,
  validation = validateRuntimeCatalogue([]),
): ServerCatalogueSnapshot {
  return {
    source: "unavailable",
    status,
    products: [],
    evidence: emptyCatalogueEvidenceSnapshot(),
    validation,
    ...(error ? { error } : {}),
  };
}

export async function loadServerCatalogueSnapshot(): Promise<ServerCatalogueSnapshot> {
  if (!isDatabaseCatalogueEnabled()) {
    return unavailableSnapshot(
      "database_disabled",
      "The verified Supabase catalogue is disabled by the server configuration.",
    );
  }

  try {
    const database = await fetchDatabaseRuntimeProducts();
    const validation = validateRuntimeCatalogue(
      database.products,
      database.rejectedProductIds,
    );

    if (!validation.ok) {
      const parts = [
        validation.missingCategories.length
          ? `missing categories: ${validation.missingCategories.join(", ")}`
          : null,
        validation.rejectedProductIds.length
          ? `rejected runtime rows: ${validation.rejectedProductIds.join(", ")}`
          : null,
        validation.duplicateProductIds.length
          ? `duplicate IDs: ${validation.duplicateProductIds.join(", ")}`
          : null,
        validation.invalidProductIds.length
          ? `invalid numeric data: ${validation.invalidProductIds.join(", ")}`
          : null,
      ].filter(Boolean);

      return unavailableSnapshot(
        "coverage_failed",
        `Verified catalogue coverage check failed (${parts.join("; ")}).`,
        validation,
      );
    }

    const evidence = await fetchCatalogueEvidenceSnapshotForProductIds(
      database.products.map((product) => product.id),
    );

    return {
      source: "database",
      status: "ready",
      products: database.products,
      evidence,
      validation,
    };
  } catch (error) {
    return unavailableSnapshot(
      "database_unavailable",
      error instanceof Error ? error.message : "Unknown Supabase catalogue error",
    );
  }
}
