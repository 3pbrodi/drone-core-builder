import { describe, expect, test } from "bun:test";
import { validateCatalogueProductRows } from "../src/lib/catalogue-import";

describe("catalogue batch import validation", () => {
  test("accepts normalized JSON arrays used by source adapters", () => {
    const result = validateCatalogueProductRows([
      {
        id: "batch-motor-1",
        category: "motors",
        display_name: "Example 2207 1800KV",
        manufacturer: "Example",
        model: "2207",
        variant: "1800KV",
        weight_grams: 32.1,
        motor_mount_pattern: "16x16",
        motor_size_code: 2207,
        min_battery_cells: 4,
        max_battery_cells: 6,
        fc_camera_video_interfaces: ["analog"],
        fc_camera_power_voltages_v: [5, 9],
        source_external_product_id: "example-2207-1800",
        source_url: "https://example.com/products/2207-1800",
      },
    ]);

    expect(result.invalidRows).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]?.data.weight_grams).toBe(32.1);
  });

  test("keeps technically incomplete products in the review queue", () => {
    const result = validateCatalogueProductRows([
      {
        id: "batch-camera-1",
        category: "camera",
        display_name: "Example Camera",
        manufacturer: "Example",
        model: "Camera 1",
        source_url: "https://example.com/camera-1",
      },
    ]);

    expect(result.invalidRows).toHaveLength(0);
    expect(result.validRows[0]?.reviewIssues).toContain(
      "Compatibility field camera_video_interface is missing.",
    );
  });

  test("rejects duplicate ids within one adapter batch", () => {
    const row = {
      id: "same-id",
      category: "frame",
      display_name: "Frame",
      manufacturer: "Example",
      model: "Frame 1",
      frame_size_inches: 5,
      motor_mount_pattern: "16x16",
      source_url: "https://example.com/frame-1",
    };

    const result = validateCatalogueProductRows([row, row]);
    expect(result.validRows).toHaveLength(1);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.invalidRows[0]?.errors[0]).toContain("Duplicate product ID");
  });
});
