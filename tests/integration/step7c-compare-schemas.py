#!/usr/bin/env python3
"""Compare locally simulated Phase-B schema with a separate clean 24-migration reset."""
import json
from pathlib import Path
r=Path("step7c-results")
historical=json.loads((r/"post-20261002180345.json").read_text())
clean=json.loads((r/"clean24.json").read_text())
assert len(historical["migrationVersions"])==24 and len(clean["migrationVersions"])==24
structural_keys=sorted(set(historical)|set(clean)-{"functionHashes"})
def diff(x,y):
    out={}
    for k in sorted(set(x)|set(y)):
        if k=="functionHashes":continue
        a,b=x.get(k),y.get(k)
        if a==b:continue
        if isinstance(a,list) and isinstance(b,list):
            out[k]={"onlyHistorical":sorted(set(a)-set(b)),
                    "onlyClean":sorted(set(b)-set(a))}
        else:out[k]={"historical":a,"clean":b}
    return out
delta=diff(historical,clean)
# Current Production has exactly three additional *_next_pkey names on public
# snapshot tables. Keep the original raw difference and normalize only these
# three validated names for an apples-to-apples structural comparison.
import re
pattern=re.compile(r"(catalogue_public_(?:fc_esc|motor_esc_current|motor_propeller)_evidence)_next_pkey")
normalized={k:([pattern.sub(lambda m: m.group(1)+"_pkey",v) for v in vals]
               if k in ("indexes","constraints") and isinstance(vals,list) else vals)
            for k,vals in historical.items()}
normalized_delta=diff(normalized,clean)
func_old=historical.get("functionHashes",{})
func_new=clean.get("functionHashes",{})
func_changes={n:{"historicalMd5":func_old.get(n),"cleanMd5":func_new.get(n)}
 for n in sorted(set(func_old)|set(func_new)) if func_old.get(n)!=func_new.get(n)}
record={"structuralDifferences":delta,"afterDocumentedPkNameNormalization":normalized_delta,"functionTextHashDifferences":func_changes,
        "functionTextHashDifferencesAreInformational":True,
        "historicalAppliedMigrations":24,"cleanAppliedMigrations":24,
        "historicalOriginalVersionOrder":["19 shared Production versions","auth_billing_foundation","four originally missing catalogue/P0 versions"],
        "comparedAfterPhaseBWithSyntheticFixtureExcluded":True}
(r/"phase-b-vs-clean24-diff.json").write_text(json.dumps(record,indent=2,sort_keys=True)+"\n")
print("STEP7C STRUCTURAL DIFFERENCES",json.dumps(delta,ensure_ascii=False)[:6000])
print("STEP7C FUNCTION TEXT MD5 DIFFERENCES",json.dumps(func_changes,ensure_ascii=False)[:6000])
if normalized_delta:
    raise SystemExit("FAIL: unexpected upgraded schema differences beyond documented three historical PK/index names")
print("PASS: structural schema matches clean24 after normalizing three documented Production-only PK/index names")
