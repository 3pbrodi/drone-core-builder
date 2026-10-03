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
OUT = ROOT / "step8-results"
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
REQUIRED_BRANCH = "verification/step8-production-migration-plan-20261003"

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
        # The output of "supabase status -o env" includes disposable service
        # keys. Keep only the local API endpoint in uploaded CI evidence.
        safe_stdout = p.stdout
        safe_stderr = p.stderr
        if label == "local-status":
            safe_stdout = "\n".join(line for line in p.stdout.splitlines()
                                    if line.startswith("API_URL=")) + "\n[all ephemeral local keys omitted]"
            safe_stderr = "[other ephemeral local status values omitted]"
        log.write("stdout:\n" + safe_stdout + "\nstderr:\n" + safe_stderr)
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
       "currentProductionSnapshotFunction":"Canonical current Production body, read-only MD5 328171e95330d6b5d0f297f18105f581; original stored migration remains unchanged",
       "threeCurrentProductionPrimaryKeyNames":["catalogue_public_fc_esc_evidence_next_pkey","catalogue_public_motor_esc_current_evidence_next_pkey","catalogue_public_motor_propeller_evidence_next_pkey"],
       "historicalSqlVersions":20,
       "manualLocalLedgerEmulation":"12 original Production versions recorded only after their original SQL completed; never on remote"})
    # Only LOCAL: restore three existing Production PK/index names and the
    # currently installed canonical snapshot refresh function. Original 20 SQL
    # texts and their simulated migration records remain untouched.
    psql_file(ROOT/"tests/integration/step7c-local-current-snapshot-compatibility.sql",
              "documented-current-production-snapshot-compatibility")
    phase_a=snapshot("phase-a")
    diff_a=changes(phase_a,prod_snapshot)
    record("phase-a-vs-production-diff",diff_a)
    structural=["relations","columns","indexes","constraints","policies","triggers",
                "functions","enums","schemaPrivateGrant","serviceUsage","anonUsage",
                "authenticatedUsage","cron","migrationVersions","functionHashes"]
    unexpected={k:diff_a[k] for k in structural if k in diff_a}
    if unexpected:
        record("phase-a-unexpected-schema-diff",unexpected)
        raise RuntimeError("Unexpected Phase-A schema difference versus live read-only Production baseline")
    print("PHASE_A_PASS 20 exact applied Production SQLs + two documented compatibility actions; structure matches current Production",flush=True)
    # The exact original 20-migration Production schema is now simulated with
    # its documented local-only snapshot/USAGE compatibility setup.
    # Restore the 24 canonical migration files IN THE DISPOSABLE CHECKOUT only.
    shutil.copytree(backup,MIG,dirs_exist_ok=True)
    assert len(list(MIG.glob("*.sql")))==24
    assert psql_query("select count(*) from supabase_migrations.schema_migrations","before-cli-versions")=="20"
    synthetic_raw=cmd(["psql",URL,"-X","-qAt","-v","ON_ERROR_STOP=1",
         "-f",str(ROOT/"tests/integration/step8-production-shaped-synthetic.sql")],
         "synthetic-25-shape",capture=True).strip()
    fixture=json.loads(synthetic_raw.splitlines()[-1])
    expected={"products":25,"candidates":1,"offers":25,"identityEvidence":25,
       "technicalEvidence":98,"importBatches":5,"importRows":40,"sourceLinks":0,
       "unresolved":24,"new":16}
    assert all(fixture.get(k)==v for k,v in expected.items()), f"Shape mismatch: {fixture}"
    record("synthetic-shape-before",fixture)
    print("SYNTHETIC_SHAPE_PASS 25 synthetic products, 25 offers, 25 identity, 98 spec, five batches, 40 rows",flush=True)
    def baseline_fingerprint(stage):
        val=psql_query(
          "select jsonb_build_object("+
          "'products',(select md5(string_agg((to_jsonb(p)-'integrated_categories'-'included_categories')::text,',' order by id)) from public.catalogue_products p),"+
          "'specs',(select md5(string_agg((to_jsonb(s)-'battery_chemistry'-'battery_connector'-'fc_peripheral_interfaces'-'fc_peripheral_power_voltages_v'-'video_transmitter_system'-'vtx_camera_video_interfaces'-'vtx_antenna_connector'-'vtx_frequency_min_mhz'-'vtx_frequency_max_mhz'-'antenna_connector'-'antenna_frequency_min_mhz'-'antenna_frequency_max_mhz'-'radio_protocols'-'supported_video_systems'-'charger_battery_chemistries'-'charger_min_cells'-'charger_max_cells'-'charger_connectors'-'charging_connectors'-'device_signal_interface'-'device_min_voltage_v'-'device_max_voltage_v')::text,',' order by product_id)) from public.catalogue_product_specs s),"+
          "'offers',(select md5(string_agg(to_jsonb(o)::text,',' order by id)) from public.catalogue_offers o),"+
          "'identityEvidence',(select md5(string_agg(to_jsonb(e)::text,',' order by id)) from public.catalogue_identity_evidence e),"+
          "'technicalEvidence',(select md5(string_agg(to_jsonb(e)::text,',' order by id)) from public.catalogue_spec_evidence e),"+
          "'identityKeys',(select md5(string_agg(to_jsonb(k)::text,',' order by id)) from public.catalogue_product_identity_keys k),"+
          "'importBatches',(select md5(string_agg((to_jsonb(b)-'import_run_id'-'chunk_key')::text,',' order by id)) from public.catalogue_import_batches b),"+
          "'importRows',(select md5(string_agg((to_jsonb(r)-'updated_at'-'import_run_id'-'run_item_id'-'upstream_item_id')::text,',' order by id)) from public.catalogue_import_rows r),"+
          "'plans',(select md5(string_agg(to_jsonb(p)::text,',' order by id)) from public.plans p))",
          "fingerprints-"+stage)
        result=json.loads(val);record("fingerprints-"+stage,result);return result
    original_fingerprints=baseline_fingerprint("phase-a")
    # Ephemeral DATA-ONLY synthetic export; NEVER upload/commit actual row dumps.
    synthetic_backup=pathlib.Path(tmp)/"synthetic-phase-a.dump"
    table_names=("catalogue_manufacturers","catalogue_sources","catalogue_merchants",
       "catalogue_products","catalogue_product_specs","catalogue_offers",
       "catalogue_identity_evidence","catalogue_spec_evidence",
       "catalogue_product_identity_keys","catalogue_import_batches","catalogue_import_rows")
    # Host runner often ships pg_dump 16 while disposable Supabase uses PG17;
    # select the local Supabase DB container and use its version-matched tools.
    db_containers=cmd(["docker","ps","--filter","name=supabase_db_",
                      "--format","{{.ID}}"],"find-local-db-container",capture=True).splitlines()
    assert len(db_containers)==1, f"Expected exactly one disposable Supabase DB, got {len(db_containers)}"
    db_container=db_containers[0].strip()
    db_dump_inside="/tmp/step8-synthetic-phase-a-only.dump"
    cmd(["docker","exec","-e","PGPASSWORD=postgres",db_container,
         "pg_dump","--username=postgres","--dbname=postgres",
         "--format=custom","--data-only","--no-owner","--no-privileges",
         *[arg for name in table_names for arg in ("--table","public."+name)],
         "--file",db_dump_inside],"synthetic-data-only-export")
    cmd(["docker","cp",db_container+":"+db_dump_inside,str(synthetic_backup)],
        "copy-only-local-synthetic-dump-to-ephemeral-runner")
    assert synthetic_backup.is_file() and synthetic_backup.stat().st_size>0
    cmd(["docker","exec",db_container,"pg_restore","--list",db_dump_inside],
        "synthetic-backup-toc")
    record("synthetic-backup",{"syntheticDataOnly":True,
       "fullProductionBackup":False,"restoredProduction":False,
       "dumpBytes":synthetic_backup.stat().st_size,
       "dumpSHA256":hashlib.sha256(synthetic_backup.read_bytes()).hexdigest(),
       "tables":list(table_names)})
    # Inspect CLI syntax at the PINNED version. No linked project or remote token.
    for args,name in [
       (["supabase","db","push","--help"],"cli-db-push-help"),
       (["supabase","migration","up","--help"],"cli-migration-up-help"),
       (["supabase","migration","repair","--help"],"cli-repair-help"),
       (["supabase","db","dump","--help"],"cli-dump-help")]:
        cmd(args,name)
    dry_stdout=cmd(["supabase","db","push","--local","--include-all","--dry-run"],
            "local-cli-older-version-dry-run",capture=True)
    # CLI 2.118 writes the "Would push these migrations" list to STDERR.
    # Include both streams from the sanitized local CI log, never remote output.
    dry=(OUT/"local-cli-older-version-dry-run.log").read_text()
    expected_versions=[name[:14] for name in MISSING]
    expected_files=[MIG/name for name in MISSING]
    assert all(v in dry for v in expected_versions), "Local --include-all dry-run did not list all four missing older migrations"
    import re as _step8_re
    listed=_step8_re.findall(r"\b\d{14}_[a-z0-9_]+\.sql\b",dry)
    assert listed==MISSING, f"Unexpected dry-run migration list: {listed}"
    assert int(psql_query("select count(*) from supabase_migrations.schema_migrations","after-dry-run-ledger"))==20
    record("cli-dry-run",{"onlyLocal":True,"dryRunNonMutating":True,
       "recordCountBefore":20,"recordCountAfter":20,
       "expectedMissingOlderVersions":expected_versions,"exactExpectedOrder":True,
       "output":dry[-6000:]})
    print("CLI_DRY_RUN_PASS: all four missing historical versions visible; ledger remains 20",flush=True)
    applied=cmd(["supabase","db","push","--local","--include-all","--yes"],
                "local-cli-include-all-apply",capture=True)
    assert int(psql_query("select count(*) from supabase_migrations.schema_migrations","after-cli-ledger"))==24
    all_applied=psql_query("select string_agg(version,',' order by version) from supabase_migrations.schema_migrations","after-cli-versions")
    assert all(v in all_applied for v in expected_versions)
    schema=snapshot("after-actual-local-cli-four-upgrade")
    assert schema["serviceUsage"] and not schema["anonUsage"] and not schema["authenticatedUsage"]
    assert sum(1 for e in schema["enums"] if e.startswith("public.drone_product_category:"))==18
    after_fingerprints=baseline_fingerprint("phase-b")
    changed={k:{"before":original_fingerprints.get(k),"after":after_fingerprints.get(k)}
        for k in original_fingerprints if original_fingerprints.get(k)!=after_fingerprints.get(k)}
    record("fingerprint-changes",changed)
    if changed:raise RuntimeError("Unexpected synthetic data changes through local 4-migration CLI upgrade: "+str(list(changed)))
    after_shape=json.loads(psql_query(
       "select jsonb_build_object("+
       "'products',(select count(*) from public.catalogue_products),"+
       "'candidates',(select count(*) from public.catalogue_products where record_class='candidate'),"+
       "'offers',(select count(*) from public.catalogue_offers),"+
       "'identityEvidence',(select count(*) from public.catalogue_identity_evidence),"+
       "'technicalEvidence',(select count(*) from public.catalogue_spec_evidence),"+
       "'importBatches',(select count(*) from public.catalogue_import_batches),"+
       "'importRows',(select count(*) from public.catalogue_import_rows),"+
       "'manifestItems',(select count(*) from public.catalogue_import_run_items),"+
       "'importRuns',(select count(*) from public.catalogue_import_runs),"+
       "'sourceLinks',(select count(*) from public.catalogue_product_sources),"+
       "'duplicateIdentities',(select count(*) from (select manufacturer_id,category,lower(trim(model)),lower(trim(coalesce(variant,''))),lower(trim(coalesce(manufacturer_sku,''))),lower(trim(coalesce(mpn,''))) from public.catalogue_products where manufacturer_id is not null group by 1,2,3,4,5,6 having count(*)>1) d),"+
       "'unresolved',(select count(*) from public.catalogue_import_rows where dedupe_status='unresolved'),"+
       "'new',(select count(*) from public.catalogue_import_rows where dedupe_status='new'))",
       "after-cli-upgrade-shape"))
    record("synthetic-shape-after",after_shape)
    for k,v in expected.items(): assert after_shape.get(k)==v, f"unexpected shape drift {k}: {after_shape}"
    assert after_shape["duplicateIdentities"]==0 and after_shape["manifestItems"]==0 and after_shape["importRuns"]==0
    assert int(psql_query("select count(*) from public.catalogue_public_runtime_products",
       "synthetic-public-snapshot-count"))==0, "Synthetic pending_review must never be published"
    record("cli-upgrade",{"localOnly":True,"cliVersion":"2.118.0",
       "appliedVersions":expected_versions,"ledgerCount":24,
       "allOriginalColumnFingerprintsIdentical":True,
       "originalIdentityKeysUnchanged":True,"syntheticPendingReviewNotPublished":True,
       "dataShapeAfter":after_shape})
    print("STEP8_LOCAL_CLI_UPGRADE_PASS 20 -> 24: identities preserved, 25/25/25/98/5/40 shape intact; zero accidental publishing",flush=True)
    # Prove an ACTUAL data-only restore of the synthetic 20-version dump into
    # a second CLEAN 24-migration local state, NOT a Production data restore.
    # The earlier table/row SHA-256 manifest is kept only in local CI evidence.
    cmd(["supabase","db","reset","--local","--yes"],"synthetic-restore-fresh24-schema")
    assert int(psql_query("select count(*) from supabase_migrations.schema_migrations",
       "synthetic-restore-ledger"))==24
    assert int(psql_query("select count(*) from public.catalogue_products",
       "synthetic-restore-empty-check"))==0
    new_containers=cmd(["docker","ps","--filter","name=supabase_db_",
       "--format","{{.ID}}"],"find-reset-db-container",capture=True).splitlines()
    assert len(new_containers)==1
    restore_container=new_containers[0].strip()
    db_restore_inside="/tmp/step8-synthetic-data-restore.dump"
    cmd(["docker","cp",str(synthetic_backup),
       restore_container+":"+db_restore_inside],"copy-only-local-synthetic-dump-for-restore")
    # The Supabase local 'postgres' role is intentionally NOT a real
    # superuser, so pg_restore --disable-triggers cannot disable FK/system
    # triggers. Retain ALL system FK checks; disable only owner-managed user
    # triggers for the eleven disposable fixture tables, preventing duplicate
    # auto-generated identity keys while replaying their original saved rows.
    for tbl in table_names:
        psql_query("alter table public."+tbl+" disable trigger user",
                   "restore-disable-user-trigger-"+tbl)
    try:
        cmd(["docker","exec","-e","PGPASSWORD=postgres",restore_container,
           "pg_restore","--username=postgres","--dbname=postgres","--data-only",
           "--exit-on-error","--no-owner","--no-privileges",
           db_restore_inside],"actual-synthetic-data-only-restore-clean24")
    finally:
        for tbl in table_names:
            psql_query("alter table public."+tbl+" enable trigger user",
                       "restore-enable-user-trigger-"+tbl)
    restored_fingerprints=baseline_fingerprint("synthetic-restored-clean24")
    # 3 free/pro/team plan rows are regenerated by a fresh schema reset, and
    # intentionally not exported as "Production backup" by this synthetic dump.
    original_app={k:v for k,v in original_fingerprints.items() if k!="plans"}
    restored_app={k:v for k,v in restored_fingerprints.items() if k!="plans"}
    restore_diffs={k:{"before":original_app.get(k),"after":restored_app.get(k)}
       for k in original_app if original_app.get(k)!=restored_app.get(k)}
    record("synthetic-restore-fingerprint-differences",restore_diffs)
    assert not restore_diffs, "Local synthetic data-only restore changed legacy column fingerprints"
    assert int(psql_query("select count(*) from public.catalogue_products",
       "actual-synthetic-restore-25-products"))==25
    assert int(psql_query("select count(*) from public.catalogue_import_rows",
       "actual-synthetic-restore-40-rows"))==40
    assert int(psql_query("select count(*) from public.catalogue_public_runtime_products",
       "actual-synthetic-restore-no-unreviewed-publication"))==0
    record("synthetic-restore-result",{
       "status":"PASS","archiveType":"synthetic phase-A application DATA ONLY",
       "productionBackupCreated":False,"realProductionRestored":False,
       "restoredInto":"fresh disposable LOCAL 24-migration schema",
       "oldColumnFingerprintsIdentical":True,
       "plansRegeneratedByFreshSchemaNotRestored":True,
       "products":25,"legacyImportRows":40,"publicSnapshot":0,
       "dumpSHA256":hashlib.sha256(synthetic_backup.read_bytes()).hexdigest()})
    print("STEP8_SYNTHETIC_RESTORE_PASS 25 synthetic products and 40 legacy import rows actually restored into separate clean local 24-migration reset",flush=True)
print("STEP8_LOCAL_PHASE_A_AND_CLI_REHEARSAL_DONE: only disposable local database changed",flush=True)
