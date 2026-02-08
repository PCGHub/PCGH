import { useState, useEffect } from 'react'
import { Search, RefreshCw, Loader, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('joined_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedUser, setExpandedUser] = useState(null)
  const [userTasks, setUserTasks] = useState({})

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order(sortField, { ascending: sortAsc })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [sortField, sortAsc])

  const fetchUserTasks = async (userId) => {
    if (userTasks[userId]) return
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, status, task_type, credit_reward, completed_at, created_at, links: link_id (title)')
        .or(`user_id.eq.${userId},assigned_to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setUserTasks(prev => ({ ...prev, [userId]: data || [] }))
    } catch (err) {
      console.error(err)
    }
  }

  const toggleExpand = (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null)
    } else {
      setExpandedUser(userId)
      fetchUserTasks(userId)
    }
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      user.username?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.full_name?.toLowerCase().includes(q)
    )
  })

  const STATUS_COLORS = {
    completed: 'bg-green-100 text-green-700',
    verified: 'bg-blue-100 text-blue-700',
    available: 'bg-yellow-100 text-yellow-700',
    assigned: 'bg-orange-100 text-orange-700',
    rejected: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by username, email, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={fetchUsers}
          className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="text-sm text-gray-500">
        {filteredUsers.length} user(s) found
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin text-blue-500" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th
                    className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('username')}
                  >
                    <span className="inline-flex items-center gap-1">User <SortIcon field="username" /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('credits')}
                  >
                    <span className="inline-flex items-center gap-1">Credits <SortIcon field="credits" /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('completed_tasks_count')}
                  >
                    <span className="inline-flex items-center gap-1">Tasks Done <SortIcon field="completed_tasks_count" /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('submitted_links_count')}
                  >
                    <span className="inline-flex items-center gap-1">Links <SortIcon field="submitted_links_count" /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Tier</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th
                    className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('joined_at')}
                  >
                    <span className="inline-flex items-center gap-1">Joined <SortIcon field="joined_at" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map(user => (
                  <>
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => toggleExpand(user.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{user.username}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-blue-600">{user.credits || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{user.completed_tasks_count || 0}</td>
                      <td className="px-4 py-3 text-gray-700">{user.submitted_links_count || 0}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded capitalize">
                          {user.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {user.joined_at ? new Date(user.joined_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                    {expandedUser === user.id && (
                      <tr key={`${user.id}-details`}>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500">Total Earned</p>
                                <p className="font-semibold text-green-600">{user.total_earned_credits || 0}</p>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500">Total Spent</p>
                                <p className="font-semibold text-red-600">{user.total_spent_credits || 0}</p>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500">Reputation</p>
                                <p className="font-semibold text-gray-900">{user.reputation_score || 0}</p>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500">Full Name</p>
                                <p className="font-semibold text-gray-900">{user.full_name || 'N/A'}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">Recent Tasks</p>
                              {!userTasks[user.id] ? (
                                <div className="flex items-center gap-2 text-gray-500 text-sm">
                                  <Loader size={14} className="animate-spin" /> Loading...
                                </div>
                              ) : userTasks[user.id].length === 0 ? (
                                <p className="text-sm text-gray-500">No tasks found</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {userTasks[user.id].map(task => (
                                    <div key={task.id} className="flex items-center gap-3 text-sm bg-white px-3 py-2 rounded-lg border border-gray-100">
                                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-600'}`}>
                                        {task.status}
                                      </span>
                                      <span className="text-gray-700 truncate flex-1">{task.links?.title || 'Untitled'}</span>
                                      <span className="text-xs text-gray-400 capitalize">{task.task_type}</span>
                                      <span className="text-xs text-gray-400">{new Date(task.created_at).toLocaleDateString()}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
