import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MIN_VISIT_SECONDS = 20;
const MAX_ATTEMPT_AGE_MINUTES = 30;
const MAX_ATTEMPTS = 2;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAuthToken(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header) return null;
  return header.replace("Bearer ", "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const token = getAuthToken(req);
    if (!token) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const action = body.action;

    if (!action) {
      return jsonResponse({ error: "action is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "start") {
      return await handleStart(adminClient, user.id, body);
    }

    if (action === "verify") {
      return await handleVerify(adminClient, user.id, body);
    }

    if (action === "status") {
      return await handleStatus(adminClient, user.id, body);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

async function handleStart(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: any
) {
  const task_id = body.task_id;
  if (!task_id) {
    return jsonResponse({ error: "task_id is required" }, 400);
  }

  const { data: task } = await client
    .from("tasks")
    .select("id, status, user_id")
    .eq("id", task_id)
    .maybeSingle();

  if (!task) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  if (task.user_id === userId) {
    return jsonResponse({ error: "Cannot complete your own task" }, 403);
  }

  if (task.status !== "available") {
    return jsonResponse({ error: "Task is no longer available" }, 400);
  }

  const { data: existingAttempts } = await client
    .from("task_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("task_id", task_id)
    .order("attempt_number", { ascending: true });

  const attempts = existingAttempts || [];

  const activeAttempt = attempts.find((a: any) => a.status === "started");
  if (activeAttempt) {
    return jsonResponse({
      status: "started",
      attempt_id: activeAttempt.id,
      attempt_number: activeAttempt.attempt_number,
      started_at: activeAttempt.started_at,
      attempts_used: attempts.length,
      attempts_left: MAX_ATTEMPTS - attempts.length,
      message:
        "You already have an active attempt. Visit the link and come back to verify.",
    });
  }

  const failedCount = attempts.filter(
    (a: any) => a.status === "failed" || a.status === "locked"
  ).length;

  if (failedCount >= MAX_ATTEMPTS) {
    return jsonResponse({
      status: "locked",
      attempts_used: failedCount,
      attempts_left: 0,
      message:
        "You have used all attempts for this task. It is no longer available to you.",
    });
  }

  const nextAttemptNumber = failedCount + 1;

  const { data: newAttempt, error: insertError } = await client
    .from("task_attempts")
    .insert({
      task_id,
      user_id: userId,
      attempt_number: nextAttemptNumber,
      status: "started",
      started_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (insertError) {
    console.error("Insert error:", insertError);
    return jsonResponse({ error: "Failed to start attempt" }, 500);
  }

  return jsonResponse({
    status: "started",
    attempt_id: newAttempt.id,
    attempt_number: nextAttemptNumber,
    started_at: newAttempt.started_at,
    attempts_used: nextAttemptNumber,
    attempts_left: MAX_ATTEMPTS - nextAttemptNumber,
    message: `Attempt ${nextAttemptNumber} started. Stay on the external link for at least ${MIN_VISIT_SECONDS} seconds.`,
  });
}

async function handleVerify(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: any
) {
  const { task_id, attempt_id } = body;
  if (!task_id || !attempt_id) {
    return jsonResponse(
      { error: "task_id and attempt_id are required" },
      400
    );
  }

  const { data: attempt } = await client
    .from("task_attempts")
    .select("*")
    .eq("id", attempt_id)
    .eq("user_id", userId)
    .eq("task_id", task_id)
    .maybeSingle();

  if (!attempt) {
    return jsonResponse({ error: "Attempt not found" }, 404);
  }

  if (attempt.status === "completed") {
    return jsonResponse({
      status: "completed",
      message: "This task has already been completed.",
      duration_seconds: attempt.duration_seconds,
      attempts_left: 0,
    });
  }

  if (attempt.status === "failed" || attempt.status === "locked") {
    const { data: allAttempts } = await client
      .from("task_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("task_id", task_id);

    const totalUsed = (allAttempts || []).length;
    return jsonResponse({
      status: attempt.status,
      message: "This attempt has already been resolved.",
      duration_seconds: attempt.duration_seconds,
      attempts_left: Math.max(0, MAX_ATTEMPTS - totalUsed),
    });
  }

  if (attempt.status !== "started") {
    return jsonResponse({ error: "Invalid attempt state" }, 400);
  }

  const startedAt = new Date(attempt.started_at).getTime();
  const now = Date.now();
  const ageMinutes = (now - startedAt) / 1000 / 60;

  if (ageMinutes > MAX_ATTEMPT_AGE_MINUTES) {
    await client
      .from("task_attempts")
      .update({
        status: "failed",
        verified_at: new Date().toISOString(),
        duration_seconds: Math.floor((now - startedAt) / 1000),
        failure_reason: `Attempt expired. Must verify within ${MAX_ATTEMPT_AGE_MINUTES} minutes.`,
      })
      .eq("id", attempt_id);

    const { data: allAttempts } = await client
      .from("task_attempts")
      .select("id, status")
      .eq("user_id", userId)
      .eq("task_id", task_id);

    const failedCount = (allAttempts || []).filter(
      (a: any) => a.status === "failed" || a.status === "locked"
    ).length;
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - failedCount);

    if (attemptsLeft === 0) {
      await client
        .from("task_attempts")
        .update({ status: "locked" })
        .eq("id", attempt_id);
    }

    return jsonResponse({
      status: attemptsLeft === 0 ? "locked" : "failed",
      duration_seconds: Math.floor((now - startedAt) / 1000),
      attempts_left: attemptsLeft,
      message: `Attempt expired. You must verify within ${MAX_ATTEMPT_AGE_MINUTES} minutes of starting.`,
    });
  }

  const durationSeconds = (now - startedAt) / 1000;

  if (durationSeconds < MIN_VISIT_SECONDS) {
    const { data: allAttempts } = await client
      .from("task_attempts")
      .select("id, status")
      .eq("user_id", userId)
      .eq("task_id", task_id);

    const currentFailedCount =
      (allAttempts || []).filter(
        (a: any) =>
          (a.status === "failed" || a.status === "locked") &&
          a.id !== attempt_id
      ).length + 1;

    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - currentFailedCount);
    const finalStatus = attemptsLeft === 0 ? "locked" : "failed";

    await client
      .from("task_attempts")
      .update({
        status: finalStatus,
        verified_at: new Date().toISOString(),
        duration_seconds: Math.floor(durationSeconds),
        failure_reason: `Stayed only ${Math.floor(durationSeconds)} seconds. Minimum required: ${MIN_VISIT_SECONDS} seconds.`,
      })
      .eq("id", attempt_id);

    return jsonResponse({
      status: finalStatus,
      duration_seconds: Math.floor(durationSeconds),
      attempts_left: attemptsLeft,
      message: `Task failed: You stayed on the external page for ${Math.floor(durationSeconds)} second${Math.floor(durationSeconds) !== 1 ? "s" : ""}. Minimum required is ${MIN_VISIT_SECONDS} seconds.${attemptsLeft > 0 ? " Please try again." : " No attempts remaining."}`,
    });
  }

  await client
    .from("task_attempts")
    .update({
      status: "completed",
      verified_at: new Date().toISOString(),
      duration_seconds: Math.floor(durationSeconds),
    })
    .eq("id", attempt_id);

  const { data: existingCompletion } = await client
    .from("task_completions")
    .select("id")
    .eq("task_id", task_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingCompletion) {
    return jsonResponse({
      status: "completed",
      duration_seconds: Math.floor(durationSeconds),
      attempts_left: 0,
      message: "Task already completed previously.",
    });
  }

  await client.from("task_completions").insert({
    task_id,
    user_id: userId,
    proof_type: "auto_verified",
    credits_earned: 1,
    verified: true,
    notes: `Server-verified: ${Math.floor(durationSeconds)}s on external link`,
  });

  await client
    .from("tasks")
    .update({
      status: "completed",
      assigned_to_user_id: userId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", task_id);

  const { data: userProfile } = await client
    .from("users")
    .select("credits, total_earned_credits, completed_tasks_count")
    .eq("id", userId)
    .maybeSingle();

  if (userProfile) {
    await client
      .from("users")
      .update({
        credits: (Number(userProfile.credits) || 0) + 1,
        total_earned_credits:
          (Number(userProfile.total_earned_credits) || 0) + 1,
        completed_tasks_count:
          (Number(userProfile.completed_tasks_count) || 0) + 1,
      })
      .eq("id", userId);
  }

  await client.from("credit_transactions").insert({
    user_id: userId,
    amount: 1,
    transaction_type: "earned",
    description: "Completed task (server-verified)",
    related_task_id: task_id,
  });

  return jsonResponse({
    status: "completed",
    duration_seconds: Math.floor(durationSeconds),
    attempts_left: 0,
    message: "Task completed! You earned 1 credit.",
  });
}

async function handleStatus(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: any
) {
  const task_id = body.task_id;
  if (!task_id) {
    return jsonResponse({ error: "task_id is required" }, 400);
  }

  const { data: attempts } = await client
    .from("task_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("task_id", task_id)
    .order("attempt_number", { ascending: true });

  const attemptList = attempts || [];

  if (attemptList.length === 0) {
    return jsonResponse({
      status: "ready",
      attempts_used: 0,
      attempts_left: MAX_ATTEMPTS,
      attempts: [],
    });
  }

  const active = attemptList.find((a: any) => a.status === "started");
  const failedCount = attemptList.filter(
    (a: any) => a.status === "failed" || a.status === "locked"
  ).length;
  const completed = attemptList.find((a: any) => a.status === "completed");

  let status = "ready";
  if (completed) status = "completed";
  else if (active) status = "started";
  else if (failedCount >= MAX_ATTEMPTS) status = "locked";
  else if (failedCount > 0) status = "failed";

  return jsonResponse({
    status,
    attempts_used: attemptList.length,
    attempts_left: Math.max(0, MAX_ATTEMPTS - failedCount),
    active_attempt_id: active?.id || null,
    attempts: attemptList.map((a: any) => ({
      id: a.id,
      attempt_number: a.attempt_number,
      status: a.status,
      started_at: a.started_at,
      duration_seconds: a.duration_seconds,
      failure_reason: a.failure_reason,
    })),
  });
}
