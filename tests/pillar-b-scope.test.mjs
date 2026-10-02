import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { isReviewerEmail, reviewerEmails } from "../lib/auth/reviewer-list.ts";
import { decidePrivateScope } from "../lib/analytics/private-scope-rules.ts";
import { labelScopedOrgs } from "../lib/dashboard-review/pillar-b/scope-labels.ts";
import { aziendaKeys, parsePillarBFilters } from "../lib/dashboard-review/pillar-b/filters.ts";

// Pillar B reviewer scope: every configured reviewer, not only the first, is
// widened to the whole release and sees real names; everyone else stays where
// RLS puts them and sees pseudonyms. Addresses and Azienda names here are
// fictional: the real list lives only in REVIEWER_EMAILS, and this repository
// is public.

const THREE = ["reviewer.one@example.org", "reviewer.two@example.org", "reviewer.three@example.org"];
const NAMES = { "201": "Azienda Alfa", "202": "Azienda Beta", "203": "Azienda Gamma", "204": "Azienda Delta" };
const RELEASE = Object.entries(NAMES).map(([org_code, org_name]) => ({ org_code, org_name }));
const SCOPED = Object.entries(NAMES).map(([orgCode, label]) => ({ orgCode, aslCode: `130${orgCode}`, regionCode: "130", label }));

const withEnv = (value, fn) => {
  const had = Object.prototype.hasOwnProperty.call(process.env, "REVIEWER_EMAILS");
  const previous = process.env.REVIEWER_EMAILS;
  if (value === undefined) delete process.env.REVIEWER_EMAILS; else process.env.REVIEWER_EMAILS = value;
  try { fn(); } finally { if (had) process.env.REVIEWER_EMAILS = previous; else delete process.env.REVIEWER_EMAILS; }
};

test("all three configured reviewers are recognised, and each is widened to every Azienda by real name", () => {
  withEnv(` ${THREE[0]}, ${THREE[1].toUpperCase()} ,${THREE[2]}`, () => {
    assert.equal(reviewerEmails().size, 3);
    for (const email of THREE) {
      assert.equal(isReviewerEmail(email), true, email);
      for (const org of [null, { org_code: "201", org_name: NAMES["201"], org_type: "asl" }, { org_code: "130", org_name: "Regione", org_type: "regione" }]) {
        const d = decidePrivateScope({ isReviewer: isReviewerEmail(email), releaseOrgs: RELEASE, org, regionMembers: null });
        assert.deepEqual(d.orgCodes, ["201", "202", "203", "204"]);
        assert.equal(d.allOrganizations, true);
        assert.equal(d.showRealNames, true);
        assert.equal(d.reviewerScopeUnavailable, false);
        // End to end: the label step turns the decision into real names.
        assert.deepEqual(labelScopedOrgs(d, SCOPED).map((o) => o.label), Object.values(NAMES));
      }
    }
    assert.equal(isReviewerEmail("reviewer.four@example.org"), false, "a fourth address is not a reviewer");
  });
});

test("an ordinary Azienda account is isolated to its own rows and sees only its own name", () => {
  withEnv(THREE.join(","), () => {
    const d = decidePrivateScope({
      isReviewer: isReviewerEmail("someone@example.org"),
      releaseOrgs: RELEASE,   // even a leaked release listing cannot widen a non-reviewer
      org: { org_code: "203", org_name: NAMES["203"], org_type: "asl" },
      regionMembers: RELEASE,
    });
    assert.deepEqual(d.orgCodes, ["203"]);
    assert.equal(d.allOrganizations, false);
    assert.equal(d.showRealNames, false);
    assert.equal(d.regional, false);
    assert.deepEqual(labelScopedOrgs(d, SCOPED.filter((o) => o.orgCode === "203")).map((o) => o.label), [NAMES["203"]]);
  });
});

test("a Regione account reads its region under RLS and sees the Aziende as ASL 1-4, never by name", () => {
  withEnv(THREE.join(","), () => {
    const d = decidePrivateScope({
      isReviewer: false, releaseOrgs: null,
      org: { org_code: "130", org_name: "Regione", org_type: "regione" },
      regionMembers: RELEASE,
    });
    assert.deepEqual(d.orgCodes, ["201", "202", "203", "204"]);
    assert.equal(d.allOrganizations, false);
    assert.equal(d.showRealNames, false);
    assert.equal(d.regional, true);
    const labels = labelScopedOrgs(d, SCOPED).map((o) => o.label);
    assert.deepEqual(labels, ["ASL 1", "ASL 2", "ASL 3", "ASL 4"]);
    for (const name of Object.values(NAMES)) assert.equal(labels.includes(name), false);
  });
});

test("a pseudonymised viewer's Azienda keys carry no org code; a reviewer's do, and both round-trip", () => {
  const regione = decidePrivateScope({ isReviewer: false, releaseOrgs: null, org: { org_code: "130", org_name: "Regione", org_type: "regione" }, regionMembers: RELEASE });
  const pseudo = labelScopedOrgs(regione, SCOPED);
  const keys = aziendaKeys(pseudo, regione.showRealNames && regione.allOrganizations);
  const serialised = JSON.stringify(pseudo.map((o) => ({ key: keys.get(o.orgCode), label: o.label })));
  for (const code of ["201", "202", "203", "204", "130201", "130202", "130203", "130204"]) {
    assert.equal(serialised.includes(code), false, `the filter-bar payload carries ${code}`);
  }
  assert.deepEqual([...keys.values()], ["asl-1", "asl-2", "asl-3", "asl-4"]);
  assert.equal(parsePillarBFilters({ ambito: "asl-3" }, [...keys.values()]).asl, "asl-3");
  assert.equal(parsePillarBFilters({ ambito: "203" }, [...keys.values()]).asl, null, "a code is not accepted from a pseudonymised viewer");
  const reviewer = decidePrivateScope({ isReviewer: true, releaseOrgs: RELEASE, org: null, regionMembers: null });
  const rk = aziendaKeys(labelScopedOrgs(reviewer, SCOPED), reviewer.showRealNames && reviewer.allOrganizations);
  assert.deepEqual([...rk.values()], ["201", "202", "203", "204"]);
  // Colliding labels never fall back to a code.
  const dup = aziendaKeys([{ orgCode: "201", label: "ASL 1" }, { orgCode: "202", label: "ASL 1" }], false);
  assert.deepEqual([...dup.values()], ["asl-1", "azienda-2"]);
});

test("a reviewer whose widening failed is flagged, not shown an apparently complete one-Azienda result", () => {
  withEnv(THREE.join(","), () => {
    for (const releaseOrgs of [null, []]) {
      const d = decidePrivateScope({
        isReviewer: true, releaseOrgs,
        org: { org_code: "201", org_name: NAMES["201"], org_type: "asl" }, regionMembers: null,
      });
      assert.equal(d.allOrganizations, false);
      assert.equal(d.reviewerScopeUnavailable, true, "the page must carry the diagnostic");
      assert.deepEqual(d.orgCodes, ["201"]);
    }
    assert.equal(decidePrivateScope({ isReviewer: true, releaseOrgs: null, org: null, regionMembers: null }), null,
      "no membership and no widening: nothing is shown, rather than an empty page");
  });
});

test("the Pillar B scope resolver widens only reviewers, only server-side, and the page shows the failure", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const read = (p) => fs.readFileSync(`${root}${p}`, "utf8");
  const scope = read("lib/dashboard-review/pillar-b/scope.ts");
  assert.match(scope, /^import "server-only";/m, "scope.ts cannot be bundled for the browser");
  assert.match(scope, /const isReviewer = Boolean\(reviewerEmail\);/, "the reviewer flag comes from the session-derived email and nothing else");
  assert.match(scope, /getReviewerEmail\(\)/);
  assert.match(scope, /if \(isReviewer && hasServiceRoleConfig\(\)\) \{\s*try \{\s*admin = createServiceRoleClient\(\);/, "the service-role client is created only inside the reviewer branch");
  assert.ok(scope.includes("db: decision.allOrganizations && admin ? admin : session"), "the widened client is attached only when the widening succeeded");
  for (const code of ["PBR-WIDEN-SPEND", "PBR-WIDEN-EMPTY", "PBR-WIDEN-ORGS", "PBR-WIDEN-CONFIG", "PBR-WIDEN-CLIENT"]) {
    assert.ok(scope.includes(code), `a widening failure leaves a ${code} trace`);
  }
  assert.match(read("lib/supabase/service-role.ts"), /^import "server-only";/m, "the service-role module cannot be bundled for the browser");
  const review = read("components/dashboard-review/pillar-b-review.tsx");
  assert.match(review, /\{props\.scope\.reviewerScopeUnavailable && \(/, "the review component renders the diagnostic");
  assert.ok(review.includes("Non interpretare questa pagina come l&apos;intero rilascio"));
  const page = read("app/dashboard-review/revisione-pillar-b/page.tsx");
  assert.match(page, /reviewerScopeUnavailable: scope\.reviewerScopeUnavailable/, "the page forwards the real flag");
  assert.equal(page.includes("createServiceRoleClient"), false, "the page never builds a service-role client itself");
  const layout = read("app/dashboard-review/layout.tsx");
  assert.match(layout, /isReviewer=\{Boolean\(viewer\?\.isReviewer\)\}/, "a reviewer without a membership is told why");
});
