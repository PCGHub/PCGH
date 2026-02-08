import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader, BarChart3, ListChecks, Users, Send, Shield, LogOut, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AdminTaskMonitor from '../components/admin/AdminTaskMonitor'
import AdminDistributeTasks from '../components/admin/AdminDistributeTasks'
import AdminUsers from '../components/admin/AdminUsers'
import AdminAccessControl from '../components/admin/AdminAccessControl'

const BASE_TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'tasks', label: 'Task Monitor', icon: ListChecks },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'distribute', label: 'Distribute Tasks', icon: Send },
]

const OWNER_TAB = { key: 'access', label: 'Access Control', icon: KeyRound }

export default function Admin() {
  const [activeTab, setActiveTab] = useState('overview')
  const [adminStats, setAdminStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adminProfile, setAdminProfile] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const verified = sessionStorage.getItem('admin_verified')
    if (!verified) {
      navigate('/admin-login', { replace: true })
      return
    }

    const checkAdminAndFetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('is_admin, admin_role, username')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) throw profileError
        if (!profile?.is_admin) {
          setError('Access denied. Admin privileges required.')
          setLoading(false)
          return
        }

        setAdminProfile(profile)

        const [usersRes, tasksRes, linksRes, txnRes] = await Promise.all([
          supabase.from('users').select('*'),
          supabase.from('tasks').select('*'),
          supabase.from('links').select('*'),
          supabase.from('credit_transactions').select('*'),
        ])

        if (usersRes.error || tasksRes.error || linksRes.error || txnRes.error) {
          throw new Error('Failed to fetch admin data')
        }

        const users = usersRes.data || []
        const tasks = tasksRes.data || []
        const links = linksRes.data || []
        const transactions = txnRes.data || []

        const activeUsers = users.filter(u => u.is_active).length
        const totalCredits = users.reduce((sum, u) => sum + (Number(u.credits) || 0), 0)
        const completedTasks = tasks.filter(t => t.status === 'completed').length
        const failedTasks = tasks.filter(t => t.status === 'rejected').length
        const assignedTasks = tasks.filter(t => t.status === 'assigned').length
        const availableTasks = tasks.filter(t => t.status === 'available').length
        const activeLinks = links.filter(l => l.status === 'active').length

        setAdminStats({
          totalUsers: users.length,
          activeUsers,
          totalTasks: tasks.length,
          completedTasks,
          failedTasks,
          assignedTasks,
          availableTasks,
          totalLinks: links.length,
          activeLinks,
          totalCreditsInCirculation: totalCredits,
          avgUserCredits: users.length > 0 ? Math.round(totalCredits / users.length) : 0,
          totalTransactions: transactions.length,
        })
      } catch (err) {
        if (!error) setError(err.message || 'Failed to load admin dashboard')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    checkAdminAndFetchStats()
  }, [])

  const handleExitAdmin = () => {
    sessionStorage.removeItem('admin_verified')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="animate-spin text-gray-900" size={40} />
      </div>
    )
  }

  if (error || !adminProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 max-w-md w-full text-center">
          <Shield className="mx-auto text-red-400 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">{error || 'You do not have admin privileges.'}</p>
        </div>
      </div>
    )
  }

  const isOwner = adminProfile.admin_role === 'owner'
  const welcomeMessage = isOwner
    ? 'Welcome back, Boss Victor (PCGH)'
    : `Welcome back to PCGH Admin Page, ${adminProfile.username}`

  const tabs = isOwner ? [...BASE_TABS, OWNER_TAB] : BASE_TABS

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Shield className="text-gray-900" size={28} />
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <p className="text-gray-600 ml-[40px]">{welcomeMessage}</p>
          </div>
          <button
            onClick={handleExitAdmin}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm font-medium"
          >
            <LogOut size={16} />
            Exit Admin
          </button>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  activeTab === tab.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === 'overview' && adminStats && <OverviewTab stats={adminStats} />}
        {activeTab === 'tasks' && <AdminTaskMonitor />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'distribute' && <AdminDistributeTasks />}
        {activeTab === 'access' && isOwner && <AdminAccessControl />}
      </div>
    </div>
  )
}

function OverviewTab({ stats }) {
  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, sub: `${stats.activeUsers} active`, color: 'text-gray-900' },
    { label: 'Total Tasks', value: stats.totalTasks, sub: `${stats.completedTasks} completed`, color: 'text-gray-900' },
    { label: 'Available Tasks', value: stats.availableTasks, sub: 'Waiting for users', color: 'text-yellow-600' },
    { label: 'Assigned Tasks', value: stats.assignedTasks, sub: 'In progress', color: 'text-orange-600' },
    { label: 'Completed Tasks', value: stats.completedTasks, sub: 'Successfully done', color: 'text-green-600' },
    { label: 'Failed Tasks', value: stats.failedTasks, sub: 'Rejected / failed', color: 'text-red-600' },
    { label: 'Total Links', value: stats.totalLinks, sub: `${stats.activeLinks} active`, color: 'text-gray-900' },
    { label: 'Credits in Circulation', value: stats.totalCreditsInCirculation, sub: `Avg: ${stats.avgUserCredits}/user`, color: 'text-blue-600' },
    { label: 'Total Transactions', value: stats.totalTransactions, sub: 'All time', color: 'text-gray-900' },
  ]

  const completionRate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
  const participationRate = stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition">
            <p className="text-gray-500 text-sm">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-5">Platform Metrics</h2>
        <div className="space-y-5">
          <div>
            <div className="flex justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Task Completion Rate</p>
              <p className="text-sm font-bold text-gray-900">{completionRate}%</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Active User Participation</p>
              <p className="text-sm font-bold text-gray-900">{participationRate}%</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${participationRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
