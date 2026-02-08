import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Clock, XCircle, ExternalLink, Link as LinkIcon } from 'lucide-react'
import { API } from '../lib/api'
import Pagination from '../components/Pagination'
import { CardSkeleton } from '../components/Skeleton'

const PAGE_SIZE = 10

const statusConfig = {
  active: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', label: 'Active' },
  completed: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', label: 'Completed' },
  expired: { icon: XCircle, color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200', label: 'Expired' }
}

export default function MyLinks() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [page, setPage] = useState(0)

  const fetchLinks = useCallback(async (userId, pageNum) => {
    try {
      const userLinks = await API.getUserLinks(userId, PAGE_SIZE, pageNum * PAGE_SIZE)
      setLinks(userLinks)
    } catch (err) {
      console.error('Error fetching links:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const user = await API.getCurrentUser()
        setCurrentUser(user)
        await fetchLinks(user.id, 0)
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }
    init()
  }, [fetchLinks])

  useEffect(() => {
    if (currentUser) {
      setLoading(true)
      fetchLinks(currentUser.id, page)
    }
  }, [page, currentUser, fetchLinks])

  if (loading && links.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="h-9 w-40 bg-gray-200 rounded-lg animate-pulse mb-2" />
            <div className="h-5 w-72 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">My Links</h1>
        <p className="text-gray-500 mb-8">Track the performance of your submitted links</p>

        {links.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LinkIcon className="text-gray-400" size={28} />
            </div>
            <p className="text-gray-600 text-lg font-medium">No links submitted yet</p>
            <p className="text-gray-400 text-sm mt-2">Submit your first link to start getting engagement.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {links.map((link) => {
                const config = statusConfig[link.status] || statusConfig.active
                const StatusIcon = config.icon
                const progress = link.target_engagement > 0
                  ? Math.min(100, Math.round((link.current_engagement / link.target_engagement) * 100))
                  : 0
                const isExpired = link.status === 'expired' || (link.expires_at && new Date(link.expires_at) < new Date())

                return (
                  <div
                    key={link.id}
                    className={`bg-white rounded-xl p-6 border transition-all duration-200 hover:shadow-md ${
                      isExpired ? 'border-gray-200 opacity-75' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`px-2.5 py-1 text-sm font-medium rounded-lg flex items-center gap-1.5 border ${config.bgColor}`}>
                            <StatusIcon size={14} className={config.color} />
                            <span className={config.color}>{config.label}</span>
                          </span>
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium capitalize">
                            {link.link_type}
                          </span>
                        </div>

                        <h3 className="font-semibold text-gray-900 text-lg">{link.title || 'Untitled Link'}</h3>
                        {link.description && (
                          <p className="text-gray-500 text-sm mt-1 line-clamp-2">{link.description}</p>
                        )}
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm mt-2 hover:underline"
                        >
                          <ExternalLink size={12} />
                          {link.url.length > 50 ? link.url.substring(0, 50) + '...' : link.url}
                        </a>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-medium text-gray-600">Progress</p>
                          <p className="text-sm font-bold text-gray-900">
                            {link.current_engagement} / {link.target_engagement}
                          </p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-700 ease-out ${
                              progress === 100
                                ? 'bg-green-500'
                                : 'bg-gradient-to-r from-blue-500 to-emerald-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">{progress}% complete</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white px-3 py-2 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-500">Credits Spent</p>
                          <p className="font-semibold text-gray-900">{link.credits_spent}</p>
                        </div>
                        <div className="bg-white px-3 py-2 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-500">Engagement</p>
                          <p className="font-semibold text-gray-900 capitalize">{link.target_unit}</p>
                        </div>
                        <div className="bg-white px-3 py-2 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-500">Created</p>
                          <p className="font-semibold text-gray-900 text-sm">
                            {new Date(link.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="bg-white px-3 py-2 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-500">Expires</p>
                          <p className={`font-semibold text-sm ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                            {link.expires_at
                              ? new Date(link.expires_at).toLocaleDateString()
                              : 'No expiry'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              itemCount={links.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
