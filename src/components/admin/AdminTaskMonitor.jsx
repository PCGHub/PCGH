import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, MousePointer, Eye, RefreshCw, Search, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  verified: { label: 'Verified', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  available: { label: 'Available', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  assigned: { label: 'Assigned', color: 'bg-orange-100 text-orange-700', icon: Clock },
  rejected: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-700', icon: XCircle },
}

export default function AdminTaskMonitor() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const fetchTasks = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          links: link_id (url, title, link_type),
          task_owner: user_id (username, email, full_name),
          assignee: assigned_to_user_id (username, email, full_name)
        `)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setTasks(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [statusFilter, page])

  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      task.links?.title?.toLowerCase().includes(q) ||
      task.task_owner?.username?.toLowerCase().includes(q) ||
      task.assignee?.username?.toLowerCase().includes(q)
    )
  })

  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: 'all', label: 'All' },
          { key: 'available', label: 'Available' },
          { key: 'assigned', label: 'Assigned' },
          { key: 'completed', label: 'Completed' },
          { key: 'verified', label: 'Verified' },
          { key: 'rejected', label: 'Failed' },
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => { setStatusFilter(filter.key); setPage(0) }}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition border ${
              statusFilter === filter.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by link title, owner, or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={fetchTasks}
          className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No tasks found matching your criteria.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Link / Task</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Assigned To</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.map(task => {
                  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.available
                  const StatusIcon = config.icon
                  return (
                    <tr key={task.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">
                          {task.links?.title || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">
                          {task.links?.url}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium capitalize">
                          {task.task_type === 'click' ? <MousePointer size={12} /> : <Eye size={12} />}
                          {task.task_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{task.task_owner?.username || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{task.assignee?.username || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.color}`}>
                          <StatusIcon size={12} />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(task.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page + 1}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={filteredTasks.length < PAGE_SIZE}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
