/async function startFlutterwavePayment() {
  const response = await fetch("/api/payments/flutterwave/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan: "pro_pack",
      user_id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || "User"
    })
  });

  const data = await response.json();

  if (data.link) {
    window.location.href = data.link;
  } else {
    alert("Payment failed");
  }
}
