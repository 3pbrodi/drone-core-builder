import { products } from "../src/lib/build-data";
import { catalogueProductCsvColumns } from "../src/lib/catalogue-import";

function csvCell(value: unknown) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const rows = products.map((product) => {
  const row: Record<string, unknown> = {
    id: product.id,
    category: product.category,
    display_name: product.name,
    manufacturer: "",
    model: "",
    variant: "",
    mpn: "",
    manufacturer_sku: "",
    spec_summary: product.spec,
    weight_grams: product.weight,
    frame_size_inches: product.frameInches,
    motor_mount_pattern: product.mount,
    propeller_diameter_inches: product.propInches,
    motor_size_code: product.motorSize,
    motor_stator_width_mm: "",
    motor_stator_height_mm: "",
    motor_kv: "",
    min_battery_cells: product.minVoltage,
    max_battery_cells: product.maxVoltage,
    connector: product.connector,
    esc_input: product.escInput,
    thrust_grams: product.thrust,
    peak_current_amps: product.current,
    esc_amps: product.escAmps,
    battery_cells: product.voltage,
    battery_capacity_mah: product.batteryMah,
    battery_discharge_c: "",
    video_system: product.video,
    receiver_protocol: "",
    image_url: product.image?.src,
    image_source_url: product.image?.sourceUrl,
    image_alt: product.image?.alt,
    image_exact_model_verified: false,
    image_provenance: "DroneCores Phase 1 static demo catalogue",
    image_license_name: "",
    image_license_url: "",
    source_external_product_id: product.id,
    source_url: "",
  };

  return catalogueProductCsvColumns.map((column) => csvCell(row[column])).join(",");
});

process.stdout.write(
  [catalogueProductCsvColumns.join(","), ...rows].join("\n") + "\n",
);
