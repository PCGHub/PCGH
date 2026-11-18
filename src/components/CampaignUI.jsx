import {
  useEffect,
  useState,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import {
  number,
  date,
  label,
  campaignStatus,
  remaining,
  safeUrl,
} from "../lib/economy";

export function useLoad(
  loader,
  dependencies = [],
) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const reload = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      setData(await loader());
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }, dependencies);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    data,
    error,
    busy,
    reload,
    setError,
  };
}

export function Page({
  title,
  description,
  children,
  error,
  busy,
}) {
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">
          {title}
        </h1>

        {description && (
          <p className="text-gray-600 mt-2">
            {description}
          </p>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl p-4 border border-red-200 bg-red-50 text-red-800"
        >
          {error}
        </p>
      )}

      {busy && (
        <p role="status">Loading…</p>
      )}

      {children}
    </main>
  );
}

export function Card({
  children,
  className = "",
}) {
  return (
    <section
      className={`bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function Button({
  children,
  secondary = false,
  ...props
}) {
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
        secondary
          ? "border border-gray-300 bg-white text-gray-800"
          : "bg-emerald-700 text-white hover:bg-emerald-800"
      }`}
    >
      {children}
    </button>
  );
}

export function Field({
  label: text,
  children,
}) {
  return (
    <label className="block space-y-2">
      <span className="font-medium text-sm text-gray-700">
        {text}
      </span>

      {children}
    </label>
  );
}

export function Stats({ items }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(([title, value]) => (
        <Card key={title}>
          <p className="text-sm text-gray-500">
            {title}
          </p>

          <p className="text-2xl font-bold mt-2">
            {typeof value === "number"
              ? number(value)
              : value}
          </p>
        </Card>
      ))}
    </div>
  );
}

export function Allowance({ user }) {
  return (
    <Card>
      <h2 className="font-bold text-lg">
        Earn toward your next campaign
      </h2>

      <p className="my-2">
        {number(
          Number(user.earning_unlocked) -
            Number(user.earning_allowance),
        )}{" "}
        / {number(user.earning_unlocked)} credits
        earned from campaign allowances
      </p>

      <progress
        className="w-full accent-emerald-600"
        value={
          Number(user.earning_unlocked) -
          Number(user.earning_allowance)
        }
        max={Number(user.earning_unlocked) || 1}
      />

      <p className="text-sm text-gray-600 mt-2">
        {number(remaining(user))} credits
        available to earn ·{" "}
        {number(user.earning_reserved)} reserved
        for ongoing tasks and pending verification.
      </p>

      <p className="text-sm text-gray-600 my-3">
        Earn 2 credits per verified task. Each
        approved campaign unlocks 200 credits of
        allowance, which carries forward. Credits
        are for platform use, not cash withdrawals.
      </p>

      <Link
        className="text-emerald-800 font-semibold"
        to={
          remaining(user) > 0
            ? "/tasks"
            : "/submit"
        }
      >
        {remaining(user) > 0
          ? "Complete Tasks →"
          : "Submit a campaign to unlock earning →"}
      </Link>
    </Card>
  );
}

export function CampaignCard({
  campaign: c,
  children,
}) {
  const [details, setDetails] = useState(false);
  const status = campaignStatus(c);

  return (
    <Card>
      <div className="flex gap-2 flex-wrap mb-3">
        <span className="rounded-full bg-emerald-50 text-emerald-800 px-3 py-1 text-sm capitalize">
          {label(status)}
        </span>

        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
          {c.platform}
        </span>
      </div>

      <h2 className="text-xl font-bold">
        {c.title}
      </h2>

      {safeUrl(c.url) && (
        <a
          className="text-blue-700 break-all text-sm"
          href={safeUrl(c.url)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {c.url} ↗
        </a>
      )}

      <p className="mt-3 text-gray-600 whitespace-pre-wrap">
        {c.instructions}
      </p>

      <div className="flex justify-between mt-4 text-sm">
        <span>Verified completions</span>

        <strong>
          {c.verified_count} / {c.target}
        </strong>
      </div>

      <progress
        className="w-full accent-emerald-600"
        value={c.verified_count}
        max={c.target}
      />

      <p className="text-sm text-gray-600 mt-3">
        Ends: {date(c.expires_at)}
        {status === "active" &&
          ` · ${Math.max(
            0,
            Math.ceil(
              (new Date(c.expires_at) - Date.now()) /
                3600000,
            ),
          )} hours left`}
      </p>

      {c.pending_claims !== undefined && (
        <p className="text-sm text-gray-600 mt-2">
          {number(c.pending_claims)} awaiting
          verification ·{" "}
          {number(c.started_claims)} in progress
        </p>
      )}

      {c.reason && (
        <p className="mt-3 text-amber-900">
          Review: {c.reason}
        </p>
      )}

      <div className="mt-4">
        <Button
          secondary
          onClick={() => setDetails(!details)}
        >
          {details ? "Hide" : "View"} Details
        </Button>
      </div>

      {details && (
        <div className="mt-4 text-sm space-y-2 bg-gray-50 rounded-xl p-4">
          <p>
            Submitted: {date(c.created_at)}
          </p>

          <p>
            Approved:{" "}
            {c.approved_at
              ? date(c.approved_at)
              : "Awaiting approval"}
          </p>

          <p>
            Reserved:{" "}
            {status === "pending_approval" ? 500 : 0}
            {" "}· Charged:{" "}
            {["pending_approval", "rejected"].includes(
              status,
            )
              ? 0
              : 500}
            {" "}· Returned: {c.refunded} credits
          </p>

          <p>
            Platform fee: 300 · Reward pool: 200 ·
            Rewards distributed:{" "}
            {c.distributed} credits
          </p>

          <p>
            Task type: {label(c.task_type)} · Reward:
            2 credits per verified completion
          </p>

          <p>
            Campaign reference: {c.id}
          </p>

          {c.closed_at && (
            <p>
              Settled: {date(c.closed_at)}
            </p>
          )}
        </div>
      )}

      {children}
    </Card>
  );
}

export function Filter({
  value,
  onChange,
  options,
}) {
  return (
    <div
      className="flex gap-2 flex-wrap"
      role="group"
      aria-label="Filter"
    >
      {options.map((option) => (
        <Button
          key={option}
          secondary={value !== option}
          onClick={() => onChange(option)}
        >
          {label(option)}
        </Button>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  total,
  onChange,
  size = 10,
}) {
  const pages = Math.max(
    1,
    Math.ceil(total / size),
  );

  return (
    <div className="flex justify-between items-center gap-3">
      <Button
        secondary
        disabled={page <= 1}
        onClick={() => {
          onChange(page - 1);

          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }}
      >
        Previous
      </Button>

      <span>
        Page {page} of {pages}
      </span>

      <Button
        secondary
        disabled={page >= pages}
        onClick={() => {
          onChange(page + 1);

          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }}
      >
        Next
      </Button>
    </div>
  );
}
