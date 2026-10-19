/**
 * A proof cannot be inferred from a reachable vendor URL or matching words.
 * Every field, offer, and media asset must carry its own reviewed evidence.
 * Pure fail-closed function; safe for CI, not an approval-writing API.
 */
export type EvidenceStatus = "missing" | "source_observed" | "verified";
export type FieldEvidence = {
  key: string; value: string | number | null; unit: string | null;
  sourceUrl: string | null; sourceExcerpt: string | null;
  exactVariant: boolean; status: EvidenceStatus;
  reviewedBy: string | null; reviewedAt: string | null;
};
export type MerchantEvidence = {
  merchantUrl: string | null;
  observedAt: string | null; priceEur: number | null;
  stock: "in_stock" | "out_of_stock" | "unknown";
  euShippingConfirmed: boolean;
  exactVariantAndPack: boolean;
  status: EvidenceStatus;
  reviewedBy: string | null;
};
export type MediaEvidence = {
  mode: "no_image" | "neutral_icon" | "licensed_photo";
  policyApproved: boolean;
  licensedPhotoUrl: string | null;
  licenseDocumentUrl: string | null;
  licenseReviewedBy: string | null;
};
export type ProductDossier = {
  qaId: string; category: string; model: string;
  identity: { sourceUrl: string; exactVariant: boolean;
    status: EvidenceStatus; reviewedBy: string | null; };
  requiredKeys: string[];
  fields: FieldEvidence[];
  merchant: MerchantEvidence | null;
  media: MediaEvidence;
  knownAccessoryOrBundle: boolean;
  ownerApproved: boolean;
};
export function evaluateDossier(p:ProductDossier, now:Date) {
  const reasons:string[]=[];
  if(!p.qaId || !p.model.trim()) reasons.push("missing_identity");
  if(p.knownAccessoryOrBundle) reasons.push("not_standalone_component");
  if(!/^https:\/\//.test(p.identity.sourceUrl)||
    !p.identity.exactVariant||p.identity.status!=="verified"||
    !p.identity.reviewedBy) reasons.push("identity_not_independently_verified");
  const req=[...new Set(p.requiredKeys)];
  if(req.length===0||req.length!==p.requiredKeys.length)
    reasons.push("missing_required_field_definitions");
  for(const key of req){
    const candidates=p.fields.filter(f=>f.key===key);
    if(candidates.length!==1){reasons.push("missing_or_duplicate_field:"+key);continue;}
    const e=candidates[0];
    if(e.value===null||e.value===""||!e.unit||!e.exactVariant||
       !e.sourceUrl?.startsWith("https://")||!e.sourceExcerpt?.trim()||
       e.status!=="verified"||!e.reviewedBy||
       !e.reviewedAt||!Number.isFinite(Date.parse(e.reviewedAt))||
       Date.parse(e.reviewedAt)>now.getTime())
      reasons.push("unverified_field:"+key);
  }
  const m=p.merchant;
  if(!m) reasons.push("no_current_exact_eu_offer");
  else {
    const checked=m.observedAt?Date.parse(m.observedAt):NaN;
    if(!Number.isFinite(checked)||checked>now.getTime()||
       now.getTime()-checked>24*60*60*1000)
      reasons.push("merchant_observation_not_fresh");
    if(!m.merchantUrl?.startsWith("https://")||
      m.status!=="verified"||!m.reviewedBy||
      !m.exactVariantAndPack||!m.euShippingConfirmed||
      m.priceEur===null||!Number.isFinite(m.priceEur)||m.priceEur<=0)
      reasons.push("merchant_offer_not_verified");
    if(m.stock!=="in_stock") reasons.push("merchant_inventory_not_confirmed");
  }
  const a=p.media;
  if(a.mode==="neutral_icon"){
    if(!a.policyApproved)reasons.push("neutral_icon_policy_unapproved");
  }else if(a.mode==="licensed_photo"){
    if(!a.policyApproved||!a.licensedPhotoUrl?.startsWith("https://")||
      !a.licenseDocumentUrl?.startsWith("https://")||!a.licenseReviewedBy)
      reasons.push("photo_reuse_license_unverified");
  }else reasons.push("media_mode_unapproved");
  if(!p.ownerApproved)reasons.push("owner_publication_approval_missing");
  return {ready:reasons.length===0,reasons};
}
