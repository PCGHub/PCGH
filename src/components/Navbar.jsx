import {
  useState,
  useEffect,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  Home,
  Zap,
  Plus,
  Link as LinkIcon,
  User,
  Coins,
  Shield,
  Target,
  Bell,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const navLinks = [
  {
    to: "/",
    label: "Dashboard",
    icon: Home,
  },
  {
    to: "/tasks",
    label: "Tasks",
    icon: Zap,
  },
  {
    to: "/submit",
    label: "Submit Campaign",
    icon: Plus,
  },
  {
    to: "/links",
    label: "My Campaigns",
    icon: LinkIcon,
  },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [isAdmin, setIsAdmin] =
    useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [memberReplies, setMemberReplies] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setMemberReplies([]);
        setReportCount(0);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      const admin = data?.is_admin === true;
      setIsAdmin(admin);
      if (admin) {
        const { count, error } = await supabase.from("campaign_reports").select("id", { count: "exact", head: true }).neq("status", "resolved");
        if (!error) setReportCount(count || 0);
      }
      const { data: replies, error: replyError } = await supabase.from("campaign_reports")
        .select("id,reason,admin_feedback,feedback_at,member_seen_at,status,campaign_id")
        .eq("user_id", user.id).not("feedback_at", "is", null).order("feedback_at", { ascending: false }).limit(30);
      if (!replyError) setMemberReplies(replies || []);
    };

    checkAdmin();
  }, [location.pathname, location.search]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const isActive = (path) =>
    location.pathname === path;

  return (
    <nav className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2 font-bold text-xl text-gray-900"
            >
              <img
                src="/whatsapp_image_2026-02-05_at_3.45.19_pm.jpeg"
                alt="PCGH Logo"
                className="h-10 w-auto object-contain"
              />
            </Link>

            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map(
                ({
                  to,
                  label,
                  icon: Icon,
                }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                      isActive(to)
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                ),
              )}

              <details className="relative">
                <summary className="cursor-pointer px-3 py-2 text-sm">
                  Tools
                </summary>

                <Link
                  to="/ads"
                  className="absolute top-full right-0 bg-white border rounded-xl p-4 shadow-lg whitespace-nowrap"
                >
                  Ad Planner
                </Link>
              </details>

              <Link
                to="/buy-credits"
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                  isActive("/buy-credits")
                    ? "bg-emerald-600 text-white"
                    : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                }`}
              >
                <Coins size={16} />
                Credits
              </Link>

              {isAdmin && (
                <Link
                  to="/admin-login"
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                    isActive("/admin-login") ||
                    isActive("/admin")
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <Shield size={16} />
                  Admin
                </Link>
              )}
            </div>
          </div>

          {isAdmin && (
            <Link to="/admin?section=task_reports" aria-label={`Task report notifications: ${reportCount}`} title="Task reports"
              className="relative inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2.5 text-gray-800 hover:bg-emerald-50">
              <Bell size={21} />
              {reportCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-bold text-white">{reportCount > 99 ? "99+" : reportCount}</span>}
            </Link>
          )}
          <div className="relative flex items-center">
            <button type="button" onClick={() => setNotificationsOpen(open => !open)}
              aria-label={`Member notifications: ${memberReplies.filter(r => !r.member_seen_at).length} unread`}
              className="relative rounded-xl border border-gray-200 bg-white p-2.5 text-gray-800 hover:bg-emerald-50">
              <Bell size={21} />
              {memberReplies.some(r => !r.member_seen_at) && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-xs font-bold text-white">{memberReplies.filter(r => !r.member_seen_at).length}</span>}
            </button>
            {notificationsOpen && <div className="absolute right-0 top-full z-[70] mt-2 max-h-96 w-[min(88vw,24rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between"><strong>Admin feedback</strong><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={18}/></button></div>
              {memberReplies.length === 0 ? <p className="text-sm text-gray-500">No admin feedback yet.</p> : memberReplies.map(reply => <div key={reply.id} className="mb-2 rounded-xl border border-gray-100 p-3 text-sm">
                <div className="flex justify-between gap-2"><strong>{reply.status === "resolved" ? "Report resolved" : "Report update"}</strong>{!reply.member_seen_at && <span className="text-emerald-700">New</span>}</div>
                <p className="mt-1 text-gray-700">{reply.admin_feedback}</p>
                <p className="mt-1 text-xs text-gray-500">Regarding: {reply.reason}</p>
                {!reply.member_seen_at && <button type="button" className="mt-2 font-semibold text-emerald-700" onClick={async () => {
                  const { error } = await supabase.rpc("mark_campaign_report_seen", { p_report_id: reply.id });
                  if (!error) setMemberReplies(old => old.map(r => r.id === reply.id ? {...r, member_seen_at: new Date().toISOString()} : r));
                }}>Mark as read</button>}
              </div>)}
            </div>}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/profile"
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                isActive("/profile")
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <User size={16} />
              Profile
            </Link>

            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className="md:hidden flex items-center">
            <button
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() =>
                setMobileMenuOpen(
                  !mobileMenuOpen,
                )
              }
              className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition"
            >
              {mobileMenuOpen ? (
                <X size={22} />
              ) : (
                <Menu size={22} />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-4 pt-2 space-y-1 animate-fade-in">
            {navLinks.map(
              ({
                to,
                label,
                icon: Icon,
              }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive(to)
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ),
            )}

            <Link
              to="/ads"
              className="block px-3 py-2"
            >
              Ad Planner
            </Link>

            <Link
              to="/buy-credits"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
            >
              <Coins size={18} />
              Buy Credits
            </Link>

            {isAdmin && (
              <Link
                to="/admin-login"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition"
              >
                <Shield size={18} />
                Admin
              </Link>
            )}

            <Link
              to="/profile"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              <User size={18} />
              Profile
            </Link>

            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
