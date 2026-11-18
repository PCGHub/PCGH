import { useState } from "react";
import {
  member,
  rows,
  ownCampaigns,
} from "../lib/campaigns";
import {
  campaignStatus,
  number,
  date,
} from "../lib/economy";
import {
  Page,
  Card,
  CampaignCard,
  Filter,
  Pagination,
  useLoad,
} from "../components/CampaignUI";

export default function MyLinks() {
  const [filter, setFilter] =
    useState("all");

  const [page, setPage] =
    useState(1);

  const state = useLoad(async () => {
    const user = await member();

    return {
      campaigns:
        await ownCampaigns(user.id),

      legacy: await rows(
        "links",
        (query) =>
          query
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false,
            }),
      ),

      events: await rows(
        "wallet_events",
        (query) =>
          query
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false,
            }),
      ),
    };
  });

  const all =
    state.data?.campaigns || [];

  const filtered = all.filter(
    (campaign) =>
      filter === "all" ||
      campaignStatus(campaign) === filter,
  );

  return (
    <Page
      title="My Campaigns"
      description="Track approval, verified completions, expiry, and returned credits."
      {...state}
    >
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

      <p className="text-sm text-gray-600">
        {all.length} campaigns ·{" "}
        {
          all.filter(
            (campaign) =>
              campaignStatus(campaign) ===
              "active",
          ).length
        }{" "}
        active ·{" "}
        {
          all.filter(
            (campaign) =>
              campaign.status ===
              "pending_approval",
          ).length
        }{" "}
        pending approval
      </p>

      {filtered
        .slice(
          (page - 1) * 10,
          page * 10,
        )
        .map((campaign) => (
          <CampaignCard
            campaign={campaign}
            key={campaign.id}
          >
            <details className="mt-4">
              <summary className="cursor-pointer text-emerald-800">
                Transaction timeline
              </summary>

              {state.data.events
                .filter(
                  (event) =>
                    event.campaign_id ===
                    campaign.id,
                )
                .map((event) => (
                  <p
                    className="text-sm py-2"
                    key={event.id}
                  >
                    {date(event.created_at)}
                    {" "}· {event.description}
                    {" "}·{" "}
                    {number(event.amount)}
                    {" "}available /{" "}
                    {number(
                      event.reserved_delta,
                    )}
                    {" "}reserved credits
                  </p>
                ))}
            </details>
          </CampaignCard>
        ))}

      {!filtered.length &&
        !state.busy && (
          <Card>
            No campaigns in this category.
          </Card>
        )}

      <Pagination
        page={page}
        total={filtered.length}
        onChange={setPage}
      />

      {!!state.data?.legacy.length && (
        <details>
          <summary className="font-bold cursor-pointer">
            Historical campaigns (
            {state.data.legacy.length})
          </summary>

          <p className="my-3 text-gray-600">
            Original prices and targets are
            preserved. These records are not part
            of the new campaign package.
          </p>

          {state.data.legacy.map(
            (campaign) => (
              <Card key={campaign.id}>
                <h3 className="font-bold">
                  {campaign.title}
                </h3>

                <p>
                  {campaign.status === "active" &&
                  new Date(
                    campaign.expires_at,
                  ) <= new Date()
                    ? "expired (historical)"
                    : campaign.status}
                  {" "}·{" "}
                  {campaign.current_engagement}
                  {" "}/{" "}
                  {campaign.target_engagement}
                  {" "}historical engagement ·{" "}
                  {number(
                    campaign.credits_spent,
                  )}
                  {" "}credits charged
                </p>

                <p>
                  Created:{" "}
                  {date(campaign.created_at)}
                  {" "}· Expiry:{" "}
                  {date(campaign.expires_at)}
                </p>
              </Card>
            ),
          )}
        </details>
      )}
    </Page>
  );
}
