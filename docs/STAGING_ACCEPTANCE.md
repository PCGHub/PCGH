# PCGH Crowd — isolated staging acceptance gate

Status: **prepared, not executed**. Do not point these steps at the production PCGH Supabase project or live Flutterwave credentials.

## Discovered baseline migration blocker (2026-11-18)

**Do not apply the checked-in migrations as an uninterrupted sequence.** The historical file `supabase/migrations/20260205225347_003_update_default_credits_and_payments_policy.sql` contains JavaScript (`/async function startFlutterwavePayment()`) rather than SQL. It is not a valid PostgreSQL migration. The successful disposable PostgreSQL test intentionally loads only migration 001, migration 011, and the new fixed-economy migration, with an ad hoc admin-column bridge; therefore it does **not** certify the full historical 001–015 chain.

Before staging DDL, prepare a reviewed baseline reconciliation: document the actual intended historical schema changes for 003, decide how to quarantine the invalid historical artifact without rewriting production history, inspect all migrations 001–015 for dependency and RLS conflicts, and test the exact planned sequence on a disposable Supabase-compatible database. Never silently skip 003 while recording it as applied; never replace it with invented SQL. Obtain a fresh approval for the resolved staging migration plan.

Current new staging project: `hsicgiikaemesqrdltsh` (`PCGH Crowd - Staging`), initially 0 public tables and 0 migrations, PostgreSQL 17.12. **No hosted SQL applied during this discovery.**

## Environment identity and approval
- [ ] Record the staging Supabase project name, ref, organization, and region; confirm it is NOT the production project.
- [ ] Record staging Vercel project or Preview deployment URL; verify it uses the recovery branch.
- [ ] Confirm separate Flutterwave **test-mode** keys and webhook secret; no live transactions.
- [ ] Confirm staging users and data are synthetic. Never copy production auth tokens, credentials, payment secrets, or sensitive user data.
- [ ] Obtain approval for staging schema writes after reviewing preflight and a backup/recovery plan.
- [ ] Keep `main`, production Supabase, and production Flutterwave unchanged.

## Read-only preflight (before any hosted SQL)
1. Capture current migration history, PostgreSQL version, installed extensions and scheduled jobs.
2. Compare existing `users`, `links`, `ad_campaigns`, admin fields, grants, policies, and auth triggers to the migration assumptions.
3. Verify that no fixed-economy migration objects already exist, or document drift/conflicts.
4. Verify a recoverable staging snapshot/backup and document restore rehearsal.
5. Audit privileged `SECURITY DEFINER` functions, `EXECUTE` grants, and Data API/RLS exposure.
6. Inspect the recovered SQL migration for replay safety, unexpected data rewrites, and constraints. **Do not assume passing the disposable PostgreSQL test proves compatibility with the hosted schema.**

## Controlled staging setup (only after explicit approval)
1. Apply the recovery migration to the **isolated staging project only**, with SQL error-stop and migration history recorded.
2. Configure staging environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FLW_SECRET_KEY`, `FLW_WEBHOOK_SECRET_HASH`, `APP_URL`. Store server-only keys in encrypted platform settings; never put them in `VITE_` variables or Git.
3. Configure Supabase Auth staging Site URL and allowlisted redirect URLs. Configure Flutterwave test-mode webhook to staging `/api/payments/flutterwave/webhook`.
4. Enable/verify `pg_cron` and the campaign maintenance schedule separately if supported; ensure only one active schedule.
5. Deploy only a staging Preview using the recovery branch; do not promote to production.

## Staging acceptance scenarios
- [ ] New registration, email verification, sign-in, sign-out, password reset, zero welcome balance.
- [ ] Existing-account balance and historical records remain intact in a *synthetic representative* fixture.
- [ ] Purchase 500 test credits; payment pending until provider verification; successful webhook credits once; duplicate webhook credits zero additional; failed/tampered callbacks credit nothing.
- [ ] Campaign submit reserves exactly 500 credits; retry with same request ID does not double reserve.
- [ ] Admin PIN missing, null, empty, incorrect, lockout, expiry, and valid PIN; non-admin cannot elevate.
- [ ] Admin rejection releases 500; approval charges 300 fee + funds 200 reward pool, unlocks 200 earning allowance.
- [ ] Community, individual, and group distribution; user with null `pod_id` is denied group-only campaigns; RLS denies cross-user reads.
- [ ] Own campaign and duplicate claim denied; 30-minute evidence deadline enforced.
- [ ] Exactly 2 credits for each approved verified task; rejection awards zero; 100 unique verified completions maximum.
- [ ] Seven-day expiry, pending evidence review, settlement/refund idempotency, background maintenance.
- [ ] Suspended accounts denied, profile edit restricted, direct browser writes to balances/roles rejected.
- [ ] Browser/mobile navigation, ad planner, campaign list, and admin audit views.

## Stop / rollback gates
- Stop on unexpected hosted schema drift, incorrect ledger conservation, RLS privilege escalation, unexpected payment credit, or missing audit trail.
- Do not retry a partially applied migration blindly. Diagnose, restore from the documented staging backup if necessary, and reconcile migration history.
- Do not merge into `main` or deploy production without a separate explicit decision after the staging acceptance report.

## Evidence to retain
Staging project ref (non-secret), Preview URL, migration SHA, schema diff, redacted test logs, pass/fail counts, payment provider test references, rollback evidence, and unresolved risks.

Automated baseline: [GitHub Actions recovery validation #2](https://github.com/PCGHub/PCGH/actions/runs/44372000392) — three jobs passed, but mocked browser transport and disposable PostgreSQL do not establish hosted staging readiness.
