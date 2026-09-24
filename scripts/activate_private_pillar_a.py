"""Apply the private Pillar A migrations, import the release, and prove isolation.

Run:
    python scripts/activate_private_pillar_a.py            # inspect only, writes nothing
    python scripts/activate_private_pillar_a.py --apply    # apply DDL + import
    python scripts/activate_private_pillar_a.py --test     # isolation tests only

Requires SUPABASE_DB_URL in the environment (a Postgres connection string).
The value is never printed, logged or written to a file.

Why a direct connection rather than the service-role key: the service role
BYPASSES row level security, so it can confirm rows exist but can never show that
an ASL cannot read another ASL's rows. Isolation is the gate on activation, and
proving it needs the ability to become a specific user, which only a database
session can do. Every impersonation below happens inside a transaction that is
rolled back, so no fixture survives the run.
"""
import os, sys, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(pathlib.Path(os.environ.get("PG8000_PATH", ""))))
import pg8000.native  # noqa: E402

APPLY = "--apply" in sys.argv
TEST_ONLY = "--test" in sys.argv
RELEASE = "closure-20260923"

MIGRATIONS = [
    ("ven_mapping", ROOT / "supabase/migrations/20260924_ven_mapping.sql"),
    ("pillar_a_private_product_fact", ROOT / "supabase/migrations/20260925_private_pillar_a_product.sql"),
]

url = os.environ.get("SUPABASE_DB_URL")
if not url:
    sys.exit("Missing SUPABASE_DB_URL. Supabase -> Project Settings -> Database -> Connection string (URI).")

m = re.match(r"postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+):(\d+)/(\S+?)(?:\?.*)?$", url.strip())
if not m:
    sys.exit("SUPABASE_DB_URL is not a postgresql://user:password@host:port/database URI.")
user, password, host, port, database = m.group(1), m.group(2), m.group(3), int(m.group(4)), m.group(5)

con = pg8000.native.Connection(user=user, password=password, host=host, port=port, database=database, ssl_context=True)
print(f"connected to {host}/{database} as {user}\n")


def exists(table: str) -> bool:
    return bool(con.run("select to_regclass(:t) is not null", t=f"public.{table}")[0][0])


def report(label, rows):
    print(f"  {label}: {rows}")


# ---------------------------------------------------------------- inspect
print("== current state ==")
for table in ["organizations", "user_organizations", "pillar_a_private_fact",
              "pillar_a_private_product_fact", "ven_mapping", "canonical_fact"]:
    if exists(table):
        n = con.run(f"select count(*) from public.{table}")[0][0]
        report(table, f"exists, {n} row(s)")
    else:
        report(table, "does not exist")
print()

if not TEST_ONLY:
    # ------------------------------------------------------------ migrations
    print("== migrations ==")
    for table, path in MIGRATIONS:
        if exists(table):
            print(f"  {table}: already exists, skipping (the file is not written to be re-applied)")
            continue
        if not APPLY:
            print(f"  {table}: WOULD apply {path.name}")
            continue
        sql = path.read_text(encoding="utf-8")
        con.run(sql)
        print(f"  {table}: applied {path.name} -> exists={exists(table)}")
    print()

    # ---------------------------------------------------------------- import
    print("== release import ==")
    facts = json.loads((ROOT / "private-staging/closure/private-v2-facts.json").read_text(encoding="utf-8"))
    print(f"  payload: {len(facts)} rows")
    if not exists("pillar_a_private_fact"):
        print("  pillar_a_private_fact does not exist: nothing to import into")
    else:
        present = con.run("select count(*) from public.pillar_a_private_fact where release_id=:r", r=RELEASE)[0][0]
        if present:
            # Same guard as the generated SQL: an existing release is never overwritten.
            print(f"  release {RELEASE} already holds {present} row(s): refusing to overwrite")
        elif not APPLY:
            print(f"  WOULD insert {len(facts)} rows for release {RELEASE}")
        else:
            cols = ["release_id", "org_code", "year", "aware_category", "cf", "cmr",
                    "ddd", "activity", "activity_variant", "source_hash"]
            con.run("begin")
            for f in facts:
                con.run(
                    "insert into public.pillar_a_private_fact (" + ",".join(cols) + ") values "
                    "(:release_id,:org_code,:year,:aware_category,:cf,:cmr,:ddd,:activity,:activity_variant,:source_hash)",
                    **{c: f[c] for c in cols})
            con.run("commit")
            n = con.run("select count(*) from public.pillar_a_private_fact where release_id=:r", r=RELEASE)[0][0]
            print(f"  inserted; release now holds {n} row(s)")

    # --------------------------------------------------------- verify totals
    if exists("pillar_a_private_fact"):
        print("\n== totals ==")
        rows = con.run(
            "select org_code, year, "
            "  sum(cf) filter (where aware_category='T') as t_cf, "
            "  sum(cf) filter (where aware_category in ('A','W','R')) as parts_cf "
            "from public.pillar_a_private_fact where release_id=:r "
            "group by org_code, year order by org_code, year", r=RELEASE)
        bad = [r for r in rows if r[2] is None or abs(float(r[2]) - float(r[3] or 0)) > 0.01]
        print(f"  {len(rows)} org-year group(s); A+W+R equals T in {len(rows)-len(bad)}")
        for r in bad:
            print(f"  MISMATCH {r[0]}/{r[1]}: T={r[2]} parts={r[3]}")
    print()

# ------------------------------------------------------------- isolation
print("== isolation, every case inside a rolled-back transaction ==")
if not exists("pillar_a_private_fact"):
    print("  table does not exist yet: nothing to test")
    con.close(); sys.exit(0)

members = con.run(
    "select uo.user_id, o.org_code, o.org_type, o.region_code "
    "from public.user_organizations uo join public.organizations o on o.org_code=uo.org_code "
    "where uo.status='approved' order by o.org_type, o.org_code")
print(f"  approved memberships found: {len(members)}")

def as_user(user_id, label):
    """Count visible rows as a specific authenticated user, then roll back."""
    con.run("begin")
    try:
        con.run("set local role authenticated")
        con.run("select set_config('request.jwt.claims', :c, true)",
                c=json.dumps({"sub": str(user_id), "role": "authenticated"}))
        total = con.run("select count(*) from public.pillar_a_private_fact")[0][0]
        orgs = con.run("select distinct org_code from public.pillar_a_private_fact order by 1")
        return total, [o[0] for o in orgs]
    finally:
        con.run("rollback")

def as_anon():
    con.run("begin")
    try:
        con.run("set local role anon")
        try:
            return con.run("select count(*) from public.pillar_a_private_fact")[0][0]
        except Exception as e:  # permission denied is the correct outcome
            return f"refused ({type(e).__name__})"
    finally:
        con.run("rollback")

print(f"  anonymous                     -> {as_anon()}")

seen_types = set()
for user_id, org_code, org_type, region_code in members:
    if org_type in seen_types:
        continue
    seen_types.add(org_type)
    total, orgs = as_user(user_id, org_type)
    print(f"  approved {org_type:<8} {org_code} -> {total} row(s), org_codes {orgs}")
    if org_type == "asl" and orgs and orgs != [org_code]:
        print(f"    FAIL: an ASL account sees {orgs}, expected only {org_code}")

# A user with no membership at all, created and rolled back.
con.run("begin")
try:
    ghost = con.run("select gen_random_uuid()")[0][0]
    con.run("set local role authenticated")
    con.run("select set_config('request.jwt.claims', :c, true)",
            c=json.dumps({"sub": str(ghost), "role": "authenticated"}))
    n = con.run("select count(*) from public.pillar_a_private_fact")[0][0]
    print(f"  authenticated, no membership  -> {n} row(s)" + ("" if n == 0 else "   FAIL: expected 0"))
finally:
    con.run("rollback")

# A pending membership must not grant access. Fixture rolled back.
if members:
    con.run("begin")
    try:
        any_user, any_org = members[0][0], members[0][1]
        con.run("update public.user_organizations set status='pending' where user_id=:u and org_code=:o",
                u=any_user, o=any_org)
        con.run("set local role authenticated")
        con.run("select set_config('request.jwt.claims', :c, true)",
                c=json.dumps({"sub": str(any_user), "role": "authenticated"}))
        n = con.run("select count(*) from public.pillar_a_private_fact")[0][0]
        print(f"  pending membership            -> {n} row(s)" + ("" if n == 0 else "   FAIL: expected 0"))
    finally:
        con.run("rollback")  # the membership is restored

# A client session must not be able to write.
con.run("begin")
try:
    con.run("set local role authenticated")
    con.run("select set_config('request.jwt.claims', :c, true)",
            c=json.dumps({"sub": str(members[0][0]) if members else "00000000-0000-0000-0000-000000000000",
                          "role": "authenticated"}))
    try:
        con.run("insert into public.pillar_a_private_fact (release_id,org_code,year,aware_category,cf,cmr,ddd,activity,activity_variant,source_hash) "
                "values ('probe','201',2025,'T',1,1,1,1,'A3/T1',:h)", h="a" * 64)
        print("  authenticated INSERT          -> ALLOWED   FAIL: there must be no client write path")
    except Exception as e:
        print(f"  authenticated INSERT          -> refused ({type(e).__name__})")
finally:
    con.run("rollback")

con.close()
print("\nNothing above was left behind: every impersonation and fixture ran inside a rolled-back transaction.")
