import "@tanstack/react-start/server-only";

import { catalogueSourceChanged, hashCatalogueSourceContent } from "./catalogue-source-snapshot";
import { supabaseRestRequest } from "./supabase-rest.server";

type SourceSnapshotInput = {
  sourceId: string;
  externalProductId?: string | null;
  sourceUrl: string;
  content: string;
  retrievedAt: string;
  metadata?: Record<string, unknown>;
};

type SnapshotRow = {
  id: string;
  content_hash: string;
  retrieved_at: string;
};

function query(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

export async function recordCatalogueSourceSnapshot({
  sourceId,
  externalProductId = null,
  sourceUrl,
  content,
  retrievedAt,
  metadata = {},
}: SourceSnapshotInput) {
  const contentHash = await hashCatalogueSourceContent(content);

  const filters: Record<string, string> = {
    select: "id,content_hash,retrieved_at",
    source_id: `eq.${sourceId}`,
    source_url: `eq.${sourceUrl}`,
    order: "retrieved_at.desc",
    limit: "1",
  };

  filters["external_product_id"] =
    externalProductId == null ? "is.null" : `eq.${externalProductId}`;

  const previousRows = await supabaseRestRequest<SnapshotRow[]>(
    `catalogue_source_snapshots?${query(filters)}`,
  );
  const previous = previousRows[0];
  const changed = catalogueSourceChanged(previous?.content_hash, contentHash);

  if (!changed) {
    return {
      changed: false,
      contentHash,
      previousSnapshotId: previous?.id ?? null,
    };
  }

  const created = await supabaseRestRequest<SnapshotRow[]>("catalogue_source_snapshots", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        source_id: sourceId,
        external_product_id: externalProductId,
        source_url: sourceUrl,
        content_hash: contentHash,
        retrieved_at: retrievedAt,
        metadata,
      },
    ]),
  });

  const snapshot = created[0];
  if (!snapshot) {
    throw new Error("Supabase did not return the created source snapshot.");
  }

  return {
    changed: true,
    contentHash,
    previousSnapshotId: previous?.id ?? null,
    snapshotId: snapshot.id,
  };
}
