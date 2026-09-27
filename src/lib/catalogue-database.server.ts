import "@tanstack/react-start/server-only";

import {
  products as staticProducts,
  type Category,
  type Product,
} from "./build-data";
import { compareCatalogueParity, type CatalogueParityResult } from "./catalogue-parity";
import {
  isDatabaseCatalogueEnabled,
  supabaseRestRequest,
} from "./supabase-rest.server";

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
  image_url: string | null;
  image_alt: string | null;
  image_source_url: string | null;
  price_amount: number | null;
  currency: string | null;
  stock_status: string | null;
  offer_url: string | null;
  last_checked_at: string | null;
};

export type DatabaseCatalogueLoadResult = {
  products: Product[];
  rejectedProductIds: string[];
};

export type ServerCatalogueSnapshot =
  | {
      source: "static";
      products: readonly Product[];
      reason: "database_disabled" | "database_unavailable" | "parity_failed";
      parity?: CatalogueParityResult;
      error?: string;
    }
  | {
      source: "database";
      products: Product[];
      reason: "parity_verified";
      parity: CatalogueParityResult;
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

function runtimeRowToProduct(row: RuntimeProductRow): Product | null {
  if (row.price_amount === null || row.weight_grams === null) {
    return null;
  }

  return {
    id: row.id,
    category: row.category,
    name: row.display_name,
    spec: row.spec_summary ?? "",
    price: row.price_amount,
    weight: row.weight_grams,
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

export async function loadServerCatalogueSnapshot(): Promise<ServerCatalogueSnapshot> {
  if (!isDatabaseCatalogueEnabled()) {
    return {
      source: "static",
      products: staticProducts,
      reason: "database_disabled",
    };
  }

  try {
    const database = await fetchDatabaseRuntimeProducts();
    const parity = compareCatalogueParity(staticProducts, database.products);

    if (database.rejectedProductIds.length > 0 || !parity.ok) {
      return {
        source: "static",
        products: staticProducts,
        reason: "parity_failed",
        parity,
      };
    }

    return {
      source: "database",
      products: database.products,
      reason: "parity_verified",
      parity,
    };
  } catch (error) {
    return {
      source: "static",
      products: staticProducts,
      reason: "database_unavailable",
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
