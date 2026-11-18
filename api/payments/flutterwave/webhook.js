const { createClient } = require("@supabase/supabase-js");
const { timingSafeEqual } = require("node:crypto");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const secret =
      process.env.FLW_WEBHOOK_SECRET_HASH ||
      process.env.FLW_SECRET_HASH;

    const signature = req.headers["verif-hash"];

    if (
      typeof secret !== "string" ||
      typeof signature !== "string" ||
      Buffer.byteLength(secret) !== Buffer.byteLength(signature) ||
      !timingSafeEqual(
        Buffer.from(secret),
        Buffer.from(signature),
      )
    ) {
      return res.status(401).json({
        error: "Invalid webhook signature",
      });
    }

    const id = req.body?.data?.id;

    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({
        error: "Invalid transaction identifier",
      });
    }

    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Provider verification unavailable");
    }

    const { data } = await response.json();

    if (data?.status !== "successful") {
      return res.status(200).json({
        ignored: true,
      });
    }

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const {
      data: result,
      error,
    } = await sb.rpc("settle_credit_order", {
      p_reference: data.tx_ref,
      p_provider_id: String(id),
      p_amount: Number(data.amount),
      p_currency: data.currency,
    });

    if (error) {
      throw error;
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Payment settlement failed:",
      error.message,
    );

    return res.status(500).json({
      error: "Payment settlement failed; retry required",
    });
  }
};
