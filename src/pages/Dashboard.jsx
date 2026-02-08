import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Zap, TrendingUp, Award, Wallet, ArrowRight, CreditCard, AlertCircle } from 'lucide-react'
import { API } from '../lib/api'
import { StatSkeleton } from '../components/Skeleton'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authUser = await API.getCurrentUser()
        const profile = await API.getUserProfile(authUser.id)
        if (!profile) return
        setUser(profile)
        setStats({
          credits: Number(profile.credits) || 0,
          earned: Number(profile.total_earned_credits) || 0,
          spent: Number(profile.total_spent_credits) || 0,
          tasksCompleted: Number(profile.completed_tasks_count) || 0,
          linksSubmitted: Number(profile.submitted_links_count) || 0,
          reputation: Number(profile.reputation_score) || 0
        })
      } catch (err) {
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="h-10 w-64 bg-gray-200 rounded-lg animate-pulse mb-2" />
            <div className="h-5 w-48 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="h-40 bg-gray-200 rounded-2xl animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => <StatSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-400 mb-3" size={40} />
          <p className="text-gray-700 font-medium">Failed to load dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.full_name || user.username}
          </h1>
          <p className="text-gray-500 mt-1">Here's your growth overview</p>
        </div>

        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 text-white mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
          <div className="relative flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium">Available Credits</p>
              <p className="text-5xl font-bold mt-2 tracking-tight">{stats.credits}</p>
              <p className="text-gray-400 mt-4 text-sm">1 credit = 1 engagement action</p>
            </div>
            <Wallet className="w-14 h-14 text-gray-600" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">Tasks Completed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.tasksCompleted}</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Zap className="text-blue-600" size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">Credits Earned</p>
                <p className="text-2xl font-bold text-green-600 mt-1">+{stats.earned}</p>
              </div>
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="text-green-600" size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">Links Submitted</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.linksSubmitted}</p>
              </div>
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Award className="text-amber-600" size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            to="/tasks"
            className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md hover:border-blue-200 transition group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Complete Tasks</h3>
                <p className="text-gray-500 text-xs mt-0.5">Earn credits</p>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" size={18} />
            </div>
          </Link>

          <Link
            to="/submit"
            className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md hover:border-emerald-200 transition group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Submit Link</h3>
                <p className="text-gray-500 text-xs mt-0.5">Get engagement</p>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" size={18} />
            </div>
          </Link>

          <Link
            to="/links"
            className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md hover:border-amber-200 transition group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">My Links</h3>
                <p className="text-gray-500 text-xs mt-0.5">Track progress</p>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" size={18} />
            </div>
          </Link>

          <Link
            to="/buy-credits"
            className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md hover:border-blue-200 transition group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Buy Credits</h3>
                <p className="text-gray-500 text-xs mt-0.5">Top up balance</p>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" size={18} />
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">How It Works</h3>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                Complete tasks from others to earn credits
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                Submit your links and spend credits
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                Get real engagement from real people
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                Scale your growth sustainably
              </li>
            </ol>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Account Info</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Reputation</span>
                <span className="text-sm font-semibold text-gray-900">{stats.reputation}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Tier</span>
                <span className="text-sm font-semibold text-gray-900 capitalize">{user.tier}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Credits Spent</span>
                <span className="text-sm font-semibold text-red-600">-{stats.spent}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">Member Since</span>
                <span className="text-sm font-semibold text-gray-900">
                  {user.joined_at ? new Date(user.joined_at).toLocaleDateString() : 'Recently'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
