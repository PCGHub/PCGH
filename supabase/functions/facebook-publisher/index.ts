import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";
import { facebookPostUrl, graphPost, webUrl } from "./post.mjs";

const origin = Deno.env.get("FACEBOOK_PUBLISH_ORIGIN");
const pageId = Deno.env.get("FACEBOOK_PAGE_ID") ?? "";
const pageName = Deno.env.get("FACEBOOK_PAGE_NAME") ?? "";
const pageToken = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN") ?? "";
const version = Deno.env.get("FACEBOOK_GRAPH_VERSION") ?? "";
const publishers = new Set((Deno.env.get("FACEBOOK_PUBLISHER_IDS") ?? "").split(",").map(id => id.trim()));
const configured = Boolean(origin && pageName && pageToken && /^\d+$/.test(pageId) && /^v\d+\.\d+$/.test(version));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = {
  "Access-Control-Allow-Origin": origin ?? "null",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Vary": "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function handle(req: Request) {
  if (req.headers.get("origin") !== origin) return json({ error: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const token = /^Bearer (\S+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return json({ error: "Sign in to PCGH." }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: "Sign in to PCGH." }, 401);

  const raw = await req.text();
  if (raw.length > 16000) return json({ error: "Post is too large." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
  if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);

  const enabled = configured && publishers.has(user.id);
  if (body.action === "status") return json(enabled ? { enabled, pageId, pageName } : { enabled });
  if (!enabled) return json({ error: "Publishing access has not been granted." }, 403);
  if (body.action === "check") {
    if (typeof body.requestId !== "string" || !uuid.test(body.requestId)) return json({ error: "Invalid request ID." }, 400);
    const { data, error } = await admin.from("facebook_publication_attempts").select("status,post_url")
      .eq("request_id", body.requestId).eq("user_id", user.id).eq("page_id", pageId).maybeSingle();
    if (error) return json({ error: "Publication status unavailable." }, 503);
    return json(data?.status === "published" ? { state: "published", url: data.post_url } : { state: "unknown" });
  }
  if (body.action !== "publish") return json({ error: "Unknown action." }, 400);
  if (body.confirmed !== true || body.pageId !== pageId || typeof body.requestId !== "string" || !uuid.test(body.requestId)) {
    return json({ error: "Confirm the selected Page and post before publishing." }, 400);
  }

  const { caption, link, image, requestId } = body;
  if (typeof caption !== "string" || !caption.trim() || caption.length > 2200 ||
      typeof link !== "string" || link.length > 2000 || (link && !webUrl(link)) ||
      typeof image !== "string" || image.length > 2000 || (image && !webUrl(image))) {
    return json({ error: "Supply a caption and valid HTTPS links." }, 400);
  }

  const payloadHash = await digest([caption, link, image]);
  const attempts = admin.from("facebook_publication_attempts");
  const claim = await attempts.insert({ request_id: requestId, user_id: user.id, page_id: pageId, payload_hash: payloadHash });
  if (claim.error?.code === "23505") {
    const { data: prior } = await attempts.select("page_id,payload_hash,status,post_url")
      .eq("request_id", requestId).eq("user_id", user.id).maybeSingle();
    if (!prior || prior.page_id !== pageId || prior.payload_hash !== payloadHash) {
      return json({ error: "This request was already used." }, 409);
    }
    if (prior.status === "published") return json({ state: "published", url: prior.post_url });
    return json({ state: "unknown" });
  }
  if (claim.error) return json({ error: "Could not record the publication request." }, 503);

  const post = graphPost(pageId, caption, link, image);
  let url = null;
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${post.path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${pageToken}` },
      body: new URLSearchParams(post.body as Record<string, string>),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) url = facebookPostUrl(pageId, await response.json());
  } catch {
    // A timeout does not establish whether the Page received the post.
  }

  const { error } = await attempts.update({ status: url ? "published" : "unknown", post_url: url })
    .eq("request_id", requestId).eq("user_id", user.id);
  if (error || !url) return json({ state: "unknown" });
  return json({ state: "published", url });
}

Deno.serve(async req => {
  try {
    return await handle(req);
  } catch {
    return json({ error: "Publishing service unavailable." }, 503);
  }
});
