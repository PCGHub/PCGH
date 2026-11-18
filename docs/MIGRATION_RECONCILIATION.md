# PCGH Crowd — historical migration reconciliation (staging only)

Date: 2026-11-18. Status: **blocked pending baseline rehearsal**. Target isolated staging project: `hsicgiikaemesqrdltsh`. Do not run these files on production.

## Verified findings from the checked-in migration files

1. **003 is not SQL.** `20260205225347_003_update_default_credits_and_payments_policy.sql` begins `/async function startFlutterwavePayment()` and calls the browser's `fetch`. Applying it through PostgreSQL would fail. Its name implies a credit-default and payment-policy change, but its content does not specify that change. **Do not invent an SQL replacement.**
2. **006 seeds a known plaintext PIN.** `20260206112411_006_add_admin_pin.sql` updates the owner profile to `admin_pin = '1234'`. The later fixed-economy migration hashes any non-null `admin_pin` into `admin_sessions` and nulls the old column. Hashing a known PIN does not make it safe. Staging must use a freshly provisioned non-default PIN, never 1234, and tests must assert the default is rejected.
3. **002 adds permissive legacy writes.** It allows users to insert their own `credit_transactions` and update tasks under broad predicates. The fixed-economy migration later revokes writes on protected tables, but security must be checked at the final schema and at every deployment boundary.
4. **015 permits all authenticated users to SELECT all `users` rows.** Its comment claims only usernames are public, but a row-level SELECT policy does not limit columns. The fixed-economy migration later revokes and re-grants column-level privileges and replaces user policies. Verify column access with real authenticated roles after applying the final schema.
5. **004 introduces a SECURITY DEFINER `is_admin()` helper.** Review its `search_path`, grants and callers. Do not expose privileged functions to anonymous roles without explicit reason.
6. **New fixed-economy migration is not a substitute for a full baseline test.** Prior CI used a minimal historical schema and mocked browser/payment transport.

## Update: authentic 003 recovered from Git history (2026-11-18)

The GitHub path history shows commit `95311beb16107d0069c79991cd3a82e8715d1309` ("remove paystack, switch to flutterwave frontend") overwrote migration 003. The earlier commit `6aecbb1d48a6fa892784308c53a44defbccf5146` and its later parent `c2720d573fbd8ab1a84be1c55c8d507cd0179acb` both contain the **same authentic original SQL**:

```sql
ALTER TABLE users ALTER COLUMN credits SET DEFAULT 150;

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Original source: https://github.com/PCGHub/PCGH/blob/c2720d573fbd8ab1a84be1c55c8d507cd0179acb/supabase/migrations/20260205225347_003_update_default_credits_and_payments_policy.sql

**Important:** The historic default of 150 conflicts with the new agreed **zero-credit signup** economy. The final staging schema MUST explicitly reset `public.users.credits` default to 0 and ensure no signup trigger grants welcome credits. The historic client-writable `payments` UPDATE policy is also unsafe for settlement; ensure the final schema revokes this write path. Recovering original SQL does **not** mean it is safe to deploy the legacy permissions as final state.

Do not rewrite the corrupted 003 in-place on the recovery branch: it may be recorded as applied on older hosted systems. Instead, use a separately reviewed staging bootstrap manifest that references the original historical commit and a final reconciliation migration; validate against a disposable Supabase-compatible instance before applying hosted SQL.

## Recommended non-destructive resolution

- Preserve the original 003 file and its SHA for historical audit. It is a corrupt source artifact, not an executable migration.
- Recover the intended 003 change from a trustworthy source: earlier repository commit, historical deployed migration history, or documented schema diff. If no source exists, mark its intended behavior **unknown** and decide on a documented staging-only reconciliation that is explicit about the gap; do not pretend the original ran.
- Prepare a **staging-specific manifest** listing all historical filenames, exact hashes, which files are executable, and any explicitly approved exception. Keep production migration history untouched.
- Rehearse the manifest on a disposable, Supabase-compatible database with `auth` and `extensions` schemas; assert the final schema and privileges. Fix failures in a separate reviewed remediation file, not by rewriting old applied migrations.
- Set up fresh staging admin credentials and sandbox Flutterwave keys; test direct SQL/REST role restrictions and negative payment cases.
- Only after passing the rehearsal and obtaining approval, execute against isolated staging, recording each applied step and evidence.

## Required acceptance assertions

- Invalid migration 003 cannot silently be marked applied.
- Owner/admin authentication rejects 1234 and null/empty PIN.
- Ordinary authenticated users cannot change `credits`, `is_admin`, `admin_role`, or `admin_pin` directly.
- Ordinary authenticated users cannot read another user's sensitive profile columns.
- Anon users cannot execute privileged campaign/admin/settlement RPCs.
- Group-only campaigns reject users with null `pod_id`.
- Payments cannot credit without provider verification, and repeated webhooks are idempotent.

## Execution log

- Staging project created and verified active; PostgreSQL 17.12, initially zero public tables and zero migrations.
- All 16 checked-in migration files enumerated; key security-relevant files 002, 004–008, 012–015 and 20261117 inspected.
- **No hosted migrations or data changes performed during this audit.**

## Hosted staging execution log — 2026-11-18

User authorized proceeding with staging migration rehearsal. Applied successfully to **isolated staging** `hsicgiikaemesqrdltsh`: historical 001, 002; recovered authentic 003 from Git commit `c2720d573fbd8ab1a84be1c55c8d507cd0179acb`; historical 004, 005; a **staging-safe 006** containing only `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS admin_pin text DEFAULT NULL` (the checked-in 006 was blocked because it sets a known plaintext PIN); historical 007, 008, 009, 010, 011. Every applied step returned success. Public tables now: users, links, tasks, task_completions, credit_transactions, user_pods, pod_rotations, payments, task_attempts, ad_campaigns, ad_campaign_metrics (all RLS enabled, all 0 rows).

**Stopped at historical 012** (`20260207113346_012_fix_performance_and_security_issues.sql`) after the migration engine returned `42P01: relation \"public.ad_creatives\" does not exist`. The 011 migration creates `ad_campaigns` and `ad_campaign_metrics` but does not create `ad_creatives`; 012 assumes the latter already exists. Do not fabricate its structure or mark 012 applied. Migrations 012–015 and the 20261117 fixed-economy migration have **not** been applied. No application is connected to this staging database yet. Until the final economy migration is applied, the historical 150-credit default and legacy RLS remain; staging must not be opened to testers or connected to payment endpoints.

**Next:** Search repository history for the missing `ad_creatives` schema and its authentic creation migration; reconcile the 011/012 mismatch. Only then continue the ordered migrations and verify final zero-credit signup, profile restrictions, admin PIN security, payment and ledger rules. No production changes.

## Missing ad_creatives investigation — 2026-11-18

Inspected the complete recovery-branch repository tree (commit `86a89529aeaa9b65fd06f3f38fbb7dca7213761c`) and the GitHub history for migration 011. Migration 011 has only the initial-copy commit `6aecbb1d48a6fa892784308c53a44defbccf5146`, and creates `ad_campaigns` and `ad_campaign_metrics`, **not** `ad_creatives`. The frontend `src/pages/AdsManager.jsx` does not reference `ad_creatives`. Historical migrations 012–015 each reference this absent table in RLS policies. No trustworthy CREATE TABLE definition was located in the checked-in migrations. GitHub code search returned incomplete results, so absence across all history cannot be asserted.

**Resolution decision:** Do **not** invent a schema for `ad_creatives` merely to make migrations pass. The next safe change is a reviewed staging-specific baseline patch that omits only the dead `ad_creatives` policy blocks in 012–015, while retaining the rest of each migration and preserving the original source SQL unchanged. This needs an exact block-by-block diff, a dry-run and role-level security tests. No hosted migration 012 or later has been applied.

## Hosted staging migration completion — 2026-11-18

**Applied successfully to isolated staging** `hsicgiikaemesqrdltsh`:
- Staging-reconciled historical 012–015, omitting orphan `ad_creatives` policy blocks and making trigger recreation safe. Exact combined SQL committed as `docs/staging-reconciled-012-015.sql` on the recovery branch. Each migration returned success.
- Original `20261117000000_fixed_campaign_economy.sql` returned success.
- Final staging-only reconciliation migration `staging_final_zero_welcome_and_payment_lockdown` returned success, with SQL:
```sql
ALTER TABLE public.users ALTER COLUMN credits SET DEFAULT 0;
DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
```

Read-only verification returned **18 public tables**, **0 user rows**, signup `users.credits` default **0**, and **0 payments write policies**. Privilege checks: `authenticated` payment INSERT false, UPDATE false; `anon` campaign_action EXECUTE false; `authenticated` settle_credit_order EXECUTE false.

**Not yet validated:** real authenticated RLS session tests, null/default PIN and pod bypass tests, migration equivalence to production, webhook sandbox idempotency, frontend connection, staging auth configuration, full end-to-end smoke tests, pg_cron maintenance scheduling. Do not mark staging ready for real testers or production promotion yet. Production untouched.

## Staging acceptance security preflight — 2026-11-18

Verified **17 applied migrations** prior to this preflight (including reconciled history and final zero-credit/payment-lockdown migration). Supabase health advisor returned no findings. Security advisor identified four anonymously executable SECURITY DEFINER functions: `expire_stale_links()`, `is_admin()`, `update_ad_campaign_updated_at()`, `update_updated_at_column()`.

Applied staging migration `staging_restrict_legacy_security_definer_rpc`: revoked PUBLIC/anon/authenticated execution on expire_stale_links and both trigger functions; revoked PUBLIC/anon on is_admin and retained authenticated execute because legacy RLS uses it. Verified role privileges via `has_function_privilege`: anon false for all four; authenticated false for maintenance/trigger functions, true for is_admin. Subsequent security advisor no longer flags anonymous SECURITY DEFINER functions. Remaining warnings are four authenticated-executable functions (`campaign_action`, `campaign_admin`, `campaign_progress`, `is_admin`), requiring function-body authorization testing. One INFO: `admin_sessions` has RLS with no policies (intentional deny-by-default; verify service-side access).

Supabase security lint references: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable.

**Next acceptance tasks:** role-impersonated SQL/REST tests, signup with zero credits, admin PIN null/default rejection, pod eligibility bypass, campaign credit conservation and refunds, Flutterwave sandbox webhook idempotency, frontend preview integration. No claim of end-to-end readiness.
