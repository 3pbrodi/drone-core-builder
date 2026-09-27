export async function hashCatalogueSourceContent(content: string) {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function catalogueSourceChanged(
  previousHash: string | null | undefined,
  nextHash: string,
) {
  return previousHash == null || previousHash !== nextHash;
}
