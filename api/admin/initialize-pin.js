const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const url = process.env.SUPABASE_URL;
    if (!url || new URL(url).hostname !== "hsicgiikaemesqrdltsh.supabase.co")
      return res.status(503).json({ error: "First-time PIN setup is available on staging only" });
    const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
    const anon = process.env.VITE_SUPABASE_ANON_KEY;
    if (!key || !anon) return res.status(503).json({ error: "PIN setup is not configured" });
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const { password, pin } = req.body || {};
    if (!token || typeof password !== "string" || typeof pin !== "string" ||
        pin.length < 8 || pin.length > 128 || password.length > 1024)
      return res.status(400).json({ error: "Sign in and enter your password and an 8-character minimum PIN" });
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user?.email || !user.email_confirmed_at)
      return res.status(401).json({ error: "Verified sign-in required" });
    const { data: profile, error: profileError } = await admin.from("users")
      .select("is_admin,is_active").eq("id", user.id).single();
    if (profileError || !profile?.is_admin || !profile?.is_active)
      return res.status(403).json({ error: "Administrator access required" });
    // Password verification is performed by Supabase Auth, not in the browser.
    const verifier = createClient(url, anon, { auth: { persistSession: false } });
    const { data: verified, error: passwordError } = await verifier.auth.signInWithPassword({
      email: user.email, password
    });
    if (passwordError || verified?.user?.id !== user.id)
      return res.status(401).json({ error: "Incorrect account password" });
    const { data: configured, error } = await admin.rpc("admin_initialize_pin", {
      p_user: user.id, p_pin: pin
    });
    if (error) throw error;
    if (!configured) return res.status(409).json({ error: "PIN already configured; sign in or use admin settings" });
    return res.status(200).json({ configured: true });
  } catch (_) {
    console.error("Admin PIN initialization failed");
    return res.status(500).json({ error: "Unable to configure PIN; please try again" });
  }
};
