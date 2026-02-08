import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, Home, Zap, Plus, Link as LinkIcon, User, Coins, Shield, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'

const navLinks = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/tasks', label: 'Tasks', icon: Zap },
  { to: '/submit', label: 'Submit', icon: Plus },
  { to: '/links', label: 'Links', icon: LinkIcon },
  { to: '/ads', label: 'Ads', icon: Target },
]

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle()
      setIsAdmin(data?.is_admin === true)
    }
    checkAdmin()
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl text-gray-900">
              <img src="/whatsapp_image_2026-02-05_at_3.45.19_pm.jpeg" alt="PCGH Logo" className="h-10 w-auto object-contain" />
            </Link>

            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                    isActive(to)
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
              <Link
                to="/buy-credits"
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                  isActive('/buy-credits')
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                }`}
              >
                <Coins size={16} />
                Credits
              </Link>
              {isAdmin && (
                <Link
                  to="/admin-login"
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                    isActive('/admin-login') || isActive('/admin')
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <Shield size={16} />
                  Admin
                </Link>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/profile"
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                isActive('/profile')
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <User size={16} />
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-4 pt-2 space-y-1 animate-fade-in">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive(to) ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive('/profile') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <User size={18} />
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
