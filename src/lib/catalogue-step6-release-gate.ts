/** Step 6 pre-promotion gate for evidence/offer/media review.
 * Pure, fail-closed logic. No DB writes or Production API privileges.
 * Deliberately more restrictive than legacy SQL publication gates:
 * absent legal image rights may ONLY use an explicitly approved icon fallback.
 */
export type Step6Review = {
  id: string;
  identityVerifiedByHuman: boolean;
  mandatorySpecsVerifiedByHuman: boolean;
  variantAndPackVerified: boolean;
  offer: {
    url: string;
    currency: string;
    price: number | null;
    stock: "in_stock" | "out_of_stock" | "preorder" | "unknown";
    checkedAt: string | null;
    directExactPage: boolean;
    exactModelVariantAndPack: boolean;
    reviewApproved: boolean;
    conflicts: boolean;
  } | null;
  media: {
    mode: "licensed_image" | "neutral_icon" | "unresolved";
    licenseEvidenceUrl: string | null;
    licenseReviewed: boolean;
    neutralIconApproved: boolean;
  };
  ownerApprovedPublication: boolean;
};

export function checkStep6Release(
  r: Step6Review,
  asOf: Date,
  maxAgeHours = 24,
): string[] {
  const reasons: string[] = [];
  if (!r.id.trim()) reasons.push("missing_product_identity");
  if (!r.identityVerifiedByHuman) reasons.push("identity_not_approved");
  if (!r.mandatorySpecsVerifiedByHuman) reasons.push("specs_not_approved");
  if (!r.variantAndPackVerified) reasons.push("variant_or_pack_not_approved");
  if (!r.offer) {
    reasons.push("no_exact_eu_offer");
  } else {
    const offer = r.offer;
    let host: string | null = null;
    try {
      const parsed = new URL(offer.url);
      if (parsed.protocol === "https:") host = parsed.hostname;
    } catch { /* fail closed */ }
    if (!host) reasons.push("invalid_offer_url");
    if (offer.currency !== "EUR" || offer.price === null ||
        !Number.isFinite(offer.price) || offer.price < 0) {
      reasons.push("invalid_eur_price");
    }
    const checked = offer.checkedAt ? Date.parse(offer.checkedAt) : NaN;
    const ageMs = asOf.getTime() - checked;
    if (!Number.isFinite(checked) || ageMs < 0 ||
        ageMs > maxAgeHours * 60 * 60 * 1000) {
      reasons.push("offer_not_fresh");
    }
    if (!offer.directExactPage || !offer.exactModelVariantAndPack ||
        !offer.reviewApproved) reasons.push("offer_not_exact_verified");
    if (offer.conflicts) reasons.push("conflicting_offer_evidence");
    if (offer.stock !== "in_stock") reasons.push("no_confirmed_stock");
  }
  if (r.media.mode === "licensed_image") {
    if (!r.media.licenseReviewed ||
        !r.media.licenseEvidenceUrl?.startsWith("https://")) {
      reasons.push("image_rights_not_verified");
    }
  } else if (r.media.mode === "neutral_icon") {
    if (!r.media.neutralIconApproved) {
      reasons.push("neutral_icon_policy_not_approved");
    }
  } else {
    reasons.push("image_policy_unresolved");
  }
  if (!r.ownerApprovedPublication) reasons.push("owner_approval_missing");
  return reasons;
}
