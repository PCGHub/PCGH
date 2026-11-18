# Fixed campaign economy and agreed page changes

Implemented locally; not deployed. Apply the database migration, payment handlers,
legacy edge endpoint replacement, and frontend together during a maintenance window.
Do not deploy only the new prices while the old reward endpoint is still active.

## Final rules

- One credit costs NGN 1. Packs: 500, 1,000, 2,500 credits. Custom top-ups: 100–100,000 whole credits.
- Submission reserves 500 available credits. A stable request UUID makes retries idempotent.
- Approval consumes the reservation: 300 platform fee, 200 reward pool. No second wallet debit.
- Approval unlocks 200 earning credits; unused allowance carries forward and accumulates.
- Each verified task earns 2 spendable credits; the allowance reserves 2 when a task starts.
- No self-engagement, duplicate campaign payouts, unfunded slots, or rewards exceeding allowance.
- Campaign target: 100 different verified participants. Maximum delivery window: seven days from approval.
- A task has 30 minutes to submit evidence, bounded by campaign expiry. Submitted claims can be reviewed after expiry.
- Timers and outbound link openings do not verify views or social actions. Initial task types are visits and feedback, with admin evidence review.
- At target/deadline, stop new starts, wait for outstanding claims, return unused reward credits, and close.
- Rejecting a campaign releases all 500. Task rejection releases earning allowance but awards nothing.
- Earned credits pay for future campaigns; no cash withdrawals. A member earning 200 can top up 300 for another campaign.
- New accounts start at zero credits; existing balances, legacy campaigns, and transaction records are preserved. There is no new automatic welcome-credit grant.
- Money spent on external advertising remains separate from PCGH credits.

## Eight page changes

1. Credits: aligned packs, accurate prices and campaign counts, custom top-up, balance, verified payment status, clear credit/expiry wording.
2. Dashboard: smaller wallet, allowance progress, active/pending counts, recent campaign progress, consistent campaign names.
3. Tasks: grouped by campaign, 2-credit reward, instructions/evidence, status/platform filters, reporting, no own or duplicate campaigns.
4. Submit: fixed package preview, balance/shortfall, reservation, approval and expiry explanation.
5. My Campaigns: lifecycle status, verified progress, pending settlement, transaction timeline, historical records separately.
6. Ad Planner: planning-only notice, manually tracked status/budget, expandable optional sections and platform guides, sticky form actions, unsaved close confirmation. Fake tracking links are no longer generated; old values are preserved but not advertised as functional tracking.
7. Admin: approvals, verification, community/individual/group audience distribution, settlements, reports, dated participation, wallet/audit trail, owner-recorded adjustments, suspension and owner-managed admin access. PINs are hashed and checked server-side with throttling and 30-minute elevated access.
8. Profile: validated editing, password change, available/reserved balances, clearer totals and filterable/paginated ledger with opening balances and legacy history.

Optional Telegram community card reads `VITE_TELEGRAM_COMMUNITY_URL` (an https://t.me/ URL). No destination has been supplied, so no fabricated link is shown.

## Rollout prerequisites

1. Back up the hosted database and inspect schema drift. The existing Flutterwave webhook referenced columns not present in the checked-in schema. New economy tables avoid relying on those columns, but this migration must still be exercised against a staging copy of the real project before production.

2. Apply `supabase/migrations/20261117000000_fixed_campaign_economy.sql` after the existing baseline migrations. It creates separate campaign/claim/order/ledger tables and restricts browser writes to financial and role fields. Existing profiles can only edit name and username directly.

3. Enable Supabase's pg_cron extension **before applying** the migration for minute-by-minute unattended expiry and settlement. If it is not enabled, the migration succeeds but does not install the job. Enable it and register:

   ```sql
   select cron.schedule('pcgh-campaign-maintenance', '* * * * *', 'SELECT public.campaign_maintenance()');
   ```

   Requests also run maintenance; the cron job is required for automatic closure while the site is idle. Pending verification intentionally waits for admin review; monitor that queue.

4. Deploy the replacement `supabase/functions/task-verify/index.ts` (returns 410). Remove any other deployed legacy endpoint that directly grants task rewards. Removing its browser UI alone does not disable an already deployed service-role function.

5. Stop new checkouts and reconcile any old pending Flutterwave payments before switching handlers: orders created by the previous version are not present in the new order table. Do not discard already-paid customer transactions. Deploy both Flutterwave handlers and the frontend together. Configure server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FLW_SECRET_KEY`, `FLW_WEBHOOK_SECRET_HASH` (or existing `FLW_SECRET_HASH`), and `APP_URL`. Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Never put service/payment secrets in VITE variables. Vite alone does not serve Vercel `/api` handlers.

6. Configure Flutterwave's webhook URL for `/api/payments/flutterwave/webhook`. Checkout redirects only show processing; only a successful provider verification matching a server-created order awards credits. Duplicate deliveries settle once.

7. Rotate inherited default admin PINs before launch. The migration hashes existing PINs, including any legacy default; it cannot choose a private replacement. An existing owner can update their PIN in Admin Settings. For secure server-side provisioning:

   ```sql
   -- Run with a securely supplied parameter, never paste a real PIN into committed SQL.
   update public.admin_sessions
   set pin_hash = extensions.crypt(:new_pin, extensions.gen_salt('bf')), expires_at = null
   where user_id = :admin_user_id;
   ```

8. Check the actual population of `users.is_admin` and `admin_role` before enabling access: the old application allowed broader profile writes. The migration prevents further browser escalation but does not establish whether historical roles were assigned legitimately.

9. Test a sandbox payment, campaign submission/rejection/approval, task evidence and review with different accounts, and expiry settlement in staging. Current cloud runtime has no Supabase configuration or Flutterwave credentials; no hosted transaction has been tested.

## Validation

- `npm run build`
- `npm test` (or `node --test tests/payments.test.cjs`) — authenticated checkout, server-priced amounts, signature rejection, trusted provider verification, failure responses.
- `docker run -d --name pcgh-test-db -e POSTGRES_PASSWORD=pcgh-local-test postgres:16`
- `python tests/economy_integration.py` — creates and resets only the disposable container's `pcgh_economy_test` database. Uses the checked-in core/ad schema plus relevant admin columns as a baseline; this is not proof that the project's entire historical migration chain or a drifted production database can replay unchanged.
- Start `VITE_SUPABASE_URL=https://pcgh-test.supabase.co VITE_SUPABASE_ANON_KEY=local-browser-test-only npm run dev -- --host 0.0.0.0 --port 5174 --strictPort`, then `node tests/browser-smoke.cjs`. Requires Playwright and Chromium (set `CHROMIUM_PATH` if needed). The browser test mocks Supabase transport, exercises all eight pages and task/submission flows, and checks mobile overflow. Database invariants are tested separately against real PostgreSQL.

The economy serializes writes with one transaction-scoped advisory lock. This favors correctness for launch; introduce ordered per-wallet/campaign locks and server-side result pagination when scaling. PIN session expiry is enforced by the database, not sessionStorage. Email address editing is intentionally absent; changing it requires the authentication confirmation flow rather than editing a profile row.
