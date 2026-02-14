// src/lib/flutterwave.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function initFlutterwavePayment({ plan, user_id, email, name }) {
  const url = `${API_BASE}/api/payments/flutterwave/init`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, user_id, email, name }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      json?.error ||
      json?.message ||
      json?.details ||
      "Flutterwave init failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  if (!json?.link) {
    throw new Error("Flutterwave init did not return a payment link.");
  }

  return json; // { link, tx_ref }
}
