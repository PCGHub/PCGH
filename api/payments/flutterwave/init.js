module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
    const APP_URL = process.env.APP_URL;

    if (!FLW_SECRET_KEY) return res.status(500).json({ error: "Missing FLW_SECRET_KEY on server" });
    if (!APP_URL) return res.status(500).json({ error: "Missing APP_URL on server" });

    const { plan, user_id, email, name } = req.body || {};
    if (!plan || !user_id || !email) {
      return res.status(400).json({ error: "Missing plan, user_id or email" });
    }

    const PLAN_MAP = {
  starter_pack: { amount: 1000, credits: 500 },
  growth_pack: { amount: 1800, credits: 1000 },
  pro_pack: { amount: 4000, credits: 2500 },
};

    const tx_ref = `pcgh_${user_id}_${Date.now()}`;

    const payload = {
      tx_ref,
      amount: rule.amount,
      currency: "NGN",
      redirect_url: `${APP_URL}/payments/flutterwave/callback`,
      customer: { email, name: name || email },
      meta: { user_id, plan, credits: rule.credits },
      customizations: {
        title: "PCGH Credits",
        description: `Purchase ${rule.credits} credits`,
      },
    };

    const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
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
    console.error("Init error:", e);
    return res.status(500).json({ error: "Server error", details: String(e?.stack || e) });
  }
};
