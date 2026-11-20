import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { member, rows } from "../lib/campaigns";
import { number } from "../lib/economy";
import { initFlutterwavePayment, confirmFlutterwavePayment } from "../lib/flutterwave";
import {
  Page,
  Card,
  Button,
  Field,
  useLoad,
} from "../components/CampaignUI";

const packs = [
  {
    name: "Starter",
    credits: 500,
    plan: "starter_pack",
  },
  {
    name: "Growth",
    credits: 1000,
    plan: "growth_pack",
  },
  {
    name: "Pro",
    credits: 2500,
    plan: "pro_pack",
  },
];

export default function BuyCredits() {
  const state = useLoad(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Your sign-in session is missing or expired. Sign in again to purchase credits.");
    const u = await member();

    return {
      u,
      orders: await rows("credit_orders", (q) =>
        q
          .eq("user_id", u.id)
          .order("created_at", {
            ascending: false,
          }),
      ),
    };
  });

  const [working, setWorking] = useState(false);
  const [custom, setCustom] = useState(300);
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const transaction_id = params.get("transaction_id");
    const tx_ref = params.get("tx_ref");
    // Flutterwave may append its own status to a redirect URL that already has status=processing.
    // Confirm whenever both identifiers are present; the server verifies provider status.
    if (!transaction_id || !tx_ref) return;
    let cancelled = false;
    setConfirmation("Verifying your payment securely…");
    confirmFlutterwavePayment({ transaction_id, tx_ref })
      .then(() => {
        if (cancelled) return;
        setConfirmation("Payment confirmed. Credits have been added.");
        state.reload();
      })
      .catch(() => {
        if (!cancelled) setConfirmation("Payment confirmation is pending. Do not pay again; contact support with your transaction reference.");
      });
    return () => { cancelled = true; };
  }, []);

  async function retryConfirmation() {
    const params = new URLSearchParams(window.location.search);
    const transaction_id = params.get("transaction_id");
    const tx_ref = params.get("tx_ref");
    if (!transaction_id || !tx_ref) {
      setConfirmation("No payment reference was returned. Please contact support with your transaction reference.");
      return;
    }
    setConfirmation("Verifying your payment securely…");
    try {
      await confirmFlutterwavePayment({ transaction_id, tx_ref });
      setConfirmation("Payment confirmed. Credits have been added.");
      await state.reload();
    } catch (error) {
      setConfirmation(error.message || "Payment confirmation is pending. Do not pay again.");
    }
  }

  async function purchase(plan, credits) {
    if (working) {
      return;
    }

    setWorking(true);
    state.setError("");

    try {
      const { link } = await initFlutterwavePayment({
        plan,
        credits,
      });

      window.location.assign(link);
    } catch (e) {
      state.setError(e.message);
      setWorking(false);
    }
  }

  return (
    <Page
      title="Fund your next campaign"
      description="₦1 buys 1 credit. Each campaign costs 500 credits."
      {...state}
    >
      {state.error && /sign.in|session|auth|jwt|token/i.test(state.error) && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="font-semibold text-amber-900">Your account session needs to be refreshed before checkout.</p>
          <p className="mt-2 text-sm text-amber-800">Do not pay again until your account balance loads correctly.</p>
          <div className="mt-4 flex flex-wrap gap-3"><Button secondary onClick={state.reload}>Retry session</Button><Link to="/login" className="rounded-xl bg-emerald-700 px-4 py-2.5 font-medium text-white">Sign in again</Link></div>
        </Card>
      )}
      {state.data && (
        <Card>
          <p>
            Available balance:{" "}
            <strong>
              {number(state.data.u.credits)} credits
            </strong>
            {" "}·{" "}
            {number(state.data.u.reserved_credits)}
            {" "}reserved
          </p>
        </Card>
      )}

      {confirmation && (
        <Card>
          <p role="status">{confirmation}</p>
        </Card>
      )}

      {new URLSearchParams(
        window.location.search,
      ).get("status") && (
        <Card>
          <p role="status">
            Your payment is being checked. Credits
            are added only after server verification.
          </p>

          <Button
            secondary
            onClick={retryConfirmation}
          >
            Verify Payment Again
          </Button>
          <Button secondary onClick={state.reload}>
            Refresh Balance
          </Button>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {packs.map((p, i) => (
          <Card
            key={p.plan}
            className={`flex flex-col ${
              i === 1
                ? "border-emerald-600 ring-2 ring-emerald-100"
                : ""
            }`}
          >
            <div className="h-7">
              {i === 1 && (
                <span className="text-emerald-800 bg-emerald-50 rounded-full px-3 py-1 text-xs font-bold">
                  RECOMMENDED
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold mt-4">
              {p.name} Pack
            </h2>

            <p className="text-4xl font-bold mt-4">
              ₦{number(p.credits)}
            </p>

            <p className="text-gray-600 my-3">
              {number(p.credits)} credits
            </p>

            <ul className="space-y-3 text-sm text-gray-600 mb-6">
              <li>
                Submit {p.credits / 500} campaign
                {p.credits > 500 ? "s" : ""}
              </li>

              <li>
                Credits added after payment confirmation
              </li>

              <li>
                Purchased credits don’t expire
              </li>
            </ul>

            <div className="mt-auto">
              <Button
                disabled={working || !state.data || !!state.error}
                onClick={() => purchase(p.plan)}
              >
                {working
                  ? "Opening checkout…"
                  : `Pay ₦${number(p.credits)}`}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            purchase("custom", Number(custom));
          }}
        >
          <h2 className="font-bold text-xl">
            Top up exactly what you need
          </h2>

          <p>
            Have 200 earned credits? Buy 300 more
            for your next campaign.
          </p>

          <Field label="Credits to buy (100–100,000)">
            <input
              type="number"
              min={100}
              max={100000}
              step={1}
              required
              value={custom}
              onChange={(e) =>
                setCustom(e.target.value)
              }
            />
          </Field>

          <Button
            disabled={
              working ||
              !state.data || !!state.error ||
              !Number.isInteger(Number(custom)) ||
              Number(custom) < 100 ||
              Number(custom) > 100000
            }
          >
            Pay ₦{number(custom)}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-bold">
          How campaign credits work
        </h2>

        <p className="mt-2">
          500 credits = 300 platform fee + 200
          engagement reward pool. Campaigns target
          100 unique verified completions and run
          for up to seven days after approval.
        </p>

        <p className="mt-2 text-gray-600">
          Each approved campaign unlocks up to 200
          credits of earning allowance. Complete
          eligible tasks at 2 credits each to earn
          toward your next campaign. Earned credits
          are for platform use, not cash withdrawals.
          Unused campaign reward credits are returned
          after settlement.
        </p>
      </Card>

      {state.data?.orders.length > 0 && (
        <Card>
          <h2 className="font-bold">
            Recent checkout status
          </h2>

          {state.data.orders
            .slice(0, 5)
            .map((o) => (
              <p
                className="border-t py-3 mt-2"
                key={o.reference}
              >
                ₦{number(o.amount_naira)}
                {" "}→{" "}
                {number(o.credits)} credits
                {" "}·{" "}
                {o.status === "completed"
                  ? "Payment confirmed"
                  : "Awaiting confirmation"}
              </p>
            ))}
        </Card>
      )}
    </Page>
  );
}
