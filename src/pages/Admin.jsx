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
  Filter,
  Stats,
  CampaignCard,
  Pagination,
  useLoad,
} from "../components/CampaignUI";
import { supabase } from "../lib/supabase";

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
      <div className="flex gap-3">
        <Button
          secondary
          onClick={() => navigate("/admin-login")}
        >
          Admin Access
        </Button>

        <Button
          secondary
          onClick={async () => {
            await action("admin_logout");
            navigate("/");
          }}
        >
          Exit Admin
        </Button>

        <Button
          secondary
          disabled={state.busy}
          onClick={state.reload}
        >
          Refresh
        </Button>
      </div>

      {d && (
        <>
          <Filter
            value={tab}
            onChange={switchTab}
            options={[
              "overview",
              "campaigns",
              "task_monitor",
              "distribution",
              "users",
              "credits_audit",
              "settings",
            ]}
          />

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
              <Filter
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
              <Filter
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
