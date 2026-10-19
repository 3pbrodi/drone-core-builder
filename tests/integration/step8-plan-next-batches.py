#!/usr/bin/env python3
"""Turn frozen source pilot into a balanced REVIEW queue, never a public import.

Usage: python3 tests/integration/step8-plan-next-batches.py original-pilot step8-results
No DB credentials or Production access. Queue entries must not be counted as
verified catalog products or individually checked stock/offer observations.
"""
from pathlib import Path
from collections import Counter, defaultdict
import json, re, sys
from urllib.parse import urlparse

source=Path(sys.argv[1]); out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
archived=[]
for name in ("staged-validated-items.json","staged-review-required-items.json"):
    data=json.loads((source/name).read_text())
    assert isinstance(data,list),name
    archived.extend(data)

category_order=("frame","motors","propellers","flightController","esc","battery","receiver","camera")
required={
    "frame":["frame_size_inches"],
    "motors":["motor_size_code","motor_kv","motor_mount_pattern"],
    "propellers":["propeller_diameter_inches"],
    "flightController":["fc_camera_video_interfaces","fc_camera_power_voltages_v",
                        "fc_receiver_signal_interfaces","fc_receiver_power_voltages_v"],
    "esc":["min_battery_cells","max_battery_cells","esc_input","esc_amps"],
    "battery":["battery_cells","battery_capacity_mah"],
    "receiver":["receiver_protocol","receiver_signal_interface",
                "receiver_frequency_min_mhz","receiver_frequency_max_mhz",
                "receiver_min_voltage_v","receiver_max_voltage_v"],
    "camera":["camera_video_interface","camera_min_voltage_v","camera_max_voltage_v"],
}
def norm(s): return re.sub(r"\s+"," ",str(s or "").lower()).strip()
def possibly_accessory(model):
    # Broad manual-review signals; never reject automatically.
    return bool(re.search(r"\b(cable|adapter|spare|screw|replacement|mounting|bracket|"
      r"nut|washer|antenna only|prop nut|connector only|harness)\b",str(model),re.I))
def sku_suspect(s):
    v=str(s or "").strip()
    return bool(re.fullmatch(r"\d{12,14}",v))
def component_classification(category, model):
    """Conservative checks for clearly wrong component categories.
    A mixed multi-product bundle is not a standalone receiver/battery.
    Other uncertain model identities remain manual-review only.
    """
    name=norm(model)
    if category=="battery" and re.search(
        r"\b(battery (anti slip|anti-slip|pad|strap)|ummagrip battery pad)\b",name
    ): return "accessory_not_battery"
    if category=="motors" and re.search(r"\b(bearing|bearings|replacement shaft)\b",name):
        return "accessory_not_motor"
    if category=="frame" and re.search(r"\b(arm for|replacement arm|spare arm)\b",name):
        return "accessory_not_complete_frame"
    if category=="receiver" and re.search(r"\b(fusion pack|starter set|tx rx bundle)\b",name):
        return "multi_component_bundle_not_standalone_receiver"
    return "potential_standalone_component"

per_category=Counter()
source_adapters=Counter()
source_domains=Counter()
prepared=[]
fingerprint_seen=set()
raw_dups=0
for item in archived:
    cat=item.get("category") or item.get("normalized",{}).get("category")
    per_category[cat]+=1
    source_adapters[item.get("adapter") or item.get("adapter_key") or "not_in_archived_rows"]+=1
    n=item.get("normalized") or {}
    maker=n.get("manufacturer") or ""
    model=n.get("model") or n.get("display_name") or ""
    url=item.get("source_url") or n.get("source_url") or ""
    source_domains[urlparse(url).hostname or "missing_source_domain"]+=1
    pid=str(item.get("import_row_id",""))
    fingerprint=(norm(maker),norm(model),norm(n.get("variant")))
    duplicate_hint=fingerprint in fingerprint_seen
    if duplicate_hint:raw_dups+=1
    fingerprint_seen.add(fingerprint)
    missing=[k for k in required.get(cat,[]) if n.get(k) in (None,"",[],{})]
    blockers=[]
    component_kind=component_classification(cat,model)
    if component_kind!="potential_standalone_component":
        blockers.append(component_kind)
    if not maker or not model or not url: blockers.append("missing_manufacturer_model_or_source")
    if missing: blockers.append("missing_category_required_specs")
    if item.get("validation_errors"): blockers.append("prior_import_validation_errors")
    if possibly_accessory(model): blockers.append("possible_accessory_review")
    if sku_suspect(n.get("manufacturer_sku")): blockers.append("numeric_merchant_gtin_may_be_mislabelled")
    if duplicate_hint: blockers.append("same_maker_model_variant_fingerprint_review")
    if cat not in category_order: blockers.append("unsupported_category")
    score=sum([
      bool(maker),bool(model),url.startswith("https://"),bool(n.get("source_external_product_id")),
      bool(n.get("manufacturer_sku")) and not sku_suspect(n.get("manufacturer_sku")),
      len(missing)==0
    ])
    prepared.append({
      "pilot_id":pid,"category":cat,"manufacturer":maker,"model":model,
      "source_url":url,"source_adapter":item.get("adapter") or item.get("adapter_key") or "unknown",
      "manufacturer_sku":n.get("manufacturer_sku"),
      "missing_required_specs":missing,"review_blockers":blockers,
      "component_classification":component_kind,
      "eligible_as_standalone_component_research":component_kind=="potential_standalone_component",
      "suggested_priority":score,
      "status":"research_candidate_unverified",
      "publication_approved":False,"identity_verified":False,"offer_verified":False,
      "image_license_verified":False,
    })
buckets=defaultdict(list)
for x in prepared:
    if x["category"] in category_order: buckets[x["category"]].append(x)
for c in category_order:
    buckets[c].sort(key=lambda x:(
      len(x["review_blockers"]),-x["suggested_priority"],x["pilot_id"]
    ))
# Balanced interleaved review queue, max 48 for next research pass, not an import.
queue=[]
for round_idx in range(6):
    for category in category_order:
        if len(buckets[category])>round_idx:
            x=dict(buckets[category][round_idx])
            x["review_queue_rank"]=len(queue)+1
            queue.append(x)

summary={
  "source":"historical immutable 171-source pilot, not a live merchant or approved manufacturer review",
  "total_source_rows":len(archived),
  "by_category":{c:per_category.get(c,0) for c in category_order},
  "nonstandard_categories":{str(k):v for k,v in per_category.items() if k not in category_order},
  "by_adapter":dict(source_adapters),
  "by_source_domain":dict(source_domains),
  "same_normalized_model_fingerprint_hints":raw_dups,
  "next_research_queue_count":len(queue),
  "next_research_queue_by_category":dict(Counter(x["category"] for x in queue)),
  "candidate_field_gaps_in_queue":sum(bool(x["missing_required_specs"]) for x in queue),
  "excluded_accessory_or_bundle_count":sum(not x["eligible_as_standalone_component_research"] for x in queue),
  "potential_component_research_count":sum(x["eligible_as_standalone_component_research"] for x in queue),
  "excluded_examples":[{"pilot_id":x["pilot_id"],"category":x["category"],
      "reason":x["component_classification"]} for x in queue
      if not x["eligible_as_standalone_component_research"]],
  "all_unverified":all(not x["publication_approved"] and
     not x["identity_verified"] and not x["offer_verified"] for x in queue),
  "note":"This is a balanced triage queue, NOT 48 production-ready models. Each item requires original source identity and seller reviews."
}
assert len(archived)>=100
assert len(category_order)==8
assert summary["all_unverified"]
assert summary["next_research_queue_count"]<=48
assert sum(summary["by_category"].values()) + sum(summary["nonstandard_categories"].values())==len(archived)
(out/"balanced-source-triage.json").write_text(json.dumps(
 {"summary":summary,"review_queue":queue},ensure_ascii=False,indent=2)+"\n")
print(json.dumps(summary,ensure_ascii=False,sort_keys=True))
# Compact, source-URL-only durable queue for a manual GitHub PR review file.
# This does NOT contain private information, photo contents or retailer prices.
compact=[{
 "pilot_id":x["pilot_id"],"category":x["category"],
 "manufacturer":x["manufacturer"],"model":x["model"],
 "source_url":x["source_url"],"missing_required_specs":x["missing_required_specs"],
 "review_blockers":x["review_blockers"],"review_queue_rank":x["review_queue_rank"],
 "component_classification":x["component_classification"],
 "eligible_as_standalone_component_research":x["eligible_as_standalone_component_research"],
 "publication_approved":False
} for x in queue]
print("STEP8_QUEUE_COMPACT:"+json.dumps(compact,ensure_ascii=False,separators=(",",":")))

