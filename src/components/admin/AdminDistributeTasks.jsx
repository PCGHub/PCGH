import { useState, useEffect } from 'react'
import { Send, Users, Link as LinkIcon, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AdminDistributeTasks() {
  const [users, setUsers] = useState([])
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    mode: 'new',
    selectedLink: '',
    selectedUsers: [],
    taskType: 'click',
    creditReward: 1,
    description: '',
    instructions: '',
    newLinkUrl: '',
    newLinkTitle: '',
    newLinkType: 'website',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, linksRes] = await Promise.all([
          supabase.from('users').select('id, username, email, full_name, is_active').order('username'),
          supabase.from('links').select('id, title, url, link_type, user_id').eq('status', 'active').order('created_at', { ascending: false }),
        ])
        if (usersRes.error) throw usersRes.error
        if (linksRes.error) throw linksRes.error
        setUsers(usersRes.data || [])
        setLinks(linksRes.data || [])
      } catch (err) {
        setError('Failed to load data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const toggleUser = (userId) => {
    setForm(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }))
  }

  const selectAllUsers = () => {
    if (form.selectedUsers.length === users.length) {
      setForm(prev => ({ ...prev, selectedUsers: [] }))
    } else {
      setForm(prev => ({ ...prev, selectedUsers: users.map(u => u.id) }))
    }
  }

  const handleDistribute = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.selectedUsers.length === 0) {
      setError('Select at least one user')
      return
    }

    setSubmitting(true)
    try {
      let linkId = form.selectedLink

      if (form.mode === 'new') {
        if (!form.newLinkUrl || !form.newLinkTitle) {
          setError('Please provide link URL and title')
          setSubmitting(false)
          return
        }

        const { data: { user: adminUser } } = await supabase.auth.getUser()

        const { data: newLink, error: linkError } = await supabase
          .from('links')
          .insert({
            user_id: adminUser.id,
            url: form.newLinkUrl,
            title: form.newLinkTitle,
            link_type: form.newLinkType,
            description: form.description,
            target_engagement: form.selectedUsers.length,
            target_unit: form.taskType === 'click' ? 'clicks' : 'views',
            credits_spent: 0,
          })
          .select()
          .maybeSingle()

        if (linkError) throw linkError
        linkId = newLink.id
      }

      if (!linkId) {
        setError('Please select or create a link')
        setSubmitting(false)
        return
      }

      const { data: { user: adminUser } } = await supabase.auth.getUser()

      const tasks = form.selectedUsers.map(userId => ({
        link_id: linkId,
        user_id: adminUser.id,
        task_type: form.taskType,
        description: form.description,
        instructions: form.instructions,
        credit_reward: form.creditReward,
        assigned_to_user_id: userId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        priority_score: 90,
      }))

      const { error: taskError } = await supabase.from('tasks').insert(tasks)
      if (taskError) throw taskError

      setSuccess(`Distributed ${tasks.length} task(s) to ${form.selectedUsers.length} user(s)`)
      setForm(prev => ({
        ...prev,
        selectedUsers: [],
        description: '',
        instructions: '',
        newLinkUrl: '',
        newLinkTitle: '',
        selectedLink: '',
      }))
    } catch (err) {
      setError(err.message || 'Failed to distribute tasks')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleDistribute} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <LinkIcon size={18} />
            Task Link
          </h3>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, mode: 'new' }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                form.mode === 'new'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Create New Link
            </button>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, mode: 'existing' }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                form.mode === 'existing'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Use Existing Link
            </button>
          </div>

          {form.mode === 'new' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                <input
                  type="url"
                  value={form.newLinkUrl}
                  onChange={(e) => setForm(prev => ({ ...prev, newLinkUrl: e.target.value }))}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Title</label>
                <input
                  type="text"
                  value={form.newLinkTitle}
                  onChange={(e) => setForm(prev => ({ ...prev, newLinkTitle: e.target.value }))}
                  placeholder="Task title"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Type</label>
                <select
                  value={form.newLinkType}
                  onChange={(e) => setForm(prev => ({ ...prev, newLinkType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="website">Website</option>
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                  <option value="blog">Blog</option>
                  <option value="app">App</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Existing Link</label>
              <select
                value={form.selectedLink}
                onChange={(e) => setForm(prev => ({ ...prev, selectedLink: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select a link --</option>
                {links.map(link => (
                  <option key={link.id} value={link.id}>
                    {link.title} ({link.link_type}) - {link.url.substring(0, 40)}...
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Task Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
              <select
                value={form.taskType}
                onChange={(e) => setForm(prev => ({ ...prev, taskType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="click">Click</option>
                <option value="view">View</option>
                <option value="social_follow">Follow</option>
                <option value="social_like">Like</option>
                <option value="social_comment">Comment</option>
                <option value="share">Share</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Reward</label>
              <input
                type="number"
                min="1"
                max="100"
                value={form.creditReward}
                onChange={(e) => setForm(prev => ({ ...prev, creditReward: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of what users need to do"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder="Detailed instructions for completing this task..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users size={18} />
              Assign To Users ({form.selectedUsers.length} selected)
            </h3>
            <button
              type="button"
              onClick={selectAllUsers}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {form.selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
            {users.map(user => (
              <label
                key={user.id}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition hover:bg-gray-50 ${
                  form.selectedUsers.includes(user.id) ? 'bg-blue-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.selectedUsers.includes(user.id)}
                  onChange={() => toggleUser(user.id)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{user.username}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || form.selectedUsers.length === 0}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader size={18} className="animate-spin" />
              Distributing...
            </>
          ) : (
            <>
              <Send size={18} />
              Distribute Tasks to {form.selectedUsers.length} User(s)
            </>
          )}
        </button>
      </form>
    </div>
  )
}
