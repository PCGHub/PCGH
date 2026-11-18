export const ECONOMY = Object.freeze({
  price: 500,
  fee: 300,
  pool: 200,
  reward: 2,
  target: 100,
  days: 7,
});

export const number = (value) =>
  Number(value || 0).toLocaleString("en-NG");

export const date = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Starts after approval";

export const label = (value) =>
  (value || "").replaceAll("_", " ");

export const remaining = (user) =>
  Math.max(
    0,
    Number(user?.earning_allowance || 0) -
      Number(user?.earning_reserved || 0),
  );

export function campaignStatus(campaign) {
  return campaign.status === "active" &&
    new Date(campaign.expires_at) <= new Date()
    ? "settling"
    : campaign.status;
}

export function safeUrl(value) {
  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
