import test from "node:test";
import assert from "node:assert/strict";

import { createServerCache, pillarBCacheKey, pillarBCacheScope } from "../lib/dashboard-review/pillar-b/server-cache.ts";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("a fresh entry is served without calling the loader again; an expired one is reloaded", async () => {
  const c = clock();
  const cache = createServerCache({ ttlMs: 1000, max: 10, now: c.now });
  let calls = 0;
  const load = async () => ++calls;
  assert.equal(await cache.get("k", load), 1);
  c.advance(999);
  assert.equal(await cache.get("k", load), 1);
  assert.equal(calls, 1);
  c.advance(1);
  assert.equal(await cache.get("k", load), 2, "at the TTL the entry is stale and reloaded");
  assert.equal(calls, 2);
});

test("concurrent requests for one key share one in-flight load", async () => {
  const cache = createServerCache({ ttlMs: 1000, max: 10 });
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const load = async () => { calls++; await gate; return "rows"; };
  const a = cache.get("k", load);
  const b = cache.get("k", load);
  release();
  assert.deepEqual(await Promise.all([a, b]), ["rows", "rows"]);
  assert.equal(calls, 1);
});

test("a rejected load is never kept: the next request retries", async () => {
  const cache = createServerCache({ ttlMs: 60_000, max: 10 });
  await assert.rejects(cache.get("k", async () => { throw new Error("statement timeout"); }), /statement timeout/);
  await new Promise((r) => setImmediate(r));
  assert.equal(cache.size(), 0);
  assert.equal(await cache.get("k", async () => "ok"), "ok");
});

test("the store is bounded and evicts the least recently used entry", async () => {
  const cache = createServerCache({ ttlMs: 60_000, max: 2 });
  let loads = 0;
  const load = (v) => async () => { loads++; return v; };
  await cache.get("a", load("a"));
  await cache.get("b", load("b"));
  await cache.get("a", load("a2"));   // hit: "a" becomes most recent
  await cache.get("c", load("c"));    // evicts "b"
  assert.equal(cache.size(), 2);
  assert.equal(await cache.get("a", load("a3")), "a");
  assert.equal(await cache.get("b", load("b2")), "b2", "b was evicted and reloaded");
  assert.equal(loads, 4);
});

test("cache identity: reviewers share one scope, everyone else is keyed on their own user and organisation", () => {
  const org = { org_type: "asl", org_code: "201" };
  assert.equal(pillarBCacheScope({ serviceRole: true, subject: "u1", org }), "reviewer:service-role");
  assert.equal(pillarBCacheScope({ serviceRole: true, subject: "u2", org: null }), "reviewer:service-role");
  const a = pillarBCacheScope({ serviceRole: false, subject: "u1", org });
  const b = pillarBCacheScope({ serviceRole: false, subject: "u2", org });
  assert.notEqual(a, b, "two RLS users never share an entry, even with the same membership");
  assert.notEqual(a, pillarBCacheScope({ serviceRole: false, subject: "u1", org: { org_type: "regione", org_code: "130" } }),
    "a change of membership is a new key");
  assert.notEqual(a, "reviewer:service-role");
  assert.equal(pillarBCacheScope({ serviceRole: false, subject: null, org }), null, "no subject: do not cache");
  assert.equal(pillarBCacheScope({ serviceRole: false, subject: "u1", org: null }), null);
});

test("keys carry the scope and the release, so a new release never reads an old entry", () => {
  const k1 = pillarBCacheKey("reviewer:service-role", "REL-1", "molecules", 2024);
  const k2 = pillarBCacheKey("reviewer:service-role", "REL-2", "molecules", 2024);
  const k3 = pillarBCacheKey("rls:u1:asl:201", "REL-1", "molecules", 2024);
  assert.notEqual(k1, k2);
  assert.notEqual(k1, k3);
  assert.equal(pillarBCacheKey("s", "r", "substances", null), "s|r|substances|-");
});

test("a load that hangs is not joined forever: after the in-flight bound the next request starts its own", async () => {
  const c = clock();
  const cache = createServerCache({ ttlMs: 600_000, max: 10, inflightMs: 1000, now: c.now });
  let calls = 0;
  const hang = () => { calls++; return new Promise(() => {}); };
  cache.get("k", hang);
  c.advance(999);
  cache.get("k", hang);
  assert.equal(calls, 1, "inside the bound the pending load is shared");
  c.advance(1);
  assert.equal(await cache.get("k", async () => { calls++; return "fresh"; }), "fresh");
  assert.equal(calls, 2);
});

test("a resolved value the caller refuses is served once and not kept", async () => {
  const cache = createServerCache({ ttlMs: 600_000, max: 10 });
  const settle = () => new Promise((r) => setImmediate(r));
  assert.equal(await cache.get("refused", async () => "rows of release B", { keep: async () => false }), "rows of release B");
  await settle();
  assert.equal(cache.size(), 0, "a release switched during the load: not kept");
  await cache.get("throws", async () => "rows", { keep: async () => { throw new Error("release lookup failed"); } });
  await settle();
  assert.equal(cache.size(), 0, "a failed check is a refusal");
  let calls = 0;
  await cache.get("kept", async () => ++calls, { keep: async () => true });
  await settle();
  assert.equal(await cache.get("kept", async () => ++calls, { keep: async () => true }), 1);
  assert.equal(calls, 1);
});

test("the RLS key carries the region code the policy selects rows by", () => {
  const base = { org_type: "regione", org_code: "130" };
  const a = pillarBCacheScope({ serviceRole: false, subject: "u1", org: { ...base, region_code: "130" } });
  const b = pillarBCacheScope({ serviceRole: false, subject: "u1", org: { ...base, region_code: "140" } });
  assert.notEqual(a, b, "a corrected region code is a new key");
  assert.match(pillarBCacheScope({ serviceRole: false, subject: "u1", org: { ...base, region_code: null } }), /:-$/);
});
