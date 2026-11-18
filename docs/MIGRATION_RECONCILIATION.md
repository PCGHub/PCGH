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
