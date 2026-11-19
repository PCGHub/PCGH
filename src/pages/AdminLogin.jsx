import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { action } from "../lib/campaigns";

export default function AdminLogin() {
  const [pin, setPin] = useState("");
  const [setup, setSetup] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in first.");
        setLoading(false);
        return;
      }

      if (setup) {
        if (pin.length < 8 || pin !== confirmPin) throw new Error("PINs must match and contain at least 8 characters.");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please sign in again.");
        const response = await fetch("/api/admin/initialize-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ password: accountPassword, pin }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.configured) throw new Error(result.error || "PIN setup failed");
        setAccountPassword("");
        setConfirmPin("");
      }
      const login = await action("admin_login", { pin });
      if (login?.error) throw new Error(login.error);

      navigate("/admin");
    } catch (error) {
      setError(
        error.message || "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm transition"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-900 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield
                className="text-white"
                size={32}
              />
            </div>

            <h1 className="text-2xl font-bold text-white">
              Admin Access
            </h1>

            <p className="text-gray-400 text-sm mt-2">
              {setup ? "Create your first admin PIN" : "Enter your admin PIN to continue"}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-5"
          >
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {setup && <div><label className="block text-sm font-medium text-gray-700 mb-2">Confirm your account password</label><input type="password" autoComplete="current-password" required value={accountPassword} onChange={e => setAccountPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl" /></div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {setup ? "New Admin PIN (at least 8 characters)" : "Admin PIN"}
              </label>

              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />

                <input
                  type={
                    showPin
                      ? "text"
                      : "password"
                  }
                  value={pin}
                  onChange={(event) =>
                    setPin(event.target.value)
                  }
                  placeholder="Enter your admin PIN"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition text-lg tracking-widest"
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPin(!showPin)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPin ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {setup && <div><label className="block text-sm font-medium text-gray-700 mb-2">Confirm new PIN</label><input type="password" required value={confirmPin} onChange={e => setConfirmPin(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl" /></div>}
            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading
                ? "Verifying..."
                : setup ? "Create PIN and Access Admin" : "Access Admin Panel"}
            </button>
            <button type="button" onClick={() => { setSetup(!setup); setError(""); setPin(""); setConfirmPin(""); setAccountPassword(""); }} className="text-sm text-gray-700 underline w-full">{setup ? "Already have a PIN? Sign in" : "First-time administrator? Create PIN"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
