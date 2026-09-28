const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=30, s-maxage=60",
};

const categories = [
  "frame", "motors", "flightController", "esc",
  "propellers", "battery", "camera", "receiver",
];

async function rest(path: string) {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!baseUrl || !anonKey) throw new Error("Supabase public runtime configuration missing.");

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Public catalogue request failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

function optional(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== null && value !== undefined && value !== "") target[key] = value;
}

function toProduct(row: Record<string, any>) {
  if (
    row.record_class !== "canonical" ||
    row.price_amount === null ||
    row.weight_grams === null ||
    row.currency !== "EUR" ||
    row.offer_region !== "EU"
  ) return null;

  const product: Record<string, unknown> = {
    id: row.id,
    category: row.category,
    name: row.display_name,
    spec: row.spec_summary ?? "",
    price: row.price_amount,
    weight: row.weight_grams,
  };

  optional(product, "stockStatus", row.stock_status);
  optional(product, "frameInches", row.frame_size_inches);
  optional(product, "mount", row.motor_mount_pattern);
  optional(product, "propInches", row.propeller_diameter_inches);
  optional(product, "motorSize", row.motor_size_code);
  optional(product, "voltage", row.battery_cells);
  optional(product, "minVoltage", row.min_battery_cells);
  optional(product, "maxVoltage", row.max_battery_cells);
  optional(product, "connector", row.connector);
  optional(product, "escInput", row.esc_input);
  optional(product, "thrust", row.thrust_grams);
  optional(product, "current", row.peak_current_amps);
  optional(product, "escAmps", row.esc_amps);
  optional(product, "batteryMah", row.battery_capacity_mah);
  optional(product, "video", row.video_system);
  optional(product, "cameraVideoInterface", row.camera_video_interface);
  optional(product, "cameraMinVoltageV", row.camera_min_voltage_v);
  optional(product, "cameraMaxVoltageV", row.camera_max_voltage_v);
  optional(product, "cameraWidthMm", row.camera_width_mm);
  optional(product, "cameraHeightMm", row.camera_height_mm);
  optional(product, "cameraDepthMm", row.camera_depth_mm);
  optional(product, "fcCameraVideoInterfaces", row.fc_camera_video_interfaces);
  optional(product, "fcCameraPowerVoltagesV", row.fc_camera_power_voltages_v);
  optional(product, "receiverProtocol", row.receiver_protocol);
  optional(product, "receiverFrequencyMinMhz", row.receiver_frequency_min_mhz);
  optional(product, "receiverFrequencyMaxMhz", row.receiver_frequency_max_mhz);
  optional(product, "receiverMinVoltageV", row.receiver_min_voltage_v);
  optional(product, "receiverMaxVoltageV", row.receiver_max_voltage_v);
  optional(product, "receiverSignalInterface", row.receiver_signal_interface);
  optional(product, "receiverWidthMm", row.receiver_width_mm);
  optional(product, "receiverHeightMm", row.receiver_height_mm);
  optional(product, "receiverDepthMm", row.receiver_depth_mm);
  optional(product, "fcReceiverSignalInterfaces", row.fc_receiver_signal_interfaces);
  optional(product, "fcReceiverPowerVoltagesV", row.fc_receiver_power_voltages_v);

  if (row.image_url) {
    product.image = {
      src: row.image_url,
      alt: row.image_alt ?? row.display_name,
      sourceUrl: row.image_source_url ?? row.image_url,
    };
  }

  return product;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: jsonHeaders,
    });
  }

  try {
    const [rows, fields, motorPropeller, motorEsc] = await Promise.all([
      rest("catalogue_public_runtime_products?select=*&order=id.asc"),
      rest("catalogue_public_verified_spec_evidence?select=*"),
      rest("catalogue_public_motor_propeller_evidence?select=*").catch(() => []),
      rest("catalogue_public_motor_esc_current_evidence?select=*").catch(() => []),
    ]);

    const products = rows.map(toProduct).filter(Boolean);
    const missingCategories = categories.filter(
      (category) => !products.some((product: any) => product.category === category),
    );

    const validation = {
      ok: products.length > 0 && missingCategories.length === 0,
      missingCategories,
      duplicateProductIds: [],
      rejectedProductIds: [],
      invalidProductIds: [],
    };

    const evidence = {
      fields: fields.map((row: any) => ({
        productId: row.product_id,
        field: row.field_key,
        value: row.value,
        unit: row.unit,
        sourceId: "public",
        sourceUrl: row.source_url,
        authority: row.authority,
        exactModelAssociation: row.exact_model_association,
        verificationStatus: row.verification_status,
        retrievedAt: row.retrieved_at,
        verifiedAt: row.verified_at,
        conditions: row.conditions,
        caveats: row.caveats,
      })),
      motorPropeller: motorPropeller.map((row: any) => ({
        motorId: row.motor_product_id,
        propellerId: row.propeller_product_id,
        result: row.result,
        authority: row.authority,
        exactProductsVerified: row.exact_products_verified,
        verificationStatus: row.verification_status,
        retrievedAt: row.retrieved_at,
        verifiedAt: row.verified_at,
        operatingConditions: row.operating_conditions,
      })),
      motorEscCurrent: motorEsc.map((row: any) => ({
        motorId: row.motor_product_id,
        escId: row.esc_product_id,
        motorCurrentAmps: row.motor_current_amps,
        motorRatingType: row.motor_rating_type,
        escCurrentAmps: row.esc_current_amps,
        escRatingType: row.esc_rating_type,
        exactProductsVerified: row.exact_products_verified,
        ratingTypesVerified: row.rating_types_verified,
        motorOperatingConditionsVerified: row.motor_operating_conditions_verified,
        verificationStatus: row.verification_status,
        retrievedAt: row.retrieved_at,
        verifiedAt: row.verified_at,
        operatingConditions: row.operating_conditions,
      })),
      fcEscConnection: [],
    };

    return new Response(JSON.stringify({
      source: validation.ok ? "database" : "unavailable",
      status: validation.ok ? "ready" : "coverage_failed",
      products: validation.ok ? products : [],
      evidence: validation.ok ? evidence : {
        fields: [], motorPropeller: [], motorEscCurrent: [], fcEscConnection: [],
      },
      validation,
      ...(validation.ok ? {} : { error: "Verified catalogue coverage check failed." }),
    }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      source: "unavailable",
      status: "database_unavailable",
      products: [],
      evidence: { fields: [], motorPropeller: [], motorEscCurrent: [], fcEscConnection: [] },
      validation: {
        ok: false,
        missingCategories: categories,
        duplicateProductIds: [],
        rejectedProductIds: [],
        invalidProductIds: [],
      },
      error: error instanceof Error ? error.message : "Unknown catalogue error",
    }), { status: 500, headers: jsonHeaders });
  }
});
