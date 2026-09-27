import "@tanstack/react-start/server-only";

import { supabaseRestRequest } from "./supabase-rest.server";

export type CatalogueSourceKind =
  | "manual"
  | "csv"
  | "xml"
  | "api"
  | "shopify"
  | "manufacturer"
  | "retailer";

type IdRow = { id: string };

function query(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

export async function findOrCreateCatalogueSource(
  name: string,
  kind: CatalogueSourceKind,
): Promise<string> {
  const existing = await supabaseRestRequest<IdRow[]>(
    `catalogue_sources?${query({
      select: "id",
      name: `eq.${name}`,
      kind: `eq.${kind}`,
      limit: "1",
    })}`,
  );
  const first = existing[0];
  if (first) return first.id;

  const created = await supabaseRestRequest<IdRow[]>("catalogue_sources", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        name,
        kind,
        verification_status: "unverified",
      },
    ]),
  });

  const createdSource = created[0];
  if (!createdSource) {
    throw new Error(
      "Supabase did not return the newly created catalogue source.",
    );
  }

  return createdSource.id;
}
