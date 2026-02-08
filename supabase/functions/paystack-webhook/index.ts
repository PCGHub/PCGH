import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function verifyPaystackSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = createHmac("sha512", secret).update(payload).digest("hex");
  return hash === signature;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (paystackSecret && signature) {
      const isValid = verifyPaystackSignature(rawBody, signature, paystackSecret);
      if (!isValid) {
        return jsonResponse({ error: "Invalid signature" }, 401);
      }
    }

    const event = JSON.parse(rawBody);

    if (event.event !== "charge.success") {
      return jsonResponse({ received: true });
    }

    const data = event.data;
    const reference = data.reference;
    const amountKobo = data.amount;
    const metadata = data.metadata || {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: payment } = await adminClient
      .from("payments")
      .select("*")
      .eq("provider_reference", reference)
      .maybeSingle();

    if (!payment) {
      console.error("Payment not found for reference:", reference);
      return jsonResponse({ error: "Payment not found" }, 404);
    }

    if (payment.status === "completed") {
      return jsonResponse({ received: true, already_processed: true });
    }

    const expectedAmountKobo = payment.amount_naira * 100;
    if (amountKobo < expectedAmountKobo) {
      await adminClient
        .from("payments")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return jsonResponse({ error: "Amount mismatch" }, 400);
    }

    await adminClient
      .from("payments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    const { data: userProfile } = await adminClient
      .from("users")
      .select("credits")
      .eq("id", payment.user_id)
      .maybeSingle();

    if (userProfile) {
      const currentCredits = Number(userProfile.credits) || 0;
      const newBalance = currentCredits + payment.credits_purchased;

      await adminClient
        .from("users")
        .update({ credits: newBalance })
        .eq("id", payment.user_id);

      await adminClient.from("credit_transactions").insert({
        user_id: payment.user_id,
        amount: payment.credits_purchased,
        transaction_type: "purchase",
        description: `Purchased ${payment.credits_purchased} credits (Paystack webhook verified)`,
        balance_before: currentCredits,
        balance_after: newBalance,
      });
    }

    return jsonResponse({ received: true, processed: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
