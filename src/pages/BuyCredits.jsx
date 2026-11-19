import { useEffect, useState } from "react";
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
    if (!transaction_id || !tx_ref || params.get("status") !== "successful") return;
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
            onClick={state.reload}
          >
            Refresh Payment Status
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
                disabled={working}
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
