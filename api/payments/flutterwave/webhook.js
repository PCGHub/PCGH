// api/payments/flutterwave/webhook.js

const { createClient } = require("@supabase/supabase-js");

const PLAN_MAP = {
  starter_pack: { amount: 1000, credits: 500 },
  growth_pack: { amount: 1800, credits: 1000 },
  pro_pack: { amount: 4000, credits: 2500 },
};

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function getIncomingHash(req) {
  return (
    req.headers["verif-hash"] ||
    req.headers["Verif-Hash"] ||
    req.headers["x-verif-hash"] ||
    req.headers["X-Verif-Hash"]
  );
}

function getSecretHash() {
  return process.env.FLW_WEBHOOK_SECRET_HASH || process.env.FLW_SECRET_HASH;
}

function parseUserIdFromTxRef(tx_ref) {
  // tx_ref format: pcgh_<userId>_<timestamp>
  if (!tx_ref || typeof tx_ref !== "string") return null;
  const parts = tx_ref.split("_");
  if (parts.length < 3) return null;
  if (parts[0] !== "pcgh") return null;
  return parts[1] || null;
}

async function flwVerify(txId) {
  const key = process.env.FLW_SECRET_KEY;
  if (!key) throw new Error("Missing FLW_SECRET_KEY");

  const r = await fetch(`https://api.flutterwave.com/v3/transactions/${txId}/verify`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });

  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.message || "Flutterwave verify failed");
  return json?.data;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    console.log("WEBHOOK HIT ✅", new Date().toISOString());
    console.log("HEADERS ✅", JSON.stringify(req.headers));
    console.log("BODY ✅", JSON.stringify(req.body));

    // 1) verify webhook signature
    const incomingHash = getIncomingHash(req);
    const secretHash = getSecretHash();

    if (!incomingHash || !secretHash || incomingHash !== secretHash) {
      console.log("WEBHOOK REJECTED ❌ signature mismatch", {
        incomingHashPresent: !!incomingHash,
        secretHashPresent: !!secretHash,
      });
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const body = req.body || {};
    const data = body.data || {};

    const txId = data.id;
    const txRef = data.tx_ref;

    if (!txId) return res.status(200).json({ ok: true, ignored: "missing tx id" });

    // 2) Verify transaction via Flutterwave API (source of truth)
    const verified = await flwVerify(txId);

    const status = String(verified?.status || data?.status || "").toLowerCase();
    const amount = Number(verified?.amount ?? data?.amount ?? 0);
    const currency = String(verified?.currency || data?.currency || "");
    const vTxRef = verified?.tx_ref || txRef;

    if (status !== "successful") return res.status(200).json({ ok: true, ignored: "not successful" });
    if (currency !== "NGN") return res.status(200).json({ ok: true, ignored: "currency mismatch" });

    // 3) meta extraction (Flutterwave sends meta_data in your logs)
    const meta = verified?.meta || verified?.meta_data || body?.meta_data || data?.meta_data || data?.meta || {};

    const plan = meta.plan;
    let user_id = meta.user_id || meta.userId || null;
    if (!user_id) user_id = parseUserIdFromTxRef(vTxRef);

    if (!user_id) return res.status(200).json({ ok: true, ignored: "missing user_id" });
    if (!plan || !PLAN_MAP[String(plan)]) return res.status(200).json({ ok: true, ignored: "invalid plan" });

    const rule = PLAN_MAP[String(plan)];

    if (amount < Number(rule.amount)) return res.status(200).json({ ok: true, ignored: "amount mismatch" });

    const sb = getSupabaseAdmin();

    // 4) Insert credit transaction (ONLY required columns to satisfy DB constraints)
    const reference = `flw:${txId}`;

    const { error: insErr } = await sb.from("credit_transactions").insert({
      user_id,
      reference,
      credits: rule.credits,
      amount,
      transaction_type: "credit_purchase", // ✅ REQUIRED by your DB (NOT NULL)
    });

    if (insErr) {
      const msg = String(insErr.message || "").toLowerCase();
      if (msg.includes("duplicate")) {
        console.log("ALREADY CREDITED ⚠️", reference);
        return res.status(200).json({ ok: true, duplicate: true });
      }
      console.log("credit_transactions insert error ❌", insErr);
      return res.status(500).json({ error: "Failed to insert credit transaction", details: insErr.message });
    }

    // 5) Update users.credits
    const { data: userRow, error: selErr } = await sb
      .from("users")
      .select("credits")
      .eq("id", user_id)
      .maybeSingle();

    if (selErr) {
      console.log("users select error ❌", selErr);
      return res.status(500).json({ error: "Failed to read user credits", details: selErr.message });
    }

    const before = Number(userRow?.credits || 0);
    const after = before + Number(rule.credits || 0);

    const { error: updErr } = await sb.from("users").update({ credits: after }).eq("id", user_id);

    if (updErr) {
      console.log("users update error ❌", updErr);
      return res.status(500).json({ error: "Failed to update credits", details: updErr.message });
    }

    console.log("CREDITED ✅", { user_id, before, after, added: rule.credits, txId, reference });

    return res.status(200).json({ ok: true, user_id, before, after, added: rule.credits, reference });
  } catch (e) {
    console.log("WEBHOOK ERROR ❌", e);
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
};
