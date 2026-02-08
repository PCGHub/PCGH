import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShieldCheck, ShieldOff, RefreshCw, Loader, Copy, Check, KeyRound, Eye, EyeOff, Clock, UserCheck, UserX } from 'lucide-react'

function generatePin() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let pin = ''
  for (let i = 0; i < 6; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pin
}

export default function AdminAccessControl() {
  const [users, setUsers] = useState([])
  const [grantedAdmins, setGrantedAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [showPins, setShowPins] = useState({})
  const [changePinUser, setChangePinUser] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState(null)
  const [message, setMessage] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, adminsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, username, email, full_name, is_admin, admin_role')
          .eq('is_admin', false)
          .order('username'),
        supabase
          .from('users')
          .select('id, username, email, full_name, is_admin, admin_role, admin_pin, last_admin_login')
          .eq('is_admin', true)
          .eq('admin_role', 'granted')
          .order('username'),
      ])

      if (usersRes.error) throw usersRes.error
      if (adminsRes.error) throw adminsRes.error

      setUsers(usersRes.data || [])
      setGrantedAdmins(adminsRes.data || [])
    } catch (err) {
      console.error(err)
      showMessage('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleGrant = async (user) => {
    setActionLoading(user.id)
    const pin = generatePin()

    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_admin: true,
          admin_role: 'granted',
          admin_pin: pin,
          last_admin_login: null,
        })
        .eq('id', user.id)

      if (error) throw error

      showMessage(`Access granted to ${user.username}. PIN: ${pin}`)
      await fetchData()
    } catch (err) {
      console.error(err)
      showMessage('Failed to grant access', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevoke = async (user) => {
    setActionLoading(user.id)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_admin: false,
          admin_role: null,
          admin_pin: null,
          last_admin_login: null,
        })
        .eq('id', user.id)

      if (error) throw error

      showMessage(`Access revoked from ${user.username}`)
      setConfirmRevoke(null)
      await fetchData()
    } catch (err) {
      console.error(err)
      showMessage('Failed to revoke access', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleChangePin = async (userId) => {
    if (!newPin || newPin.length < 4) {
      showMessage('PIN must be at least 4 characters', 'error')
      return
    }
    setActionLoading(userId)

    try {
      const { error } = await supabase
        .from('users')
        .update({ admin_pin: newPin })
        .eq('id', userId)

      if (error) throw error

      showMessage('PIN changed successfully')
      setChangePinUser(null)
      setNewPin('')
      await fetchData()
    } catch (err) {
      console.error(err)
      showMessage('Failed to change PIN', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const togglePinVisibility = (id) => {
    setShowPins(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const formatDate = (date) => {
    if (!date) return 'Never'
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
          message.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {message.text}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Granted Admins</h2>
            <p className="text-sm text-gray-500">Users you have given admin access to</p>
          </div>
          <button
            onClick={fetchData}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {grantedAdmins.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <ShieldOff className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500">No one has been granted admin access yet.</p>
            <p className="text-sm text-gray-400 mt-1">Use the section below to grant access to a user.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grantedAdmins.map(admin => (
              <div key={admin.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{admin.username}</p>
                      {admin.last_admin_login ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
                          <UserCheck size={12} />
                          Logged in
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                          <UserX size={12} />
                          Not yet logged in
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{admin.email}</p>
                    {admin.full_name && <p className="text-sm text-gray-500">{admin.full_name}</p>}

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <KeyRound size={14} className="text-gray-400" />
                        <span className="text-sm font-mono text-gray-700">
                          {showPins[admin.id] ? admin.admin_pin : '******'}
                        </span>
                        <button
                          onClick={() => togglePinVisibility(admin.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition"
                        >
                          {showPins[admin.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(admin.admin_pin, admin.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition"
                        >
                          {copiedId === admin.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>

                      {admin.last_admin_login && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={12} />
                          Last login: {formatDate(admin.last_admin_login)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setChangePinUser(changePinUser === admin.id ? null : admin.id)
                        setNewPin('')
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                      Change PIN
                    </button>

                    {confirmRevoke === admin.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRevoke(admin)}
                          disabled={actionLoading === admin.id}
                          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                        >
                          {actionLoading === admin.id ? 'Revoking...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmRevoke(null)}
                          className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRevoke(admin.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>

                {changePinUser === admin.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                    <input
                      type="text"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.toUpperCase())}
                      placeholder="Enter new PIN"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                    <button
                      onClick={() => {
                        const generated = generatePin()
                        setNewPin(generated)
                      }}
                      className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition whitespace-nowrap"
                    >
                      Generate
                    </button>
                    <button
                      onClick={() => handleChangePin(admin.id)}
                      disabled={actionLoading === admin.id || !newPin}
                      className="px-4 py-2 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {actionLoading === admin.id ? 'Saving...' : 'Save PIN'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Grant Admin Access</h2>
          <p className="text-sm text-gray-500">Search for a user and grant them admin access with an auto-generated PIN</p>
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-sm"
          />
        </div>

        {searchQuery && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No matching users found</div>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                  <div>
                    <p className="font-medium text-gray-900">{user.username}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    {user.full_name && <p className="text-xs text-gray-400">{user.full_name}</p>}
                  </div>
                  <button
                    onClick={() => handleGrant(user)}
                    disabled={actionLoading === user.id}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    {actionLoading === user.id ? (
                      <Loader size={14} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={14} />
                    )}
                    {actionLoading === user.id ? 'Granting...' : 'Grant Access'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
