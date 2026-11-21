/** No network/database credentials: a disposable database inside the existing local container only. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import {
  mapEvidenceRows,
  type FcEscConnectionEvidenceRow,
  type MotorPropellerEvidenceRow,
} from "../../supabase/functions/_shared/catalogue-evidence-read";
const container = "dronecores_catalogue_staging";
const quote = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
const json = (value: unknown) => quote(JSON.stringify(value)) + "::jsonb";
function sql(database: string, input: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-h",
      "/tmp",
      "-U",
      "postgres",
      "-d",
      database,
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] },
  );
}
const digestQuery = `select md5(string_agg(t::text,'|' order by name)) from (
  select c.relname name, jsonb_build_object('name',c.relname,'columns',(select jsonb_agg(to_jsonb(a) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) t
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','catalogue_internal')
  union all select p.oid::text, to_jsonb(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','catalogue_internal') and p.prokind='f'
  union all select 'products',to_jsonb(t) from public.catalogue_products t
  union all select 'events',to_jsonb(t) from public.catalogue_promotion_events t
  union all select 'sources',to_jsonb(t) from public.catalogue_sources t
  union all select 'snapshots',to_jsonb(t) from public.catalogue_source_snapshots t
  union all select 'fcEsc',to_jsonb(t) from public.catalogue_fc_esc_connection_evidence t
  union all select 'motorProp',to_jsonb(t) from public.catalogue_motor_propeller_evidence t
  union all select 'sequences',to_jsonb(t) from pg_sequences t where schemaname='public'
) q;`;
export function rehearseManufacturerPairs() {
  assert.equal(
    sql("postgres", "select current_setting('dronecores.environment',true);"),
    "local-catalogue-staging\n",
  );
  const before = sql("postgres", digestQuery),
    database = "dronecores_pair_" + randomUUID().replaceAll("-", "");
  const dossier = JSON.parse(
    readFileSync("qa/manufacturer-compatibility-dossier-20261121.json", "utf8"),
  );
  const selected = dossier.pairDossiers.filter(
    (p: any) => p.nativeCandidate && p.id !== "wiring-v4-55",
  );
  assert.equal(selected.length, 5);
  const sources = new Map<string, any>(dossier.sources.map((s: any) => [s.id, s]));
  const migration = readdirSync("supabase/migrations").find((name) =>
    name.endsWith("_catalogue_pair_evidence_review.sql"),
  )!;
  let program = "begin;\n" + readFileSync("supabase/migrations/" + migration, "utf8") + "\n";
  // The review-room service_role is a non-BYPASSRLS stub. Match its intended
  // privileged catalogue access using clone-only policies; never ALTER a cluster role.
  // The actual hosted service-role setup is not inspected or modified by this test.
  for (const table of ["catalogue_fc_esc_connection_evidence","catalogue_motor_propeller_evidence",
    "catalogue_sources","catalogue_source_snapshots","catalogue_products","catalogue_identity_evidence","catalogue_promotion_events"]) {
    program += `create policy pair_rehearsal_service_access on public.${table} for all to service_role using(true) with check(true);\n`;
  }
  // These exact-ID product/identity rows exist ONLY in the disposable rehearsal.
  // Manufacturer claims are real pinned dossiers; fixture identities are not production approvals.
  const identitySource = randomUUID();
  program += `insert into public.catalogue_sources(id,name,kind,base_url,verification_status) values(${quote(identitySource)},'Local rehearsal identity fixture','manufacturer','https://example.invalid','verified');\n`;
  const fixtureProducts = new Map<string, string>();
  for (const pair of selected)
    pair.productIds.forEach((id: string, index: number) =>
      fixtureProducts.set(
        id,
        pair.kind === "fc_esc_connection"
          ? ["flightController", "esc"][index]!
          : ["motors", "propellers"][index]!,
      ),
    );
  for (const [id, category] of fixtureProducts) {
    program += `insert into public.catalogue_products(id,model,display_name,category,identity_status,identity_verified_at,record_class)
      values(${quote(id)},'Rehearsal exact-ID fixture','Rehearsal fixture',${quote(category)},'verified',now(),'canonical') on conflict(id) do nothing;\n`;
    // Existing data is retained, but proof fixtures avoid depending on unrelated historical source state.
    program += `insert into public.catalogue_identity_evidence(product_id,source_id,source_url,authority,manufacturer_label,model_label,exact_model_association,verification_status,retrieved_at,verified_at)
      values(${quote(id)},${quote(identitySource)},'https://example.invalid/identity','manufacturer','Rehearsal fixture','Rehearsal exact-ID fixture',true,'verified',now(),now());\n`;
  }
  // Reject stale approval and invalid source/operating-condition mutations in subtransactions.
  const mustFail = (statement: string, expected: string) =>
    `do $test$ begin begin ${statement}; raise exception 'TEST: unexpectedly accepted'; exception when others then if position(${quote(expected)} in SQLERRM)=0 then raise; end if; end; end $test$;\n`;
  const approve = (
    kind: string,
    table: string,
    id: string,
    decision = "approve",
  ) => `select public.catalogue_review_pair_evidence(${quote(kind)},${quote(id)},${quote(decision)},'documented-source-review/local-rehearsal','Exact dossier, source fingerprint, variant and supplied-harness/6S conditions checked; not full mechanical or firmware approval',
    (select encode(sha256(convert_to(to_jsonb(e)::text,'UTF8')),'hex') from public.${table} e where id=${quote(id)}))`;
  const ids: {
    id: string;
    kind: string;
    table: string;
    source: string;
    snapshot: string;
    left: string;
  }[] = [];
  for (const pair of selected) {
    const capture = sources.get(pair.sourceIds[0])!,
      source = randomUUID(),
      snapshot = randomUUID(),
      id = randomUUID();
    assert.equal(capture.status, "captured");
    if (process.env.DRONECORES_PAIR_ARCHIVES) {
      const bytes = readFileSync(
        process.env.DRONECORES_PAIR_ARCHIVES + "/" + capture.privateRawPath,
      );
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        capture.sha256,
        "Captured source changed",
      );
    }
    assert.match(capture.sha256, /^[a-f0-9]{64}$/);
    const kind = pair.kind === "fc_esc_connection" ? "fc_esc_connection" : "motor_propeller";
    const table =
      kind === "fc_esc_connection"
        ? "catalogue_fc_esc_connection_evidence"
        : "catalogue_motor_propeller_evidence";
    ids.push({ id, kind, table, source, snapshot, left: pair.productIds[0] });
    program += `insert into public.catalogue_sources(id,name,kind,base_url,verification_status) values(${quote(source)},${quote("Manufacturer pair " + pair.id)},'manufacturer',${quote(new URL(capture.url).origin)},'verified');
      insert into public.catalogue_source_snapshots(id,source_id,external_product_id,source_url,content_hash,retrieved_at,metadata)
      values(${quote(snapshot)},${quote(source)},${quote(pair.productIds[0])},${quote(capture.url)},${quote(capture.sha256)},${quote(capture.retrievedAt)},${json({ productIds: pair.productIds, pairDossierId: pair.id, fixtureReview: true })});\n`;
    const columns =
      kind === "fc_esc_connection"
        ? "flight_controller_product_id,esc_product_id,connector_family_verified,pinout_verified,wire_order_verified,signal_compatibility_verified,voltage_compatibility_verified,details"
        : "motor_product_id,propeller_product_id,operating_conditions";
    const conditions = { minBatteryCells: 3, maxBatteryCells: 6 };
    const values =
      pair.productIds.map(quote).join(",") +
      (kind === "fc_esc_connection"
        ? ",true,true,true,true,true," +
          json({ operatingConditions: conditions, suppliedHarnessOnly: true })
        : "," + json(pair.nativeCandidate.operatingConditions));
    const locator =
      pair.locator ?? "Exact named motor/propeller BOM and official component SKU pages";
    program += `insert into public.${table}(id,${columns},result,source_id,authority,exact_products_verified,verification_status,retrieved_at,
      source_snapshot_id,source_url,source_content_hash,source_locator,compatibility_scope)
      values(${quote(id)},${values},'compatible',${quote(source)},'manufacturer',true,'pending_review',${quote(capture.retrievedAt)},
      ${quote(snapshot)},${quote(capture.url)},${quote(capture.sha256)},${quote(locator)},${quote(pair.scope)});\n`;
    program += `do $test$ begin if exists(select 1 from public.${kind === "fc_esc_connection" ? "catalogue_public_fc_esc_evidence" : "catalogue_public_motor_propeller_evidence"} where id=${quote(id)}) then raise exception 'Pending pair leaked'; end if; end $test$;\n`;
    program += mustFail(
      `perform public.catalogue_review_pair_evidence(${quote(kind)},${quote(id)},'approve','qa','qa',repeat('0',64))`,
      "Pair changed since review",
    );
    program += mustFail(
      `update public.${table} set verification_status='verified',verified_at=now() where id=${quote(id)}`,
      "current native review record",
    );
    program += `set local role service_role;\n${approve(kind, table, id)};\nreset role;\n`;
  }
  program += `select 'PAIR_READ:'||jsonb_build_object('fcEscRows',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.catalogue_public_fc_esc_evidence e where id in (${ids.map((x) => quote(x.id)).join(",")})),
    'motorPropellerRows',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.catalogue_public_motor_propeller_evidence e where id in (${ids.map((x) => quote(x.id)).join(",")})))::text;\n`;
  program += `do $test$ begin
    if has_function_privilege('anon','public.catalogue_review_pair_evidence(text,uuid,text,text,text,text)','execute') or has_function_privilege('authenticated','public.catalogue_review_pair_evidence(text,uuid,text,text,text,text)','execute') then raise exception 'Review RPC exposed'; end if;
    if exists(select 1 from pg_class where oid in ('public.catalogue_public_fc_esc_evidence'::regclass,'public.catalogue_public_motor_propeller_evidence'::regclass) and not relrowsecurity) then raise exception 'RLS disabled'; end if;
    if not has_table_privilege('anon','public.catalogue_public_fc_esc_evidence','select') or has_table_privilege('anon','public.catalogue_public_fc_esc_evidence','update') then raise exception 'Public privileges changed'; end if;
  end $test$;\n`;
  const [first, second, third, fourth, motor] = ids;
  program += mustFail(
    `update public.catalogue_source_snapshots set content_hash=repeat('f',64) where id=${quote(first!.snapshot)}`,
    "Referenced pair source capture is immutable",
  );
  program += mustFail(
    `update public.${first!.table} set source_snapshot_id=null where id=${quote(first!.id)}`,
    "Reviewed pair provenance cannot be removed",
  );
  // Editing approved claims must clear status and public cache before re-review.
  program += `update public.${first!.table} set compatibility_scope=compatibility_scope||' Re-review edit' where id=${quote(first!.id)};\n`;
  program += `do $test$ begin if exists(select 1 from public.catalogue_public_fc_esc_evidence where id=${quote(first!.id)}) then raise exception 'Edited proof stayed public'; end if; end $test$;\n`;
  program += `update public.${first!.table} set source_content_hash=repeat('f',64) where id=${quote(first!.id)};\n`;
  program += mustFail(
    approve(first!.kind, first!.table, first!.id).replace(/^select /, "perform "),
    "Pair review requires exact captured source",
  );
  program += `update public.catalogue_sources set verification_status='pending_review' where id=${quote(second!.source)};\n`;
  program += mustFail(
    approve(second!.kind, second!.table, second!.id).replace(/^select /, "perform "),
    "Pair source is not a verified primary source",
  );
  program += `${approve(third!.kind, third!.table, third!.id, "revoke")};\n`;
  program += `update public.catalogue_products set variant=coalesce(variant,'')||'-rehearsal-changed' where id=${quote(fourth!.left)};\n`;
  program += `update public.catalogue_identity_evidence set verification_status='rejected',verified_at=null where product_id=${quote(motor!.left)};\n`;
  program += mustFail(
    approve(motor!.kind, motor!.table, motor!.id).replace(/^select /, "perform "),
    "current verified exact identity evidence",
  );
  program += `select 'PAIR_REVOKED:'||jsonb_build_object('fcEscRows',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.catalogue_public_fc_esc_evidence e where id in (${ids.map((x) => quote(x.id)).join(",")})),
    'motorPropellerRows',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.catalogue_public_motor_propeller_evidence e where id in (${ids.map((x) => quote(x.id)).join(",")})))::text;\nrollback;\n`;
  try {
    // Source has pg_cron/pg_net workers; TEMPLATE copying would require interrupting them.
    // A logical clone excludes only scheduler/network/vault extensions, never invokes outbound jobs.
    sql("template1", `create database ${database} template template0;`);
    const dump = execFileSync(
      "docker",
      [
        "exec",
        container,
        "pg_dump",
        "-h",
        "/tmp",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "--format=custom",
        "--exclude-extension=pg_cron",
        "--exclude-extension=pg_net",
        "--exclude-extension=supabase_vault",
        "--exclude-schema=cron",
        "--exclude-schema=net",
        "--exclude-schema=vault",
      ],
      { maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] },
    );
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "pg_restore",
        "-h",
        "/tmp",
        "-U",
        "postgres",
        "-d",
        database,
        "--exit-on-error",
        "--clean",
        "--if-exists",
      ],
      { input: dump, maxBuffer: 8 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] },
    );
    const output = sql(database, program);
    const parse = (prefix: string) =>
      JSON.parse(
        output
          .split("\n")
          .find((line) => line.startsWith(prefix))!
          .slice(prefix.length),
      );
    const approved = parse("PAIR_READ:"),
      revoked = parse("PAIR_REVOKED:");
    assert.equal(approved.fcEscRows.length, 4);
    assert.equal(approved.motorPropellerRows.length, 1);
    assert.equal(revoked.fcEscRows.length, 0);
    assert.equal(revoked.motorPropellerRows.length, 0);
    const map = (rows: any) =>
      mapEvidenceRows({
        fields: [],
        motorEscRows: [],
        fcEscRows: rows.fcEscRows as FcEscConnectionEvidenceRow[],
        motorPropellerRows: rows.motorPropellerRows as MotorPropellerEvidenceRow[],
      });
    return {
      approved: map(approved),
      revoked: map(revoked),
      migration,
      dossierSha256: createHash("sha256")
        .update(readFileSync("qa/manufacturer-compatibility-dossier-20261121.json"))
        .digest("hex"),
      sourceDatabasePreserved: true,
    };
  } finally {
    sql("template1", `drop database if exists ${database};`);
    assert.equal(
      sql("postgres", digestQuery),
      before,
      "Existing local staging or sequence state changed",
    );
  }
}
