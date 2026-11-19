const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const url = process.env.SUPABASE_URL;
    const isStaging = new URL(url).hostname === "hsicgiikaemesqrdltsh.supabase.co";
    const backendKey = isStaging ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
    const paymentKey = isStaging ? process.env.STAGING_FLW_SECRET_KEY : process.env.FLW_SECRET_KEY;
    if (!backendKey || !paymentKey) return res.status(503).json({ error: "Payment verification unavailable" });
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    if (!token) return res.status(401).json({ error: "Sign in required" });
    const sb = createClient(url, backendKey, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Sign in required" });
    const id = String(req.body?.transaction_id || "");
    const reference = String(req.body?.tx_ref || "");
    if (!/^\d{1,30}$/.test(id) || !/^pcgh_[0-9a-f-]{36}$/.test(reference)) {
      return res.status(400).json({ error: "Invalid transaction details" });
    }
    const { data: order, error: orderError } = await sb.from("credit_orders")
      .select("reference,user_id,status,amount_naira").eq("reference", reference).eq("user_id", user.id).maybeSingle();
    if (orderError || !order) return res.status(404).json({ error: "Payment order not found" });
    if (order.status === "completed") return res.status(200).json({ completed: true, duplicate: true });
    const provider = await fetch("https://api.flutterwave.com/v3/transactions/" + id + "/verify", {
      headers: { Authorization: "Bearer " + paymentKey }
    });
    if (!provider.ok) return res.status(502).json({ error: "Provider verification unavailable" });
    const result = await provider.json();
    const data = result?.data;
    if (data?.status !== "successful" || data?.tx_ref !== reference ||
        data?.currency !== "NGN" || Number(data?.amount) !== Number(order.amount_naira) ||
        String(data?.id) !== id) {
      return res.status(409).json({ error: "Payment has not been verified" });
    }
    const { error: settleError } = await sb.rpc("settle_credit_order", {
      p_reference: reference, p_provider_id: id,
      p_amount: Number(data.amount), p_currency: data.currency
    });
    if (settleError) throw settleError;
    return res.status(200).json({ completed: true });
  } catch (_) {
    console.error("Payment confirmation failed (details withheld)");
    return res.status(500).json({ error: "Payment verification failed; try again later" });
  }
};
