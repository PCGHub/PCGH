export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const PLAN_MAP = { pro_pack: { amount: 4000, credits: 2500 } };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const hash = req.headers["verif-hash"];
    if (!hash || hash !== process.env.FLW_WEBHOOK_SECRET_HASH) {
      return res.status(401).json({ error: "Invalid webhook hash" });
    }

    if (!process.env.FLW_SECRET_KEY) {
      return res.status(500).json({ error: "Missing FLW_SECRET_KEY on server" });
    }

    const txId = req.body?.data?.id;
    if (!txId) return res.status(200).json({ ok: true });

    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${txId}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    });

    const verifyJson = await verifyRes.json().catch(() => ({}));
    const v = verifyJson?.data;

    if (!verifyRes.ok || !v) {
      return res.status(400).json({ error: "Verification failed", details: verifyJson });
    }

    const { status, currency } = v;
    const amount = Number(v.amount || 0);
    const meta = v.meta || {};
    const user_id = meta.user_id;
    const plan = meta.plan;

    await supabase.from("payments").upsert(
      {
        provider: "flutterwave",
        provider_reference: String(txId),
        user_id,
        amount,
        currency,
        status,
        raw: verifyJson,
      },
      { onConflict: "provider,provider_reference" }
    );

    if (status !== "successful" || currency !== "NGN" || !user_id) {
      return res.status(200).json({ ok: true });
    }

    const rule = PLAN_MAP[String(plan)];
    if (!rule || rule.amount !== amount) {
      return res.status(200).json({ ok: true });
    }

    const reference = `flw:${txId}`;

    const creditRes = await supabase.from("credit_transactions").insert({
      user_id,
      reference,
      amount: rule.credits,
      type: "topup",
      note: `Flutterwave topup: ${plan}`,
    });

    return res.status(200).json({ ok: true, credited: !creditRes.error });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.stack || e) });
  }
}
