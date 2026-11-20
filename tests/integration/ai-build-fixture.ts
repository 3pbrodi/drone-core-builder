// Loopback-only synthetic catalogue for AI flow checks; no external/database access.
import http from "node:http";
import { fixture, proofs } from "./ai-build-fixture-data";
const { products: base, make } = fixture();
const products = [
  ...base.filter((p) => !["frame", "propellers"].includes(p.category)),
  make("frame", { id: "small", frameInches: 2.5, mount: "16x16" }),
  make("frame", { id: "large", frameInches: 7, mount: "16x16" }),
  make("propellers", { id: "small-prop", propInches: 2.5, packageQuantity: 4 }),
  make("propellers", { id: "large-prop", propInches: 7, packageQuantity: 4 }),
  make("frame", { id: "blue", variant: "Blue", frameInches: 2.5, mount: "16x16" }),
];
const evidence = proofs(products),
  requests: unknown[] = [];
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    const url = new URL(req.url!, "http://127.0.0.1:4289");
    if (url.pathname === "/metrics") return res.end(JSON.stringify(requests));
    const q = JSON.parse(url.searchParams.get("query") ?? "{}");
    requests.push(q);
    const own =
        q.mode === "ids"
          ? products.filter((p) => (q.ids ?? []).includes(p.id))
          : products.filter((p) => !q.category || p.category === q.category),
      page = q.page ?? 1,
      selected = q.mode === "ids" ? own : own.slice((page - 1) * 50, page * 50),
      ids = new Set([...selected.map((p) => p.id), ...(q.selectedIds ?? [])]);
    const proof = {
      fields: evidence.fields.filter((e) => ids.has(e.productId)),
      motorPropeller: evidence.motorPropeller.filter(
        (e) => ids.has(e.motorId) && ids.has(e.propellerId),
      ),
      motorEscCurrent: evidence.motorEscCurrent.filter(
        (e) => ids.has(e.motorId) && ids.has(e.escId),
      ),
      fcEscConnection: evidence.fcEscConnection.filter(
        (e) => ids.has(e.flightControllerId) && ids.has(e.escId),
      ),
    };
    res.end(
      JSON.stringify({
        queryVersion: 1,
        source: "database",
        status: "ready",
        products: selected,
        total: own.length,
        page,
        pageSize: 50,
        hasMore: q.mode !== "ids" && page * 50 < own.length,
        manufacturers: [],
        evidence: proof,
        validation: {
          ok: true,
          missingCategories: [],
          duplicateProductIds: [],
          rejectedProductIds: [],
          invalidProductIds: [],
        },
      }),
    );
  })
  .listen(4289, "127.0.0.1", () => console.log("AI synthetic fixture ready"));
