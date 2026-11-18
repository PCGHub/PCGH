import { Link } from "react-router-dom";
import {
  member,
  rows,
  ownCampaigns,
} from "../lib/campaigns";
import {
  number,
  campaignStatus,
} from "../lib/economy";
import {
  Page,
  Card,
  Stats,
  Allowance,
  CampaignCard,
  useLoad,
} from "../components/CampaignUI";

export default function Dashboard() {
  const state = useLoad(async () => {
    const user = await member();

    const campaigns =
      await ownCampaigns(user.id);

    return {
      user,
      campaigns,
    };
  });

  const user = state.data?.user;
  const campaigns = state.data?.campaigns || [];

  const telegram =
    import.meta.env.VITE_TELEGRAM_COMMUNITY_URL;

  return (
    <Page
      title={
        user
          ? `Welcome back, ${
              user.full_name || user.username
            }`
          : "Dashboard"
      }
      description="Your campaigns, credits, and earning progress."
      {...state}
    >
      {user && (
        <>
          <section className="bg-gray-900 text-white rounded-2xl p-6">
            <p>Available Credits</p>

            <strong className="text-4xl block my-2">
              {number(user.credits)}
            </strong>

            <p className="text-gray-300">
              {number(user.reserved_credits)} reserved
              · Each campaign costs 500 credits
            </p>

            <div className="flex gap-4 mt-4">
              <Link
                to="/submit"
                className="bg-emerald-600 rounded-xl px-4 py-2"
              >
                Submit Campaign
              </Link>

              <Link
                to="/buy-credits"
                className="border border-gray-500 rounded-xl px-4 py-2"
              >
                Buy Credits
              </Link>
            </div>
          </section>

          <Stats
            items={[
              [
                "Verified Tasks",
                user.completed_tasks_count,
              ],
              [
                "Lifetime Task Rewards",
                number(user.total_earned_credits) +
                  " credits",
              ],
              [
                "Active Campaigns",
                campaigns.filter(
                  (campaign) =>
                    campaignStatus(campaign) ===
                    "active",
                ).length,
              ],
              [
                "Pending Approval",
                campaigns.filter(
                  (campaign) =>
                    campaign.status ===
                    "pending_approval",
                ).length,
              ],
            ]}
          />

          <Allowance user={user} />

          <div className="grid md:grid-cols-3 gap-4">
            {[
              [
                "/tasks",
                "Complete Tasks",
                "Earn 2 credits per verified task",
              ],
              [
                "/links",
                "My Campaigns",
                "Track progress and settlement",
              ],
              [
                "/profile",
                "Credit History",
                "See purchases, rewards, and refunds",
              ],
            ].map(([to, title, description]) => (
              <Link to={to} key={to}>
                <Card>
                  <h2 className="font-bold">
                    {title} →
                  </h2>

                  <p className="text-sm text-gray-600 mt-2">
                    {description}
                  </p>
                </Card>
              </Link>
            ))}
          </div>

          <h2 className="text-xl font-bold">
            Recent campaigns
          </h2>

          {campaigns.slice(0, 3).map((campaign) => (
            <CampaignCard
              campaign={campaign}
              key={campaign.id}
            />
          ))}

          {!campaigns.length && (
            <Card>
              No campaigns yet.{" "}
              <Link
                className="text-emerald-800 underline"
                to="/submit"
              >
                Submit your first campaign
              </Link>
              .
            </Card>
          )}

          <Card>
            <h2 className="font-bold mb-3">
              How It Works
            </h2>

            <ol className="list-decimal pl-5 space-y-2">
              <li>Fund your balance.</li>

              <li>
                Submit a campaign for 500 credits.
              </li>

              <li>
                Admin reviews and distributes it.
              </li>

              <li>
                Complete other campaigns’ eligible
                tasks to earn toward your next
                submission.
              </li>
            </ol>
          </Card>

          {telegram &&
            /^https:\/\/t\.me\//.test(telegram) && (
              <Card>
                <h2 className="font-bold">
                  Join our Telegram community
                </h2>

                <p className="my-2">
                  Optional announcements and support.
                  Essential campaign updates remain
                  here.
                </p>

                <a
                  className="text-emerald-800 underline"
                  href={telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join Telegram ↗
                </a>
              </Card>
            )}
        </>
      )}
    </Page>
  );
}
