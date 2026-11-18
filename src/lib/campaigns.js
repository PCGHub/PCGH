import { supabase } from "./supabase";

export async function action(name, payload = {}) {
  const { data, error } = await supabase.rpc(
    "campaign_action",
    {
      action: name,
      payload,
    },
  );

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function rows(
  table,
  query = (q) => q,
  columns = "*",
) {
  const result = [];
  const batch = 500;

  for (let offset = 0; ; offset += batch) {
    const { data, error } = await query(
      supabase.from(table).select(columns),
    )
      .order(table === "credit_orders" ? "reference" : "id")
      .range(offset, offset + batch - 1);

    if (error) {
      throw error;
    }

    result.push(...(data || []));

    if (!data || data.length < batch) {
      return result;
    }
  }
}

export async function member() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw error || new Error("Please sign in");
  }

  await action("ensure_profile");
  await action("refresh");

  const { data, error: profileError } = await supabase
    .from("users")
    .select(
      "id,email,username,full_name,credits,reserved_credits,earning_allowance,earning_reserved,earning_unlocked,total_earned_credits,total_spent_credits,reputation_score,completed_tasks_count,submitted_links_count,is_active,joined_at,is_admin,admin_role,pod_id",
    )
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  return {
    ...data,
    email_confirmed_at: user.email_confirmed_at,
  };
}

export async function ownCampaigns(userId) {
  const [campaigns, summary] = await Promise.all([
    rows("campaigns", (query) =>
      query
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        }),
    ),
    supabase.rpc("campaign_progress"),
  ]);

  if (summary.error) {
    throw summary.error;
  }

  return campaigns.map((campaign) => ({
    ...campaign,
    ...(summary.data || []).find(
      (progress) =>
        progress.campaign_id === campaign.id,
    ),
  }));
}
