import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Loader, Wallet, Info } from 'lucide-react'
import { API } from '../lib/api'
import { StatSkeleton } from '../components/Skeleton'

const COMMISSION_RATE = 0.2

export default function SubmitLink() {
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    type: 'website',
    targetEngagement: 50,
    targetUnit: 'clicks'
  })
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await API.getCurrentUser()
        setCurrentUser(user)
        const profile = await API.getUserProfile(user.id)
        setUserProfile(profile)
      } catch (err) {
        console.error(err)
      } finally {
        setPageLoading(false)
      }
    }
    fetchUser()
  }, [])

  const baseCost = formData.targetEngagement
  const commission = Math.ceil(baseCost * COMMISSION_RATE)
  const totalCost = baseCost + commission
  const canAfford = userProfile && userProfile.credits >= totalCost

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: name === 'targetEngagement' ? Math.max(1, parseInt(value) || 0) : value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.url.trim()) {
      setError('Please enter a valid URL')
      return
    }

    if (!formData.title.trim()) {
      setError('Please enter a title for your link')
      return
    }

    if (!canAfford) {
      setError(`You need ${totalCost} credits but only have ${userProfile.credits}`)
      return
    }

    setLoading(true)

    try {
      await API.submitLink(currentUser.id, {
        url: formData.url,
        type: formData.type,
        title: formData.title,
        description: formData.description,
        targetEngagement: formData.targetEngagement,
        targetUnit: formData.targetUnit,
        creditsSpent: totalCost
      })

      setSuccess(`Link submitted! ${formData.targetEngagement} tasks will be created for real users to complete.`)
      setFormData({
        url: '',
        title: '',
        description: '',
        type: 'website',
        targetEngagement: 50,
        targetUnit: 'clicks'
      })

      const updatedProfile = await API.getUserProfile(currentUser.id)
      setUserProfile(updatedProfile)

      setTimeout(() => setSuccess(''), 6000)
    } catch (err) {
      setError(err.message || 'Failed to submit link')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-9 w-48 bg-gray-200 rounded-lg animate-pulse mb-2" />
          <div className="h-5 w-72 bg-gray-200 rounded-lg animate-pulse mb-8" />
          <StatSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Submit Link</h1>
        <p className="text-gray-500 mb-8">Get real engagement from real people</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start animate-fade-in">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex gap-3 items-start animate-fade-in">
            <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-green-700 text-sm font-medium">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Wallet className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Available Credits</p>
              <p className="text-lg font-bold text-gray-900">{userProfile?.credits || 0}</p>
            </div>
          </div>
          {!canAfford && formData.targetEngagement > 0 && (
            <span className="text-xs text-red-600 font-medium bg-red-50 px-3 py-1.5 rounded-lg">
              Insufficient credits
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 border border-gray-200 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Link Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="website">Website / Blog</option>
              <option value="youtube">YouTube Video</option>
              <option value="tiktok">TikTok Video</option>
              <option value="app">App Store Link</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">URL</label>
            <input
              type="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              placeholder="https://example.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="My Awesome Blog Post"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of what users should see or do..."
              rows="3"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Engagement</label>
              <input
                type="number"
                name="targetEngagement"
                value={formData.targetEngagement}
                onChange={handleChange}
                min="1"
                max="5000"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">How many people should engage</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Engagement Type</label>
              <select
                name="targetUnit"
                value={formData.targetUnit}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="clicks">Clicks</option>
                <option value="views">Views</option>
                <option value="installs">App Installs</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Info size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-700">Cost Breakdown</p>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Base cost ({formData.targetEngagement} engagements)</span>
              <span className="text-gray-900 font-medium">{baseCost} credits</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Platform fee (20%)</span>
              <span className="text-gray-900 font-medium">{commission} credits</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-semibold">Total</span>
              <span className={`font-bold ${canAfford ? 'text-gray-900' : 'text-red-600'}`}>
                {totalCost} credits
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !canAfford}
            className="w-full bg-gray-900 text-white font-medium py-3 rounded-xl hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {loading && <Loader size={16} className="animate-spin" />}
            {loading ? 'Submitting...' : `Submit Link -- ${totalCost} Credits`}
          </button>
        </form>
      </div>
    </div>
  )
}
