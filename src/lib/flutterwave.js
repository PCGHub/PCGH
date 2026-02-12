// src/lib/flutterwave.js
export async function initFlutterwavePayment({ plan, user_id, email, name }) {
  const res = await fetch('/api/payments/flutterwave/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, user_id, email, name }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      json?.error ||
      json?.message ||
      (json?.details?.message ? json.details.message : null) ||
      'Flutterwave init failed';
    throw new Error(msg);
  }

  if (!json?.link) {
    throw new Error('Flutterwave init did not return a payment link.');
  }

  return json; // { link, tx_ref }
}
