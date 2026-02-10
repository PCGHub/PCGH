if (!process.env.FLW_SECRET_KEY) {
  return res.status(500).json({ error: "Missing FLW_SECRET_KEY on server" });
}
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.FLW_SECRET_KEY) {
      return res.status(500).json({ error: "Missing FLW_SECRET_KEY on server" });
    }
    if (!process.env.APP_URL) {
      return res.status(500).json({ error: "Missing APP_URL on server" });
    }

    const { plan, user_id, email, name } = req.body || {};
    if (!plan || !user_id || !email) {
      return res.status(400).json({ error: "Missing plan, user_id or email" });
    }

    const PLAN_MAP = { pro_pack: { amount: 4000, credits: 2500 } };
    if (!PLAN_MAP[plan]) return res.status(400).json({ error: "Invalid plan" });

    const { amount, credits } = PLAN_MAP[plan];
    const tx_ref = `pcgh_${user_id}_${Date.now()}`;

    const payload = {
      tx_ref,
      amount,
      currency: "NGN",
      redirect_url: `${process.env.APP_URL}/payments/flutterwave/callback`,
      customer: { email, name: name || email },
      meta: { user_id, plan, credits },
      customizations: { title: "PCGH Credits", description: `Purchase ${credits} credits` },
    };

    const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await flwRes.json().catch(() => ({}));

    if (!flwRes.ok) {
      return res.status(400).json({ error: "Flutterwave init failed", details: json });
    }

    return res.status(200).json({ link: json?.data?.link, tx_ref });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.stack || e) });
  }
}
