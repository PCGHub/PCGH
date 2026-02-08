import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, CheckCircle, ArrowUpRight, ArrowDownRight, Wallet, Star, Mail, Shield } from 'lucide-react'
import { API } from '../lib/api'
import Pagination from '../components/Pagination'
import { StatSkeleton } from '../components/Skeleton'

const TXN_PAGE_SIZE = 15

export default function Profile() {
  const [user, setUser] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({ full_name: '', username: '' })
  const [txnPage, setTxnPage] = useState(0)
  const [authUserId, setAuthUserId] = useState(null)

  const fetchTransactions = useCallback(async (userId, pageNum) => {
    try {
      const txns = await API.getCreditTransactions(userId, TXN_PAGE_SIZE, pageNum * TXN_PAGE_SIZE)
      setTransactions(txns || [])
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const authUser = await API.getCurrentUser()
        setAuthUserId(authUser.id)
        const profile = await API.getUserProfile(authUser.id)
        if (!profile) return
        setUser(profile)
        setFormData({ full_name: profile.full_name || '', username: profile.username || '' })
        await fetchTransactions(authUser.id, 0)
      } catch (err) {
        setError('Failed to load profile')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [fetchTransactions])

  useEffect(() => {
    if (authUserId) {
      fetchTransactions(authUserId, txnPage)
    }
  }, [txnPage, authUserId, fetchTransactions])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setUpdating(true)
    setError('')
    setUpdateSuccess(false)

    try {
      const authUser = await API.getCurrentUser()
      await API.updateUserProfile(authUser.id, {
        full_name: formData.full_name,
        username: formData.username
      })
      const updatedProfile = await API.getUserProfile(authUser.id)
      setUser(updatedProfile)
      setUpdateSuccess(true)
      setTimeout(() => setUpdateSuccess(false), 3000)
    } catch (err) {
      setError('Failed to update profile')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-9 w-40 bg-gray-200 rounded-lg animate-pulse mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-4" />
                <div className="space-y-4">
                  <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => <StatSkeleton key={i} />)}
            </div>
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
          <p className="text-gray-700 font-medium">Failed to load profile</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {updateSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex gap-3 items-start">
            <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-green-700 text-sm font-medium">Profile updated successfully.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-4">Edit Profile</h2>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updating}
                  className="w-full bg-gray-900 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 transition disabled:opacity-50 text-sm"
                >
                  {updating ? 'Updating...' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={14} className="text-gray-400" />
                  <p className="text-gray-500 text-xs">Email</p>
                </div>
                <p className="font-semibold text-gray-900">{user.email}</p>
              </div>

              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} className="text-gray-400" />
                  <p className="text-gray-500 text-xs">Tier</p>
                </div>
                <p className="font-semibold text-gray-900 capitalize">{user.tier}</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl p-5 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={14} className="text-blue-100" />
                  <p className="text-blue-100 text-xs">Current Credits</p>
                </div>
                <p className="font-bold text-2xl">{user.credits}</p>
              </div>

              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Star size={14} className="text-gray-400" />
                  <p className="text-gray-500 text-xs">Reputation</p>
                </div>
                <p className="font-semibold text-gray-900 text-lg">{user.reputation_score}</p>
              </div>

              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight size={14} className="text-green-500" />
                  <p className="text-gray-500 text-xs">Total Earned</p>
                </div>
                <p className="font-semibold text-green-600 text-lg">+{user.total_earned_credits}</p>
              </div>

              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight size={14} className="text-red-500" />
                  <p className="text-gray-500 text-xs">Total Spent</p>
                </div>
                <p className="font-semibold text-red-600 text-lg">-{user.total_spent_credits}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-4">Transaction History</h2>

              {transactions.length === 0 ? (
                <p className="text-gray-400 text-sm py-6 text-center">No transactions yet</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {transactions.map((txn) => (
                      <div key={txn.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            txn.amount > 0 ? 'bg-green-50' : 'bg-red-50'
                          }`}>
                            {txn.amount > 0
                              ? <ArrowUpRight size={14} className="text-green-600" />
                              : <ArrowDownRight size={14} className="text-red-600" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{txn.description}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(txn.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        <p className={`font-bold text-sm flex-shrink-0 ml-3 ${
                          txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {txn.amount > 0 ? '+' : ''}{txn.amount}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Pagination
                    page={txnPage}
                    pageSize={TXN_PAGE_SIZE}
                    itemCount={transactions.length}
                    onPageChange={setTxnPage}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
