import { useState } from "react";
import { Link } from "react-router-dom";
import {
  member,
  rows,
  action,
} from "../lib/campaigns";
import {
  date,
  label,
  safeUrl,
  remaining,
} from "../lib/economy";
import {
  Page,
  Card,
  Button,
  Field,
  Filter,
  Allowance,
  Pagination,
  useLoad,
} from "../components/CampaignUI";

export default function TaskFeed() {
  const [filter, setFilter] = useState("available");
  const [platform, setPlatform] = useState("all");
  const [page, setPage] = useState(1);
  const [working, setWorking] = useState(false);
  const [selected, setSelected] = useState(null);
  const [evidence, setEvidence] = useState("");
  const [report, setReport] = useState(null);
  const [reason, setReason] = useState("");
  const [reportNotice, setReportNotice] = useState("");

  const state = useLoad(async () => {
    const user = await member();

    const [campaigns, claims] = await Promise.all([
      rows("campaigns", (q) =>
        q.order("created_at", {
          ascending: false,
        }),
      ),

      rows("campaign_claims", (q) =>
        q.eq("user_id", user.id),
      ),
    ]);

    return {
      user,
      campaigns,
      claims,
    };
  });

  const u = state.data?.user;
  const claims = state.data?.claims || [];
  const all = state.data?.campaigns || [];

  const list = all.filter((c) => {
    if (
      c.user_id === u?.id ||
      (platform !== "all" &&
        c.platform !== platform)
    ) {
      return false;
    }

    const q = claims.find(
      (claim) => claim.campaign_id === c.id,
    );

    return filter === "available"
      ? !q &&
          c.status === "active" &&
          new Date(c.expires_at) > new Date()
      : filter === "in_progress"
        ? q?.status === "in_progress"
        : filter === "pending_verification"
          ? q?.status === "pending_verification"
          : q &&
            [
              "verified",
              "rejected",
              "expired",
            ].includes(q.status);
  });

  async function run(name, payload) {
    if (working) {
      return;
    }

    setWorking(true);
    state.setError("");

    try {
      await action(name, payload);
      if (name === "report") setReportNotice("Report sent successfully. The admin team can review it in Task Reports.");
      await state.reload();

      setSelected(null);
      setEvidence("");
      setReport(null);
      setReason("");
    } catch (e) {
      if (name === "report") setReportNotice("");
      state.setError(e.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Page
      title="Community Tasks"
      description="Complete eligible tasks to earn credits toward your next campaign."
      {...state}
    >
      {u && (
        <Allowance user={u} />
      )}
      {reportNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">{reportNotice}</div>}

      <Filter
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
        options={[
          "available",
          "in_progress",
          "pending_verification",
          "completed",
        ]}
      />

      <Field label="Platform">
        <select
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value);
            setPage(1);
          }}
        >
          {[
            "all",
            ...new Set(
              all.map((c) => c.platform),
            ),
          ].map((p) => (
            <option key={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      {list
        .slice(
          (page - 1) * 10,
          page * 10,
        )
        .map((c) => {
          const q = claims.find(
            (claim) =>
              claim.campaign_id === c.id,
          );

          return (
            <Card key={c.id}>
              <div className="flex gap-2 text-sm mb-3">
                <span className="bg-gray-100 rounded px-2 py-1">
                  {c.platform}
                </span>

                <span className="bg-emerald-50 text-emerald-800 rounded px-2 py-1">
                  +2 credits after verification
                </span>

                <span>
                  {label(c.task_type)}
                </span>
              </div>

              <h2 className="font-bold text-xl">
                {c.title}
              </h2>

              <p className="my-3 whitespace-pre-wrap">
                {c.instructions}
              </p>

              <p className="text-sm text-gray-600">
                Campaign ends {date(c.expires_at)}
                {" "}· Complete and submit within
                30 minutes of starting, or before
                campaign expiry.
              </p>

              {q && (
                <p className="mt-2 font-medium capitalize">
                  {label(q.status)}

                  {q.status === "in_progress" &&
                    ` · Submit by ${date(q.deadline)}`}
                </p>
              )}

              {q?.reason && (
                <p className="text-amber-800">
                  {q.reason}
                </p>
              )}

              {!safeUrl(c.url) && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="alert">This task has no valid destination URL. Please report it to the administrator before starting.</p>}
              <div className="flex gap-3 flex-wrap mt-4">
                {!q && (
                  <Button
                    disabled={working}
                    onClick={() => setSelected(selected === c.id ? null : c.id)}
                  >
                    View Task
                  </Button>
                )}

                {q?.status === "in_progress" && (
                  <>
                    <a
                      className="text-emerald-800 underline py-2"
                      href={safeUrl(c.url) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open destination ↗
                    </a>

                    <Button
                      disabled={working}
                      onClick={() =>
                        setSelected(c.id)
                      }
                    >
                      Submit for Verification
                    </Button>
                  </>
                )}

                <Button
                  secondary
                  onClick={() =>
                    setReport(c.id)
                  }
                >
                  Report task / broken link
                </Button>
              </div>

              {selected === c.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-3">
                  {!q ? (
                    <>
                      <p>
                        Read the instructions above.
                        Starting reserves a completion
                        slot and 2 credits of your
                        earning allowance. A link
                        opening or timer alone does
                        not prove completion.
                      </p>

                      {safeUrl(c.url) && <a href={safeUrl(c.url)} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800">Open task link ↗</a>}
                      {remaining(u) < 2 && <p className="text-sm text-amber-800">You can inspect this link, but cannot start earning until your allowance is available.</p>}
                      <Button
                        disabled={
                          working ||
                          remaining(u) < 2 || !safeUrl(c.url)
                        }
                        onClick={() =>
                          run("start", {
                            campaign_id: c.id,
                          })
                        }
                      >
                        Start Task
                      </Button>
                    </>
                  ) : (
                    <>
                      <Field label="Completion evidence">
                        <textarea
                          minLength={10}
                          maxLength={3000}
                          rows={4}
                          value={evidence}
                          onChange={(e) =>
                            setEvidence(
                              e.target.value,
                            )
                          }
                          placeholder="Describe what you completed. Include a proof link or specific feedback for admin review; do not include passwords or private information."
                        />
                      </Field>

                      <Button
                        disabled={
                          working ||
                          evidence.trim().length < 10
                        }
                        onClick={() =>
                          run("evidence", {
                            claim_id: q.id,
                            evidence,
                          })
                        }
                      >
                        Submit Evidence
                      </Button>
                    </>
                  )}
                </div>
              )}

              {report === c.id && (
                <div className="mt-4 space-y-3">
                  <Field label="Describe the issue">
                    <textarea
                      value={reason}
                      onChange={(e) =>
                        setReason(
                          e.target.value,
                        )
                      }
                    />
                  </Field>

                  <Button
                    disabled={
                      working ||
                      reason.trim().length < 3
                    }
                    onClick={() =>
                      run("report", {
                        campaign_id: c.id,
                        reason,
                      })
                    }
                  >
                    Send Report
                  </Button>
                </div>
              )}
            </Card>
          );
        })}

      {!list.length &&
        !state.busy && (
          <Card>
            No tasks in this category.
            Check again later.
          </Card>
        )}

      {u && remaining(u) < 2 && (
        <Card>
          Your earning allowance is fully used
          or reserved. Pending verification can
          still finish.{" "}
          <Link
            className="underline text-emerald-800"
            to="/submit"
          >
            Submit another campaign
          </Link>
          {" "}to unlock more earning.
        </Card>
      )}

      <Pagination
        page={page}
        total={list.length}
        onChange={setPage}
      />
    </Page>
  );
}
