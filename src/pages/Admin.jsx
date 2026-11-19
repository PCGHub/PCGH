import { ShieldCheck, RefreshCw, LogOut, Megaphone, ClipboardCheck, Users, Send, Wallet, Settings, LayoutDashboard, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  action,
  member,
  rows,
} from "../lib/campaigns";
import {
  number,
  date,
  label,
  campaignStatus,
} from "../lib/economy";
import {
  Page,
  Card,
  Button,
  Field,
  Stats,
  CampaignCard,
  Pagination,
  useLoad,
} from "../components/CampaignUI";
import { supabase } from "../lib/supabase";

function AdminFilter({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm" role="group" aria-label="Status filter">
      {options.map(option => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors sm:text-sm ${value === option ? "bg-emerald-700 text-white" : "bg-gray-50 text-gray-600 hover:bg-emerald-50 hover:text-emerald-800"}`}>
          {label(option)}
        </button>
      ))}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState("");
  const [audience, setAudience] = useState("community");
  const [recipients, setRecipients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pin, setPin] = useState("");
  const [amount, setAmount] = useState("");

  const navigate = useNavigate();

  const state = useLoad(async () => {
    const user = await member();

    const {
      data: allowed,
      error,
    } = await supabase.rpc("campaign_admin");

    if (error) {
      throw error;
    }

    if (!allowed) {
      throw new Error(
        "Admin session expired. Open Admin Access to verify your PIN.",
      );
    }

    const [
      campaigns,
      claims,
      users,
      events,
      audit,
      reports,
      pods,
      orders,
    ] = await Promise.all(
      [
        "campaigns",
        "campaign_claims",
        "users",
        "wallet_events",
        "admin_events",
        "campaign_reports",
        "user_pods",
        "credit_orders",
      ].map((table) =>
        table === "users"
          ? rows(
              "users",
              (query) => query,
              "id,email,username,credits,reserved_credits,earning_allowance,earning_reserved,is_active,is_admin,admin_role,completed_tasks_count,submitted_links_count,pod_id",
            )
          : rows(table),
      ),
    );

    return {
      user,
      campaigns,
      claims,
      users,
      events,
      audit,
      reports,
      pods,
      orders,
    };
  });

  const d = state.data;

  async function run(name, payload = {}) {
    if (working) {
      return;
    }

    setWorking(true);
    state.setError("");

    try {
      await action(name, payload);
      setReason("");
      await state.reload();
    } catch (error) {
      state.setError(error.message);
    } finally {
      setWorking(false);
    }
  }

  const switchTab = (value) => {
    setTab(value);
    setFilter("all");
    setPage(1);
    setSearch("");
  };

  const username = (id) =>
    d?.users.find((user) => user.id === id)?.username || id;

  const matching = (value) =>
    JSON.stringify(value)
      .toLowerCase()
      .includes(search.toLowerCase());

  const campaigns = (d?.campaigns || []).filter(
    (campaign) =>
      (filter === "all" ||
        campaignStatus(campaign) === filter) &&
      matching({
        ...campaign,
        owner: username(campaign.user_id),
      }),
  );

  const claims = (d?.claims || []).filter(
    (claim) =>
      (filter === "all" || claim.status === filter) &&
      matching({
        ...claim,
        participant: username(claim.user_id),
        title: d?.campaigns.find(
          (campaign) =>
            campaign.id === claim.campaign_id,
        )?.title,
      }),
  );

  return (
    <Page
      title="Admin Dashboard"
      description="Review campaigns, verify evidence, and account for every credit."
      {...state}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><ShieldCheck size={21} /></span>
          <div><p className="text-sm font-semibold text-gray-900">Management Console</p><p className="text-xs text-gray-500">Secure administrator workspace</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={state.reload} disabled={state.busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><RefreshCw size={16} /> Refresh</button>
          <button type="button" onClick={async () => { await action("admin_logout"); navigate("/"); }} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><LogOut size={16} /> Exit</button>
        </div>
      </div>

      {d && (
        <>
          <nav aria-label="Admin sections" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {[
              ["overview", "Overview", LayoutDashboard],
              ["campaigns", "Campaigns", Megaphone],
              ["task_monitor", "Task Monitor", ClipboardCheck],
              ["distribution", "Distribution", Send],
              ["users", "Users", Users],
              ["credits_audit", "Credit Audit", Wallet],
              ["settings", "Settings", Settings],
            ].map(([key, title, Icon]) => (
              <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => switchTab(key)}
                className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${tab === key ? "border-emerald-700 bg-emerald-700 text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50"}`}>
                <Icon size={17} className="shrink-0" /><span className="truncate">{title}</span>
              </button>
            ))}
          </nav>

          {tab !== "overview" && (
            <section className="overflow-hidden rounded-2xl bg-gray-900 p-5 text-white shadow-sm sm:p-7">
              {(() => {
                const config = {
                  campaigns: { title: "Campaign Management", subtitle: "Review requests, approve campaigns, and track their progress.", icon: Megaphone, metrics: [["Total campaigns", d.campaigns.length], ["Pending approval", d.campaigns.filter(c => c.status === "pending_approval").length], ["Active", d.campaigns.filter(c => c.status === "active").length]] },
                  task_monitor: { title: "Task Monitor", subtitle: "Review evidence and manage participant verification.", icon: ClipboardCheck, metrics: [["Total claims", d.claims.length], ["Awaiting review", d.claims.filter(c => c.status === "pending_verification").length], ["Verified", d.claims.filter(c => c.status === "verified").length]] },
                  distribution: { title: "Task Distribution", subtitle: "Assign approved, funded campaigns to eligible audiences.", icon: Send, metrics: [["Active campaigns", d.campaigns.filter(c => c.status === "active").length], ["Members", d.users.length], ["Pending approvals", d.campaigns.filter(c => c.status === "pending_approval").length]] },
                  users: { title: "Member Management", subtitle: "Manage members and monitor wallet and participation activity.", icon: Users, metrics: [["Total members", d.users.length], ["Active members", d.users.filter(u => u.is_active).length], ["Administrators", d.users.filter(u => u.is_admin).length]] },
                  credits_audit: { title: "Credits & Audit", subtitle: "Trace wallet movements, payments, and administrative activity.", icon: Wallet, metrics: [["Wallet events", d.events.length], ["Completed payments", d.orders.filter(o => o.status === "completed").length], ["Audit entries", d.audit.length]] },
                  settings: { title: "Admin Settings", subtitle: "Manage administrator security and authorized account controls.", icon: Settings, metrics: [["Administrators", d.users.filter(u => u.is_admin).length], ["Active members", d.users.filter(u => u.is_active).length], ["Audit entries", d.audit.length]] },
                };
                const section = config[tab];
                if (!section) return null;
                const Icon = section.icon;
                return (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">PCGH Crowd · Admin Console</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{section.title}</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-300">{section.subtitle}</p></div>
                      <span className="shrink-0 rounded-xl bg-white/10 p-3 text-emerald-300"><Icon size={25} /></span>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {section.metrics.map(([name, value]) => (
                        <div key={name} className="rounded-xl border border-white/10 bg-white/10 p-3 sm:p-4"><p className="text-xs text-gray-300">{name}</p><p className="mt-2 text-2xl font-bold">{number(value)}</p></div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </section>
          )}

          {tab === "overview" && (
            <section className="overflow-hidden rounded-2xl bg-gray-900 p-5 text-white shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Platform overview</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Welcome, Admin</h2><p className="mt-2 text-sm text-gray-300">Your campaign operations at a glance.</p></div>
                <span className="rounded-xl bg-white/10 p-3 text-emerald-300"><ShieldCheck size={26} /></span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Pending approvals", d.campaigns.filter(c => c.status === "pending_approval").length],
                  ["Active campaigns", d.campaigns.filter(c => c.status === "active").length],
                  ["Task reviews", d.claims.filter(c => c.status === "pending_verification").length],
                  ["Members", d.users.length],
                ].map(([name, value]) => (
                  <div key={name} className="rounded-xl border border-white/10 bg-white/10 p-3 sm:p-4"><p className="text-xs text-gray-300">{name}</p><p className="mt-2 text-2xl font-bold">{number(value)}</p></div>
                ))}
              </div>
            </section>
          )}

          {tab === "overview" && (
            <>
              <Stats
                items={[
                  [
                    "Pending Approvals",
                    d.campaigns.filter(
                      (campaign) =>
                        campaign.status ===
                        "pending_approval",
                    ).length,
                  ],
                  [
                    "Claims Awaiting Review",
                    d.claims.filter(
                      (claim) =>
                        claim.status ===
                        "pending_verification",
                    ).length,
                  ],
                  [
                    "Settlements Due",
                    d.campaigns.filter(
                      (campaign) =>
                        campaignStatus(campaign) ===
                        "settling",
                    ).length,
                  ],
                  [
                    "Ending Within 24 Hours",
                    d.campaigns.filter(
                      (campaign) =>
                        campaign.status === "active" &&
                        new Date(campaign.expires_at) >
                          new Date() &&
                        new Date(campaign.expires_at) -
                          Date.now() <
                          86400000,
                    ).length,
                  ],
                ]}
              />

              <Stats
                items={[
                  [
                    "Available Wallet Credits",
                    number(
                      d.users.reduce(
                        (sum, user) =>
                          sum + Number(user.credits),
                        0,
                      ),
                    ),
                  ],
                  [
                    "Reserved Wallet Credits",
                    number(
                      d.users.reduce(
                        (sum, user) =>
                          sum + user.reserved_credits,
                        0,
                      ),
                    ),
                  ],
                  [
                    "Platform Fees (credits)",
                    number(
                      d.campaigns.filter(
                        (campaign) =>
                          campaign.approved_at,
                      ).length * 300,
                    ),
                  ],
                  [
                    "Confirmed Payments (NGN)",
                    number(
                      d.orders
                        .filter(
                          (order) =>
                            order.status === "completed",
                        )
                        .reduce(
                          (sum, order) =>
                            sum + order.amount_naira,
                          0,
                        ),
                    ),
                  ],
                ]}
              />

              <Card>
                <h2 className="font-bold">
                  Participation in the last seven days
                </h2>

                <p>
                  {
                    new Set(
                      d.claims
                        .filter(
                          (claim) =>
                            claim.reviewed_at &&
                            claim.status === "verified" &&
                            new Date(claim.reviewed_at) >
                              new Date(
                                Date.now() -
                                  7 * 86400000,
                              ),
                        )
                        .map(
                          (claim) => claim.user_id,
                        ),
                    ).size
                  }{" "}
                  of {d.users.length} members completed
                  a verified task.
                </p>

                <p className="text-sm text-gray-600 mt-2">
                  Credit fees are gross revenue, not
                  cash profit. Payment proceeds and
                  outstanding credit obligations are
                  shown separately.
                </p>
              </Card>

              <Card>
                <h2 className="font-bold">
                  Task reports
                </h2>

                {d.reports.length ? (
                  d.reports.map((report) => (
                    <p
                      className="py-2 border-b"
                      key={report.id}
                    >
                      {username(report.user_id)}
                      {" "}· {report.reason}
                      {" "}· {date(report.created_at)}
                      {" "}· Campaign{" "}
                      {report.campaign_id}
                    </p>
                  ))
                ) : (
                  <p>No reports.</p>
                )}
              </Card>
            </>
          )}

          {[
            "campaigns",
            "task_monitor",
            "users",
            "credits_audit",
          ].includes(tab) && (
            <Field label="Search">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search title, member, reference, or reason"
              />
            </Field>
          )}

          {tab === "campaigns" && (
            <>
              <AdminFilter
                value={filter}
                onChange={(value) => {
                  setFilter(value);
                  setPage(1);
                }}
                options={[
                  "all",
                  "pending_approval",
                  "active",
                  "settling",
                  "completed",
                  "expired",
                  "rejected",
                ]}
              />

              <Field label="Review reason">
                <textarea
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                  placeholder="Required for rejection"
                />
              </Field>

              {campaigns
                .slice((page - 1) * 10, page * 10)
                .map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                  >
                    <p className="mt-3">
                      Owner:{" "}
                      {username(campaign.user_id)}
                      {" "}· Pending claims:{" "}
                      {
                        d.claims.filter(
                          (claim) =>
                            claim.campaign_id ===
                              campaign.id &&
                            [
                              "in_progress",
                              "pending_verification",
                            ].includes(claim.status),
                        ).length
                      }
                    </p>

                    <div className="flex gap-3 mt-3">
                      {campaign.status ===
                        "pending_approval" && (
                        <>
                          <Button
                            disabled={working}
                            onClick={() =>
                              run("approve", {
                                campaign_id:
                                  campaign.id,
                              })
                            }
                          >
                            Approve — charge 500 credits
                          </Button>

                          <Button
                            secondary
                            disabled={
                              working ||
                              reason.trim().length < 3
                            }
                            onClick={() =>
                              run("reject", {
                                campaign_id:
                                  campaign.id,
                                reason,
                              })
                            }
                          >
                            Reject &amp; Release 500
                          </Button>
                        </>
                      )}

                      {campaignStatus(campaign) ===
                        "settling" && (
                        <Button
                          disabled={working}
                          onClick={() =>
                            run("settle", {
                              campaign_id:
                                campaign.id,
                            })
                          }
                        >
                          Settle — return{" "}
                          {200 - campaign.distributed}
                          {" "}unused credits
                        </Button>
                      )}
                    </div>
                  </CampaignCard>
                ))}

              <Pagination
                page={page}
                total={campaigns.length}
                onChange={setPage}
              />
            </>
          )}

          {tab === "task_monitor" && (
            <>
              <AdminFilter
                value={filter}
                onChange={(value) => {
                  setFilter(value);
                  setPage(1);
                }}
                options={[
                  "all",
                  "in_progress",
                  "pending_verification",
                  "verified",
                  "rejected",
                  "expired",
                ]}
              />

              <Field label="Verification reason">
                <textarea
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                />
              </Field>

              {claims
                .slice((page - 1) * 10, page * 10)
                .map((claim) => (
                  <Card key={claim.id}>
                    <h2 className="font-bold">
                      {
                        d.campaigns.find(
                          (campaign) =>
                            campaign.id ===
                            claim.campaign_id,
                        )?.title
                      }
                    </h2>

                    <p>
                      {username(claim.user_id)}
                      {" "}· {label(claim.status)}
                      {" "}· Reward: 2 credits
                    </p>

                    <p className="text-sm text-gray-600">
                      Started{" "}
                      {date(claim.created_at)}
                      {" "}· Submission deadline{" "}
                      {date(claim.deadline)}
                    </p>

                    <p className="whitespace-pre-wrap p-3 bg-gray-50 my-3">
                      {claim.evidence ||
                        "No evidence submitted"}
                    </p>

                    {claim.reason && (
                      <p>
                        Reason: {claim.reason}
                      </p>
                    )}

                    {claim.status ===
                      "pending_verification" && (
                      <div className="flex gap-3">
                        <Button
                          disabled={working}
                          onClick={() =>
                            run("review", {
                              claim_id: claim.id,
                              approved: true,
                              reason,
                            })
                          }
                        >
                          Verify &amp; Award 2 Credits
                        </Button>

                        <Button
                          secondary
                          disabled={
                            working ||
                            reason.trim().length < 3
                          }
                          onClick={() =>
                            run("review", {
                              claim_id: claim.id,
                              approved: false,
                              reason,
                            })
                          }
                        >
                          Reject Claim
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}

              <Pagination
                page={page}
                total={claims.length}
                onChange={setPage}
              />
            </>
          )}

          {tab === "distribution" && (
            <Card>
              <div className="space-y-4">
                <h2 className="font-bold">
                  Distribute an approved, funded campaign
                </h2>

                <p>
                  Members claim tasks from the feed.
                  No self-engagement, duplicate
                  campaign rewards, or assignments
                  beyond the funded target are allowed.
                </p>

                <Field label="Active Campaign">
                  <select
                    value={selected}
                    onChange={(event) =>
                      setSelected(event.target.value)
                    }
                  >
                    <option value="">
                      Select a campaign
                    </option>

                    {d.campaigns
                      .filter(
                        (campaign) =>
                          campaignStatus(campaign) ===
                          "active",
                      )
                      .map((campaign) => (
                        <option
                          value={campaign.id}
                          key={campaign.id}
                        >
                          {campaign.title}
                          {" "}—{" "}
                          {campaign.verified_count}/100
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Audience">
                  <select
                    value={audience}
                    onChange={(event) =>
                      setAudience(event.target.value)
                    }
                  >
                    {[
                      "community",
                      "individuals",
                      "groups",
                    ].map((value) => (
                      <option key={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>

                {audience === "individuals" &&
                  d.users
                    .filter(
                      (user) =>
                        user.is_active &&
                        user.id !==
                          d.campaigns.find(
                            (campaign) =>
                              campaign.id === selected,
                          )?.user_id,
                    )
                    .map((user) => (
                      <label
                        className="flex gap-3"
                        key={user.id}
                      >
                        <input
                          type="checkbox"
                          checked={recipients.includes(
                            user.id,
                          )}
                          onChange={(event) =>
                            setRecipients(
                              event.target.checked
                                ? [
                                    ...recipients,
                                    user.id,
                                  ]
                                : recipients.filter(
                                    (id) =>
                                      id !== user.id,
                                  ),
                            )
                          }
                        />

                        {user.username}
                        {" "}·{" "}
                        {Math.max(
                          0,
                          user.earning_allowance -
                            user.earning_reserved,
                        )}
                        {" "}allowance available
                      </label>
                    ))}

                {audience === "groups" &&
                  d.pods.map((pod) => (
                    <label
                      className="flex gap-3"
                      key={pod.id}
                    >
                      <input
                        type="checkbox"
                        checked={groups.includes(
                          pod.id,
                        )}
                        onChange={(event) =>
                          setGroups(
                            event.target.checked
                              ? [...groups, pod.id]
                              : groups.filter(
                                  (id) => id !== pod.id,
                                ),
                          )
                        }
                      />

                      Community group{" "}
                      {pod.pod_number}
                    </label>
                  ))}

                <Button
                  disabled={
                    working ||
                    !selected ||
                    (audience === "individuals" &&
                      !recipients.length) ||
                    (audience === "groups" &&
                      !groups.length)
                  }
                  onClick={() =>
                    run("distribute", {
                      campaign_id: selected,
                      audience,
                      recipients,
                      group_ids: groups,
                    })
                  }
                >
                  Save Distribution
                </Button>
              </div>
            </Card>
          )}

          {tab === "users" &&
            d.users
              .filter(matching)
              .map((user) => (
                <Card key={user.id}>
                  <h2 className="font-bold">
                    {user.username}
                  </h2>

                  <p>
                    {user.email}
                    {" "}·{" "}
                    {user.is_active
                      ? "Active"
                      : "Suspended"}
                  </p>

                  <p>
                    {number(user.credits)} available
                    {" "}·{" "}
                    {number(user.reserved_credits)}
                    {" "}reserved ·{" "}
                    {number(
                      user.earning_allowance -
                        user.earning_reserved,
                    )}
                    {" "}earning allowance available
                  </p>

                  <p>
                    {user.completed_tasks_count}
                    {" "}verified tasks ·{" "}
                    {user.submitted_links_count}
                    {" "}campaigns submitted
                  </p>

                  {d.user.admin_role === "owner" &&
                    user.admin_role !== "owner" && (
                      <Button
                        secondary
                        disabled={working}
                        onClick={() =>
                          run("access", {
                            user_id: user.id,
                            is_active:
                              !user.is_active,
                          })
                        }
                      >
                        {user.is_active
                          ? "Suspend"
                          : "Reactivate"}
                      </Button>
                    )}
                </Card>
              ))}

          {tab === "credits_audit" && (
            <>
              <Card>
                <h2 className="font-bold mb-3">
                  Wallet movements
                </h2>

                {d.events
                  .filter(matching)
                  .slice(
                    (page - 1) * 10,
                    page * 10,
                  )
                  .map((event) => (
                    <div
                      className="border-b py-3"
                      key={event.id}
                    >
                      <p>
                        {username(event.user_id)}
                        {" "}· {event.kind}
                        {" "}·{" "}
                        {event.amount > 0 ? "+" : ""}
                        {event.amount} credits
                        {" "}·{" "}
                        {event.reserved_delta} reserved
                      </p>

                      <p>
                        {event.description}
                      </p>

                      <p className="text-sm text-gray-600">
                        {date(event.created_at)}
                        {" "}· Available after{" "}
                        {number(event.balance_after)}
                        {" "}· Reference{" "}
                        {event.reference || event.id}
                      </p>
                    </div>
                  ))}

                <Pagination
                  page={page}
                  total={
                    d.events.filter(matching).length
                  }
                  onChange={setPage}
                />
              </Card>

              <details>
                <summary className="font-bold">
                  Admin audit trail
                </summary>

                {d.audit.map((event) => (
                  <Card key={event.id}>
                    <p>
                      {date(event.created_at)}
                      {" "}·{" "}
                      {username(event.actor)}
                      {" "}· {event.action}
                    </p>

                    <p>{event.detail}</p>

                    <p className="text-xs">
                      Campaign {event.campaign_id}
                      {" "}· Claim {event.claim_id}
                    </p>
                  </Card>
                ))}
              </details>
            </>
          )}

          {tab === "settings" && (
            <Card>
              <div className="space-y-4">
                <h2 className="font-bold">
                  Admin security
                </h2>

                <Field label="New Admin PIN (at least 6 characters)">
                  <input
                    type="password"
                    value={pin}
                    onChange={(event) =>
                      setPin(event.target.value)
                    }
                  />
                </Field>

                <Button
                  disabled={
                    working || pin.length < 6
                  }
                  onClick={async () => {
                    await run("admin_pin", {
                      pin,
                    });

                    setPin("");
                  }}
                >
                  Update PIN
                </Button>

                {d.user.admin_role === "owner" && (
                  <>
                    <h2 className="font-bold pt-4">
                      Admin access control
                    </h2>

                    <Field label="Member for access or adjustment">
                      <select
                        value={selected}
                        onChange={(event) =>
                          setSelected(
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          Select member
                        </option>

                        {d.users
                          .filter(
                            (user) =>
                              user.admin_role !==
                              "owner",
                          )
                          .map((user) => (
                            <option
                              key={user.id}
                              value={user.id}
                            >
                              {user.username}
                            </option>
                          ))}
                      </select>
                    </Field>

                    <p className="text-sm text-gray-600">
                      Use the PIN field above to set
                      a new admin PIN. Share it
                      securely with the selected
                      admin.
                    </p>

                    <div className="flex gap-3">
                      <Button
                        disabled={
                          working ||
                          !selected ||
                          pin.length < 6
                        }
                        onClick={async () => {
                          await run("manage_admin", {
                            user_id: selected,
                            enabled: true,
                            pin,
                          });

                          setPin("");
                        }}
                      >
                        Grant Admin Access
                      </Button>

                      <Button
                        secondary
                        disabled={
                          working || !selected
                        }
                        onClick={() =>
                          run("manage_admin", {
                            user_id: selected,
                            enabled: false,
                          })
                        }
                      >
                        Revoke Admin Access
                      </Button>
                    </div>

                    <h2 className="font-bold pt-4">
                      Recorded balance adjustment
                    </h2>

                    <Field label="Member">
                      <select
                        value={selected}
                        onChange={(event) =>
                          setSelected(
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          Select member
                        </option>

                        {d.users.map((user) => (
                          <option
                            key={user.id}
                            value={user.id}
                          >
                            {user.username}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Credit adjustment (positive or negative)">
                      <input
                        type="number"
                        step="1"
                        value={amount}
                        onChange={(event) =>
                          setAmount(
                            event.target.value,
                          )
                        }
                      />
                    </Field>

                    <Field label="Reason">
                      <textarea
                        value={reason}
                        onChange={(event) =>
                          setReason(
                            event.target.value,
                          )
                        }
                      />
                    </Field>

                    <Button
                      disabled={
                        working ||
                        !selected ||
                        !Number.isInteger(
                          Number(amount),
                        ) ||
                        !Number(amount) ||
                        reason.trim().length < 3
                      }
                      onClick={() =>
                        run("adjust", {
                          user_id: selected,
                          amount: Number(amount),
                          reason,
                        })
                      }
                    >
                      Record Adjustment
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
