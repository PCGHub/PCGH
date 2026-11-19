const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("node:crypto");

const PLANS = {
  starter_pack: 500,
  growth_pack: 1000,
  pro_pack: 2500,
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      FLW_SECRET_KEY,
      APP_URL,
    } = process.env;

    if (
      ![
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        FLW_SECRET_KEY,
        APP_URL,
      ].every(Boolean)
    ) {
      return res.status(503).json({
        error: "Checkout is not configured",
      });
    }

    // Staging must never fall back to a shared production service-role key.
    const isStaging = new URL(SUPABASE_URL).hostname === "hsicgiikaemesqrdltsh.supabase.co";
    const backendKey = isStaging
      ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
      : SUPABASE_SERVICE_ROLE_KEY;
    if (!backendKey || (isStaging && (!process.env.STAGING_FLW_SECRET_KEY || !process.env.STAGING_APP_URL))) {
      return res.status(503).json({ error: "Staging checkout is not configured" });
    }
    const paymentKey = isStaging ? process.env.STAGING_FLW_SECRET_KEY : FLW_SECRET_KEY;
    const returnUrl = isStaging ? process.env.STAGING_APP_URL : APP_URL;

    const sb = createClient(
      SUPABASE_URL,
      backendKey,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const token = (req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );

    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: "Sign in to purchase credits",
      });
    }

    const { plan, credits: custom } = req.body || {};

    const credits =
      plan === "custom" ? Number(custom) : PLANS[plan];

    if (
      !Number.isInteger(credits) ||
      credits < 100 ||
      credits > 100000
    ) {
      return res.status(400).json({
        error: "Choose 100–100,000 whole credits",
      });
    }

    const {
      data: profile,
      error: profileError,
    } = await sb
      .from("users")
      .select("is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_active) {
      return res.status(403).json({
        error: "An active member profile is required",
      });
    }

    const tx_ref = `pcgh_${randomUUID()}`;

    const { error } = await sb.from("credit_orders").insert({
      reference: tx_ref,
      user_id: user.id,
      credits,
      amount_naira: credits,
    });

    if (error) {
      throw error;
    }

    const response = await fetch(
      "https://api.flutterwave.com/v3/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paymentKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref,
          amount: credits,
          currency: "NGN",
          redirect_url: `${returnUrl}/buy-credits?status=processing`,
          customer: {
            email: user.email,
          },
          customizations: {
            title: "PCGH Credits",
            description: `Purchase ${credits} credits`,
          },
        }),
      },
    );

    const json = await response.json();

    if (!response.ok || !json?.data?.link) {
      throw new Error("Payment provider unavailable");
    }

    return res.status(200).json({
      link: json.data.link,
      tx_ref,
    });
  } catch (error) {
    console.error(
      "Checkout initialization failed:",
      error.message,
    );

    return res.status(502).json({
      error: "Unable to initialize checkout. Please try again.",
    });
  }
};
