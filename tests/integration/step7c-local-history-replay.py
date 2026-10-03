#!/usr/bin/env python3
"""STEP 7C: EXCLUSIVELY DISPOSABLE LOCAL Supabase history replay.

Never link, push, deploy or access a hosted database. Stored Production SQL is
test fixture only. Compatibility setup is recorded separately from the 20
historical migration ledger entries. Repository migrations remain immutable.
"""
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path.cwd()
OUT = ROOT / "step7c-results"
OUT.mkdir(exist_ok=True)
MIG = ROOT / "supabase/migrations"
FIXTURE = ROOT / "tests/integration/step7c-production-history-ledger.json"
COMPAT = ROOT / "tests/integration/step7c-local-pre-snapshot-compatibility.sql"
SNAPSHOT = ROOT / "tests/integration/step7c-schema-snapshot.sql"
SEED = ROOT / "tests/integration/step7c-legacy-synthetic.sql"
ORIGINAL_AUTH = "20261002190436_auth_billing_foundation.sql"
MISSING = [
 "20260929175500_component_category_enum.sql",
 "20260929175600_component_category_architecture.sql",
 "20260929184414_p0_import_reliability.sql",
 "20261002180345_catalogue_internal_service_role_usage.sql",
]
URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
ENV = dict(os.environ, PGPASSWORD="postgres", PGCONNECT_TIMEOUT="8")
REQUIRED_BRANCH = "verification/step7c-production-history-replay-20261003"

def guard():
    assert ENV.get("GITHUB_REF_NAME") == REQUIRED_BRANCH, "Unexpected branch"
    assert not ENV.get("SUPABASE_ACCESS_TOKEN"), "Hosted API token present; abort"
    assert URL == "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    assert "127.0.0.1" in URL
    assert "supabase.co" not in URL
    assert len(list(MIG.glob("*.sql"))) == 24
    cp = subprocess.run(["git","status","--porcelain"],capture_output=True,text=True,check=True)
    assert not cp.stdout.strip(), "Dirty checkout before local replay"

def cmd(args, label, *, capture=False, check=True):
    with (OUT / (label + ".log")).open("w") as log:
        p = subprocess.run(args, cwd=ROOT, env=ENV, text=True, stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE)
        log.write("stdout:\n" + p.stdout + "\nstderr:\n" + p.stderr)
    if check and p.returncode:
        print("FAILED", label, "exit", p.returncode, "\nSTDERR TAIL:\n", p.stderr[-2800:], flush=True)
        raise RuntimeError(f"{label}: exit {p.returncode}")
    print("OK", label, flush=True)
    return p.stdout if capture else p

def psql_file(path,label):
    return cmd(["psql",URL,"-X","-v","ON_ERROR_STOP=1","-f",str(path)],label)

def psql_query(query,label):
    return cmd(["psql",URL,"-X","-qAt","-v","ON_ERROR_STOP=1","-c",query],label,capture=True).strip()

def snapshot(name):
    raw=cmd(["psql",URL,"-X","-qAt","-v","ON_ERROR_STOP=1","-f",str(SNAPSHOT)],"snapshot-"+name,capture=True).strip()
    data=json.loads(raw)
    (OUT/(name+".json")).write_text(json.dumps(data,indent=2,sort_keys=True)+"\n")
    return data

def changes(a,b):
    keys=sorted(set(a)|set(b))
    result={}
    for key in keys:
        if a.get(key)==b.get(key):continue
        left,right=a.get(key),b.get(key)
        if isinstance(left,list) and isinstance(right,list):
            l,r=set(map(str,left)),set(map(str,right))
            result[key]={"added":sorted(r-l),"removed":sorted(l-r)}
        elif isinstance(left,dict) and isinstance(right,dict):
            result[key]={"added":{x:right[x] for x in sorted(set(right)-set(left))},
                         "removed":{x:left[x] for x in sorted(set(left)-set(right))},
                         "modified":{x:{"old":left[x],"new":right[x]}
                                     for x in sorted(set(left)&set(right)) if left[x]!=right[x]}}
        else:result[key]={"old":left,"new":right}
    return result

def record(name,value):
    (OUT/(name+".json")).write_text(json.dumps(value,indent=2,sort_keys=True)+"\n")

def apply_local(sql,path,version,name):
    assert re.fullmatch(r"\d{14}",version) and re.fullmatch(r"[a-z0-9_]+",name)
    assert hashlib.md5(sql.encode()).hexdigest()==expected_md5[version]
    pathlib.Path(path).write_text(sql)
    psql_file(path,"apply-"+version)
    # LOCAL LEDGER EMULATION ONLY: the version already exists on Production and
    # cannot be replayed by normal CLI after local compatibility SQL.
    encoded=sql.encode("utf-8").hex()
    ins=("insert into supabase_migrations.schema_migrations(version,name,statements) values "
         f"('{version}','{name}',ARRAY[convert_from(decode('{encoded}','hex'),'UTF8')]);")
    psql_query(ins,"ledger-"+version)

guard()
raw=json.loads(FIXTURE.read_text())
history=raw["migrations"]
assert len(history)==19
assert [x["version"] for x in history]==sorted(x["version"] for x in history)
assert all(hashlib.md5(x["sql"].encode("utf-8")).hexdigest()==x["md5"]
           and len(x["sql"].encode())==x["bytes"] for x in history)
expected_md5={x["version"]:x["md5"] for x in history}
assert history[7]["version"]=="20260928154500"
assert history[8]["version"]=="20260928194713"
assert history[-1]["version"]=="20260929161113"
prod_snapshot=json.loads((ROOT/"tests/integration/step7c-production-structural-baseline.json").read_text())
assert len(prod_snapshot["migrationVersions"])==20
with tempfile.TemporaryDirectory(prefix="step7c-local-only-") as tmp:
    backup=pathlib.Path(tmp)/"canonical-migrations"
    shutil.copytree(MIG,backup)
    auth=(backup/ORIGINAL_AUTH).read_text()
    assert hashlib.md5(auth.encode()).hexdigest()=="95e66762a514d72bad7d7c6cf5dc58cd"
    expected_md5["20261002190436"]="95e66762a514d72bad7d7c6cf5dc58cd"
    for file in MIG.glob("*.sql"):file.unlink()
    for row in history[:8]:
        (MIG/(row["version"]+"_"+row["name"]+".sql")).write_text(row["sql"])
    assert len(list(MIG.glob("*.sql")))==8
    # Local Supabase CLI is not linked; startup and reset target Docker only.
    cmd(["supabase","start"],"local-start")
    status=cmd(["supabase","status","-o","env"],"local-status",capture=True)
    assert re.search(r"API_URL=['\"]?http://127\.0\.0\.1:54321",status), "Refusing nonlocal Supabase API"
    cmd(["supabase","db","reset","--local","--yes"],"first-eight-clean-reset")
    count=int(psql_query("select count(*) from supabase_migrations.schema_migrations","ledger-first-eight"))
    assert count==8, f"Expected 8 historical migrations, got {count}"
    # This setup is NOT a 21st historical migration. Current Production has
    # these five tables although original recorded 20260928194713 omits CREATE.
    psql_file(COMPAT,"documented-snapshot-production-state-compatibility")
    for row in history[8:]:
        v=row["version"]
        apply_local(row["sql"],pathlib.Path(tmp)/(v+"_"+row["name"]+".sql"),v,row["name"])
    apply_local(auth,pathlib.Path(tmp)/ORIGINAL_AUTH,"20261002190436","auth_billing_foundation")
    assert int(psql_query("select count(*) from supabase_migrations.schema_migrations","ledger-phase-a"))==20
    acl_before=psql_query("select has_schema_privilege('service_role','catalogue_internal','USAGE')","private-usage-before")
    if acl_before=="f":
        psql_query("grant usage on schema catalogue_internal to service_role","production-existing-grant-local-compatibility")
    else:print("Existing service_role USAGE came from historical SQL or local stack",flush=True)
    record("compatibility-actions",{
       "snapshotTables":"Five public snapshots built from the exact prelude of the canonical repository migration BEFORE original historical 20260928194713",
       "snapshotSetupNotInHistoricalLedger":True,
       "grant":"Production-state compatibility setup only: service_role USAGE on catalogue_internal",
       "grantWasRequired":acl_before=="f",
       "historicalSqlVersions":20,
       "manualLocalLedgerEmulation":"12 original Production versions recorded only after their original SQL completed; never on remote"})
    phase_a=snapshot("phase-a")
    diff_a=changes(phase_a,prod_snapshot)
    record("phase-a-vs-production-diff",diff_a)
    structural=["relations","columns","indexes","constraints","policies","triggers",
                "functions","enums","schemaPrivateGrant","serviceUsage","anonUsage",
                "authenticatedUsage","cron","migrationVersions"]
    unexpected={k:diff_a[k] for k in structural if k in diff_a}
    if unexpected:
        record("phase-a-unexpected-schema-diff",unexpected)
        raise RuntimeError("Unexpected Phase-A schema difference versus live read-only Production baseline")
    print("PHASE_A_PASS 20 exact applied Production SQLs + two documented compatibility actions; structure matches current Production",flush=True)
    before_legacy=json.loads(cmd(["psql",URL,"-X","-qAt","-v","ON_ERROR_STOP=1","-f",str(SEED)],"synthetic-legacy-seed",capture=True).strip())
    record("synthetic-legacy-before",before_legacy)
    assert all(before_legacy[k]==1 for k in ("products","offers","identityEvidence","technicalEvidence"))
    assert before_legacy["selectable"]==0
    current=phase_a
    stage=[]
    for missing in MISSING:
        version,name=missing[:14],missing[15:-4]
        source=(backup/missing).read_text()
        expected_md5[version]=hashlib.md5(source.encode()).hexdigest()
        apply_local(source,pathlib.Path(tmp)/missing,version,name)
        nxt=snapshot("post-"+version)
        diff=changes(current,nxt)
        record("delta-"+version,diff)
        stage.append({"migration":missing,"success":True,"changes":diff})
        print("UPGRADE_STAGE_PASS",missing,"changed_keys=",list(diff),flush=True)
        current=nxt
    record("four-migration-deltas",stage)
    assert len(current["migrationVersions"])==24
    assert current["serviceUsage"] and not current["anonUsage"] and not current["authenticatedUsage"]
    assert sum(1 for e in current["enums"] if e.startswith("public.drone_product_category:"))==18
    assert any("public.catalogue_import_runs" in n for n in current["relations"])
    assert any("public.catalogue_import_run_items" in n for n in current["relations"])
    phase_b=current
    record("auth-preservation",{
      k:{"phaseA":[x for x in phase_a.get(k,[]) if any(t in x for t in (
         "profiles","plans","subscriptions","payment_methods","invoices","usage_counters","saved_builds","handle_new_user","set_updated_at","on_auth_user_created"))],
         "phaseB":[x for x in phase_b.get(k,[]) if any(t in x for t in (
         "profiles","plans","subscriptions","payment_methods","invoices","usage_counters","saved_builds","handle_new_user","set_updated_at","on_auth_user_created"))]}
      for k in ("relations","columns","indexes","constraints","policies","triggers","functions")})
    preserved=json.loads(psql_query(
     "select jsonb_build_object('products',(select count(*) from public.catalogue_products),"
     "'offers',(select count(*) from public.catalogue_offers),"
     "'identityEvidence',(select count(*) from public.catalogue_identity_evidence),"
     "'technicalEvidence',(select count(*) from public.catalogue_spec_evidence),"
     "'legacyProduct',(select count(*) from public.catalogue_products where id='step7c-local-legacy-prop'),"
     "'legacyOffer',(select count(*) from public.catalogue_offers where id='88000000-0000-0000-0000-000000000004'),"
     "'legacySpec',(select count(*) from public.catalogue_spec_evidence where id='88000000-0000-0000-0000-000000000006'),"
     "'legacyIdentity',(select count(*) from public.catalogue_identity_evidence where id='88000000-0000-0000-0000-000000000005'),"
     "'selectable',(select count(*) from public.catalogue_products where selectable))",
     "synthetic-preserved-post-upgrade"))
    record("synthetic-legacy-after",preserved)
    assert all(preserved[x]==1 for x in ("products","offers","identityEvidence","technicalEvidence",
                                       "legacyProduct","legacyOffer","legacySpec","legacyIdentity"))
    assert preserved["selectable"]==0
    print("PHASE_B_PASS four original missing SQL migrations applied in requested order after actual 20 historical versions; synthetic legacy rows preserved",flush=True)
    # Remove only local synthetic compatibility records for an unmodified HQProp
    # regression, whose initial assertions correctly require zero catalogue rows.
    cleanup="""delete from public.catalogue_products where id='step7c-local-legacy-prop';
delete from public.catalogue_sources where id='88000000-0000-0000-0000-000000000002';
delete from public.catalogue_merchants where id='88000000-0000-0000-0000-000000000003';
delete from public.catalogue_manufacturers where id='88000000-0000-0000-0000-000000000001';"""
    psql_query(cleanup,"remove-only-disposable-synthetic-legacy-fixture")
    assert psql_query("select count(*) from public.catalogue_products","pre-hqprop-zero-products")=="0"
    psql_file(ROOT/"tests/integration/step7b-auth-rls.sql","post-upgrade-auth-rls")
    for n in range(2):
        psql_file(ROOT/"tests/integration/catalogue-local-staging-bootstrap.sql","bootstrap-"+str(n+1))
    psql_file(ROOT/"tests/integration/catalogue-local-staging-readiness.sql","post-upgrade-readiness")
    psql_file(ROOT/"tests/integration/catalogue-import-reliability.sql","post-upgrade-p0-reliability")
    # Existing importer smoke and unchanged real manufacturer test are invoked
    # by workflow steps while Phase-B database is still running.
    record("phase-b-confirmed",{"migrations":24,"legacySyntheticPreserved":True,
             "authRls":"passed","readiness":"passed","p0Recovery":"passed"})
print("REPLAY_PHASES_FINISHED; local DB remains active for HTTP/HQProp regression",flush=True)
