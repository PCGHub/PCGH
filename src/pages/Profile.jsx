import { useState } from "react";
import {
  member,
  rows,
} from "../lib/campaigns";
import { supabase } from "../lib/supabase";
import {
  number,
  date,
  label,
} from "../lib/economy";
import {
  Page,
  Card,
  Button,
  Field,
  Stats,
  Filter,
  Pagination,
  useLoad,
} from "../components/CampaignUI";

export default function Profile() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const state = useLoad(async () => {
    const u = await member();

    setForm({
      full_name: u.full_name || "",
      username: u.username,
    });

    const [events, legacy] = await Promise.all([
      rows("wallet_events", (q) =>
        q
          .eq("user_id", u.id)
          .order("created_at", {
            ascending: false,
          }),
      ),

      rows("credit_transactions", (q) =>
        q
          .eq("user_id", u.id)
          .order("created_at", {
            ascending: false,
          }),
      ),
    ]);

    return {
      u,
      events,
      legacy,
    };
  });

  const u = state.data?.u;
  const events = state.data?.events || [];

  const filtered = events.filter(
    (event) =>
      (filter === "all" ||
        event.kind === filter) &&
      (!from ||
        event.created_at >=
          new Date(from).toISOString()) &&
      (!to ||
        event.created_at <
          new Date(
            new Date(to).getTime() +
              86400000,
          ).toISOString()),
  );

  async function save(e) {
    e.preventDefault();

    setSaving(true);
    state.setError("");

    try {
      const { error } = await supabase
        .from("users")
        .update(form)
        .eq("id", u.id);

      if (error) {
        throw error;
      }

      await state.reload();

      setMessage("Profile saved.");
    } catch (error) {
      state.setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();

    setSaving(true);

    try {
      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        throw error;
      }

      setPassword("");

      setMessage(
        "Password update submitted. Complete any authentication confirmation requested.",
      );
    } catch (error) {
      state.setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page
      title="My Profile"
      description="Manage your account and understand every credit movement."
      {...state}
    >
      {message && (
        <p role="status">
          {message}
        </p>
      )}

      {u && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <form
                className="space-y-4"
                onSubmit={save}
              >
                <h2 className="font-bold text-lg">
                  Edit Profile
                </h2>

                <Field label="Full Name">
                  <input
                    required
                    maxLength={100}
                    value={
                      form?.full_name || ""
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        full_name:
                          e.target.value,
                      })
                    }
                  />
                </Field>

                <Field label="Username">
                  <input
                    required
                    pattern="[A-Za-z0-9_]{3,30}"
                    title="3–30 letters, numbers, or underscores"
                    value={
                      form?.username || ""
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        username:
                          e.target.value,
                      })
                    }
                  />
                </Field>

                <Button
                  disabled={
                    saving ||
                    (form?.username ===
                      u.username &&
                      form?.full_name ===
                        (u.full_name || ""))
                  }
                >
                  {saving
                    ? "Saving…"
                    : "Save Changes"}
                </Button>
              </form>
            </Card>

            <Card>
              <h2 className="font-bold text-lg">
                Account
              </h2>

              <p className="mt-3 break-all">
                {u.email}
              </p>

              <p className="text-sm text-gray-600">
                Email{" "}
                {u.email_confirmed_at
                  ? "verified"
                  : "awaiting verification"}
              </p>

              <p className="mt-3">
                Member since{" "}
                {date(u.joined_at)}
              </p>

              <p className="mt-3">
                Reputation:{" "}
                {u.completed_tasks_count
                  ? number(
                      u.reputation_score,
                    )
                  : "Not yet rated"}
              </p>

              <p className="text-sm text-gray-500">
                Reputation is shown separately
                from task rewards and does not
                increase your balance.
              </p>

              <form
                className="mt-5 space-y-3"
                onSubmit={changePassword}
              >
                <Field label="New Password">
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value,
                      )
                    }
                  />
                </Field>

                <Button
                  disabled={
                    saving ||
                    password.length < 12
                  }
                  secondary
                >
                  Change Password
                </Button>
              </form>
            </Card>
          </div>

          <Stats
            items={[
              [
                "Available Credits",
                number(u.credits),
              ],
              [
                "Reserved Credits",
                number(u.reserved_credits),
              ],
              [
                "Task Rewards Earned",
                number(
                  u.total_earned_credits,
                ),
              ],
              [
                "Campaign Charges",
                number(
                  u.total_spent_credits,
                ),
              ],
              [
                "Reward Credits Returned",
                number(
                  events
                    .filter(
                      (event) =>
                        event.kind ===
                        "refund",
                    )
                    .reduce(
                      (sum, event) =>
                        sum +
                        Number(
                          event.amount,
                        ),
                      0,
                    ),
                ),
              ],
            ]}
          />

          <Card>
            <h2 className="font-bold text-xl mb-4">
              Transaction History
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Credits are for platform use,
              not cash withdrawals. Reservations
              move available credits into a
              held balance; approval consumes
              that reservation without a
              second deduction.
            </p>

            <Filter
              value={filter}
              onChange={(value) => {
                setFilter(value);
                setPage(1);
              }}
              options={[
                "all",
                "purchase",
                "reservation",
                "charge",
                "reward",
                "release",
                "refund",
                "adjustment",
                "opening_balance",
              ]}
            />

            <div className="grid sm:grid-cols-2 gap-4 my-4">
              <Field label="From">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(
                      e.target.value,
                    );

                    setPage(1);
                  }}
                />
              </Field>

              <Field label="Through">
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(
                      e.target.value,
                    );

                    setPage(1);
                  }}
                />
              </Field>
            </div>

            {filtered
              .slice(
                (page - 1) * 10,
                page * 10,
              )
              .map((event) => (
                <article
                  className="py-4 border-t space-y-1"
                  key={event.id}
                >
                  <div className="flex justify-between gap-4">
                    <strong className="capitalize">
                      {label(event.kind)}
                    </strong>

                    <strong>
                      {event.amount > 0
                        ? "+"
                        : ""}
                      {number(
                        event.amount,
                      )}
                      {" "}credits
                    </strong>
                  </div>

                  <p>
                    {event.description}
                  </p>

                  <p className="text-sm text-gray-600">
                    Confirmed ·{" "}
                    {date(
                      event.created_at,
                    )}
                    {" "}· Available after:{" "}
                    {number(
                      event.balance_after,
                    )}
                    {" "}· Reserved after:{" "}
                    {number(
                      event.reserved_after,
                    )}
                  </p>

                  <p className="text-xs text-gray-500 break-all">
                    Reference:{" "}
                    {event.reference ||
                      event.id}
                  </p>

                  {event.campaign_id && (
                    <a
                      href="/links"
                      className="text-emerald-800 text-sm underline"
                    >
                      View campaigns
                    </a>
                  )}
                </article>
              ))}

            {!filtered.length && (
              <p className="py-6">
                No matching transactions.
              </p>
            )}

            <Pagination
              page={page}
              total={filtered.length}
              onChange={setPage}
            />
          </Card>

          <details>
            <summary className="font-bold cursor-pointer">
              Historical transactions (
              {state.data.legacy.length})
            </summary>

            <p className="text-sm my-3">
              Legacy records retain their
              original amounts and labels.
              Missing descriptions are not
              inferred.
            </p>

            {state.data.legacy.map(
              (event) => (
                <Card key={event.id}>
                  <p>
                    {event.description ||
                      "Historical entry — description unavailable"}
                  </p>

                  <p>
                    {date(
                      event.created_at,
                    )}
                    {" "}·{" "}
                    {event.transaction_type}
                    {" "}·{" "}
                    {number(
                      event.amount,
                    )}
                    {" "}(original recorded
                    amount)
                  </p>
                </Card>
              ),
            )}
          </details>
        </>
      )}
    </Page>
  );
}
