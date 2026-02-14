// api/payments/flutterwave/init.js

const { fetch: undiciFetch } = require("undici");

// Define once
const PLAN_MAP = {
  starter_pack: { amount: 1000, credits: 500 },
  growth_pack: { amount: 1800, credits: 1000 },
  pro_pack: { amount: 4000, credits: 2500 },
};

// Use global fetch if available, else undici
const _fetch = globalThis.fetch || undiciFetch;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
    const APP_URL = process.env.APP_URL;

    if (!FLW_SECRET_KEY) return res.status(500).json({ error: "Missing FLW_SECRET_KEY on server" });
    if (!APP_URL) return res.status(500).json({ error: "Missing APP_URL on server" });

    const { plan, user_id, email, name } = req.body || {};
    if (!plan || !user_id || !email) {
      return res.status(400).json({ error: "Missing plan, user_id or email" });
    }

    const rule = PLAN_MAP[String(plan)];
    if (!rule) return res.status(400).json({ error: "Invalid plan" });

    const tx_ref = `pcgh_${user_id}_${Date.now()}`;

    const payload = {
      tx_ref,
      amount: rule.amount,
      currency: "NGN",
      redirect_url: `${APP_URL}/buy-credits?status=processing&tx_ref=${encodeURIComponent(tx_ref)}`,
      customer: { email, name: name || "PCGH User" },
      customizations: {
        title: "PCGH Credits",
        description: `Purchase ${rule.credits} credits (${plan})`,
      },
      meta: { user_id, plan, credits: rule.credits },
    };

    const r = await _fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error("FLW_INIT_HTTP_ERROR:", r.status, data);
      return res.status(500).json({
        error: "Flutterwave init failed",
        details: data?.message || data,
      });
    }

    const link = data?.data?.link;
    if (!link) {
      console.error("FLW_INIT_NO_LINK:", data);
      return res.status(500).json({ error: "No checkout link returned by Flutterwave" });
    }

    return res.status(200).json({ link, tx_ref });
  } catch (e) {
    console.error("FLW_INIT_ERROR:", e);
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
};
