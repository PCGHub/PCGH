import {
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  action,
  member,
} from "../lib/campaigns";
import {
  number,
  safeUrl,
} from "../lib/economy";
import {
  Page,
  Card,
  Button,
  Field,
  useLoad,
} from "../components/CampaignUI";

export default function SubmitLink() {
  const state = useLoad(member);

  const [form, setForm] = useState({
    title: "",
    url: "",
    platform: "website",
    instructions: "",
    task_type: "visit",
  });

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const request = useRef(
    crypto.randomUUID(),
  );

  const user = state.data;
  const balance = Number(user?.credits || 0);
  const canAfford = balance >= 500;

  async function submit(event) {
    event.preventDefault();

    if (sending) {
      return;
    }

    setSending(true);
    state.setError("");

    try {
      if (!safeUrl(form.url)) {
        throw new Error(
          "Use a valid http or https URL",
        );
      }

      await action("submit", {
        ...form,
        request_id: request.current,
      });

      request.current =
        crypto.randomUUID();

      setForm({
        ...form,
        title: "",
        url: "",
        instructions: "",
      });

      setMessage(
        "Campaign submitted for review. 500 credits reserved. Your seven days begin after approval.",
      );

      await state.reload();
    } catch (error) {
      state.setError(error.message);
    } finally {
      setSending(false);
    }
  }

  const update = (event) =>
    setForm({
      ...form,
      [event.target.name]:
        event.target.value,
    });

  return (
    <Page
      title="Submit Campaign"
      description="Promote your content through the community. Admin approval is required."
      {...state}
    >
      <Card>
        <p>
          Available:{" "}
          <strong>
            {number(balance)} credits
          </strong>
          {" "}· Reserved:{" "}
          {number(user?.reserved_credits)}
        </p>

        <Link
          className="text-emerald-800"
          to="/buy-credits"
        >
          Buy Credits →
        </Link>
      </Card>

      {message && (
        <p
          role="status"
          className="bg-emerald-50 p-4 rounded-xl"
        >
          {message}
        </p>
      )}

      <form
        onSubmit={submit}
        className="space-y-6"
      >
        <Card className="space-y-4">
          <Field label="Platform / Content Type">
            <select
              name="platform"
              value={form.platform}
              onChange={update}
            >
              {[
                "website",
                "youtube",
                "tiktok",
                "blog",
                "app",
                "other",
              ].map((platform) => (
                <option key={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Destination URL">
            <input
              name="url"
              type="url"
              required
              value={form.url}
              onChange={update}
              placeholder="https://example.com"
            />
          </Field>

          <Field label="Campaign Title">
            <input
              name="title"
              maxLength={160}
              required
              value={form.title}
              onChange={update}
            />
          </Field>

          <Field label="Task Type">
            <select
              name="task_type"
              value={form.task_type}
              onChange={update}
            >
              <option value="visit">
                Visit content
              </option>

              <option value="feedback">
                Content feedback
              </option>
            </select>
          </Field>

          <Field label="Task Instructions">
            <textarea
              name="instructions"
              required
              minLength={10}
              maxLength={3000}
              rows={4}
              value={form.instructions}
              onChange={update}
              placeholder="Explain what members should do and what evidence demonstrates completion."
            />
          </Field>

          <p className="text-sm text-gray-600">
            Only submit activities permitted by the
            destination platform. Opening a link
            alone does not verify a video view or
            social action.
          </p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-xl font-bold">
            Campaign package — 500 credits
          </h2>

          <p>
            300 platform fee + 200 engagement
            reward pool
          </p>

          <p>
            Target: 100 unique verified completions
            · 2 credits per completion
          </p>

          <p>
            Up to seven days from approval; closes
            earlier at the target. Delivery depends
            on eligible participation.
          </p>

          <p className="text-sm text-gray-600">
            Rejection releases all 500 credits. At
            expiry, unused reward credits are
            returned after pending claims settle.
            Each approved campaign unlocks up to
            200 credits you can earn on other
            campaigns; this is not an automatic
            refund or cash payout.
          </p>

          <hr />

          <h3 className="font-semibold">
            Preview:{" "}
            {form.title || "Your campaign"}
          </h3>

          <p className="whitespace-pre-wrap">
            {form.instructions ||
              "Your instructions will appear here."}
          </p>

          <p>
            Available after reservation:{" "}
            {number(
              Math.max(0, balance - 500),
            )}{" "}
            credits
          </p>

          {!canAfford && (
            <p className="text-amber-800">
              You need{" "}
              {number(500 - balance)} more
              credits.{" "}
              <Link
                to="/buy-credits"
                className="underline"
              >
                Buy Credits
              </Link>
            </p>
          )}

          <Button
            disabled={
              !canAfford ||
              sending ||
              state.busy
            }
          >
            {sending
              ? "Submitting…"
              : "Submit for Review — 500 Credits"}
          </Button>
        </Card>
      </form>
    </Page>
  );
}
