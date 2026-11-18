import { supabase } from "./supabase";

export async function initFlutterwavePayment({
  plan,
  credits,
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Please sign in");
  }

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL || ""}/api/payments/flutterwave/init`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        plan,
        credits,
      }),
    },
  );

  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json.link) {
    throw new Error(
      json.error || "Checkout unavailable",
    );
  }

  return json;
}
