import { isFreshEuroOfferTimestamp } from "./catalogue-offer-freshness.ts";
import { parseTechnicalAttributes } from "./catalogue-technical-attributes.ts";
import type { CatalogueOffer, CatalogueProduct, StockStatus } from "./catalogue-product-types.ts";

/** Only feed rows from the guarded public snapshot, never the raw runtime view.
 * The snapshot's image-rights migration is a deployment prerequisite.
 */
export type RuntimeProductRow<Category extends string = string> = {
  technical_attributes?: unknown;
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
  package_quantity?: number | null;
  motor_kv?: number | null;
  merchant_name?: string | null;
  offer_last_check_failed?: boolean | null;
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
  image_license_name?: string | null;
  image_license_url?: string | null;
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
  integrated_categories?: Category[] | null;
  included_categories?: Category[] | null;
  battery_chemistry?: string | null;
  battery_connector?: string | null;
  fc_peripheral_interfaces?: string[] | null;
  fc_peripheral_power_voltages_v?: number[] | null;
  video_transmitter_system?: string | null;
  vtx_camera_video_interfaces?: string[] | null;
  vtx_antenna_connector?: string | null;
  vtx_frequency_min_mhz?: number | null;
  vtx_frequency_max_mhz?: number | null;
  antenna_connector?: string | null;
  antenna_frequency_min_mhz?: number | null;
  antenna_frequency_max_mhz?: number | null;
  radio_protocols?: string[] | null;
  supported_video_systems?: string[] | null;
  charger_battery_chemistries?: string[] | null;
  charger_min_cells?: number | null;
  charger_max_cells?: number | null;
  charger_connectors?: string[] | null;
  charging_connectors?: string[] | null;
  device_signal_interface?: string | null;
  device_min_voltage_v?: number | null;
  device_max_voltage_v?: number | null;
};

function offerProvenance(row: RuntimeProductRow): CatalogueOffer | null {
  if (typeof row.offer_url !== "string" || typeof row.last_checked_at !== "string") return null;
  try {
    const url = new URL(row.offer_url);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return {
      url: url.href,
      merchantHost: url.hostname,
      merchantName: row.merchant_name?.trim() || url.hostname,
      checkedAt: row.last_checked_at,
      freshness: isFreshEuroOfferTimestamp(row.last_checked_at) ? "current" : "stale",
      currency: "EUR",
      region: "EU",
    };
  } catch { return null; }
}

function withOptionalNumber<K extends Exclude<keyof CatalogueProduct<string>, "category" | "integratedCategories" | "includedCategories">>(
  key: K,
  value: number | null | undefined,
): Partial<Omit<CatalogueProduct<string>, "category" | "integratedCategories" | "includedCategories">> {
  if (value == null) return {};
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid numeric product field.");
  return ({ [key]: value } as Partial<Omit<CatalogueProduct<string>, "category" | "integratedCategories" | "includedCategories">>);
}

function withOptionalString<K extends Exclude<keyof CatalogueProduct<string>, "category" | "integratedCategories" | "includedCategories">>(
  key: K,
  value: string | null | undefined,
): Partial<Omit<CatalogueProduct<string>, "category" | "integratedCategories" | "includedCategories">> {
  return value == null || value === "" ? {} : ({ [key]: value } as Partial<Omit<CatalogueProduct<string>, "category" | "integratedCategories" | "includedCategories">>);
}

function withOptionalArray<K extends Exclude<keyof CatalogueProduct<string>, "category" | "integratedCategories" | "includedCategories">>(
  key: K,
  value: string[] | number[] | string[] | null | undefined,
): Partial<Omit<CatalogueProduct<string>, "category" | "integratedCategories" | "includedCategories">> {
  return value == null || value.length === 0 ? {} : ({ [key]: value } as Partial<Omit<CatalogueProduct<string>, "category" | "integratedCategories" | "includedCategories">>);
}

function mapRuntimeRow<Category extends string>(
  row: RuntimeProductRow<Category>,
  nowMs = Date.now(),
): CatalogueProduct<Category> | null {
  const offer = offerProvenance(row);
  const fresh = isFreshEuroOfferTimestamp(row.last_checked_at, nowMs) && !row.offer_last_check_failed;
  if (
    row.record_class !== "canonical" ||
    !row.id?.trim() || !row.display_name?.trim() || !row.category?.trim() ||
    !offer ||
    !["in_stock", "out_of_stock", "preorder", "backorder", "unknown"].includes(row.stock_status ?? "") ||
    !Number.isFinite(row.weight_grams) || (row.weight_grams ?? -1) < 0 ||
    row.price_amount === null ||
    row.weight_grams === null ||
    row.currency !== "EUR" ||
    row.offer_region !== "EU" ||
    !(typeof row.price_amount === "number" && Number.isFinite(row.price_amount) && row.price_amount > 0) ||
    !Number.isFinite(Date.parse(row.last_checked_at ?? "")) || Date.parse(row.last_checked_at ?? "") > nowMs
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
    offer: { ...offer, freshness: fresh ? "current" : "stale" },
    ...(row.manufacturer_name ? { manufacturer: row.manufacturer_name } : {}),
    model: row.model,
    ...(row.manufacturer_sku ? { manufacturerSku: row.manufacturer_sku } : {}),
    ...(row.variant?.trim() ? { variant: row.variant } : {}),
    ...withOptionalNumber("packageQuantity", row.package_quantity),
    ...withOptionalNumber("motorKv", row.motor_kv),
    stockStatus: fresh ? row.stock_status! : "unknown",
    ...(row.image_url && row.image_license_name?.trim() && /^https:\/\//i.test(row.image_license_url ?? "")
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
    ...parseTechnicalAttributes(row.technical_attributes ?? {}),
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
    ...(row.integrated_categories?.length ? { integratedCategories: row.integrated_categories } : {}),
    ...(row.included_categories?.length ? { includedCategories: row.included_categories } : {}),
    ...withOptionalString("batteryChemistry", row.battery_chemistry),
    ...withOptionalString("batteryConnector", row.battery_connector),
    ...withOptionalArray("fcPeripheralInterfaces", row.fc_peripheral_interfaces),
    ...withOptionalArray("fcPeripheralPowerVoltagesV", row.fc_peripheral_power_voltages_v),
    ...withOptionalString("videoTransmitterSystem", row.video_transmitter_system),
    ...withOptionalArray("vtxCameraVideoInterfaces", row.vtx_camera_video_interfaces),
    ...withOptionalString("vtxAntennaConnector", row.vtx_antenna_connector),
    ...withOptionalNumber("vtxFrequencyMinMhz", row.vtx_frequency_min_mhz),
    ...withOptionalNumber("vtxFrequencyMaxMhz", row.vtx_frequency_max_mhz),
    ...withOptionalString("antennaConnector", row.antenna_connector),
    ...withOptionalNumber("antennaFrequencyMinMhz", row.antenna_frequency_min_mhz),
    ...withOptionalNumber("antennaFrequencyMaxMhz", row.antenna_frequency_max_mhz),
    ...withOptionalArray("radioProtocols", row.radio_protocols),
    ...withOptionalArray("supportedVideoSystems", row.supported_video_systems),
    ...withOptionalArray("chargerBatteryChemistries", row.charger_battery_chemistries),
    ...withOptionalNumber("chargerMinCells", row.charger_min_cells),
    ...withOptionalNumber("chargerMaxCells", row.charger_max_cells),
    ...withOptionalArray("chargerConnectors", row.charger_connectors),
    ...withOptionalArray("chargingConnectors", row.charging_connectors),
    ...withOptionalString("deviceSignalInterface", row.device_signal_interface),
    ...withOptionalNumber("deviceMinVoltageV", row.device_min_voltage_v),
    ...withOptionalNumber("deviceMaxVoltageV", row.device_max_voltage_v),
  };
}


/** Malformed individual records never take down the remaining approved catalogue. */
export function runtimeRowToProduct<Category extends string>(row: RuntimeProductRow<Category>, nowMs=Date.now()): CatalogueProduct<Category> | null {
 try { return mapRuntimeRow(row,nowMs); } catch { return null; }
}
