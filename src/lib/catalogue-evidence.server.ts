import "@tanstack/react-start/server-only";
import { readEvidenceRows, mapEvidenceRows } from "../../supabase/functions/_shared/catalogue-evidence-read";
import type { SelectedProducts } from "./build-calculations";
import type { Product } from "./build-data";
import { resolveCompatibilityEvidence, type CatalogueEvidenceSnapshot } from "./catalogue-evidence";
import { supabaseRestRequest } from "./supabase-rest.server";

export async function fetchCatalogueEvidenceSnapshotForProductIds(ids: readonly string[]): Promise<CatalogueEvidenceSnapshot> {
 const mapped = mapEvidenceRows(await readEvidenceRows(supabaseRestRequest,ids));
 return { ...mapped, fields: mapped.fields.map(row=>({...row,field:row.field as keyof Product})) };
}
export async function fetchCatalogueEvidenceSnapshot(selected: SelectedProducts) {
 return fetchCatalogueEvidenceSnapshotForProductIds(Object.values(selected).filter((p): p is Product=>Boolean(p)).map(p=>p.id));
}
export async function fetchResolvedCompatibilityEvidence(selected: SelectedProducts) {
 return resolveCompatibilityEvidence(selected,await fetchCatalogueEvidenceSnapshot(selected));
}
