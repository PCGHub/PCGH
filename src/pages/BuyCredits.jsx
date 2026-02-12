import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, Check, Loader, AlertCircle, Sparkles, Zap, Crown, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { initFlutterwavePayment } from '../lib/flutterwave'

const CREDIT_PACKAGES = [
  {
    id: 'starter',
    label: 'Starter Pack',
    credits: 500,
    priceNaira: 1000,
    icon: Zap,
    color: 'from-sky-500 to-blue-600',
    borderColor: 'border-blue-200 hover:border-blue-400',
    popular: false,
    plan: 'starter_pack', // <-- must match your backend PLAN_MAP
  },
  {
    id: 'growth',
    label: 'Growth Pack',
    credits: 1000,
    priceNaira: 1800,
    icon: Sparkles,
    color: 'from-emerald-500 to-teal-600',
    borderColor: 'border-emerald-200 hover:border-emerald-400',
    popular: true,
    plan: 'growth_pack', // <-- must match your backend PLAN_MAP
  },
  {
    id: 'pro',
    label: 'Pro Pack',
    credits: 2500,
    priceNaira: 4000,
    icon: Crown,
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-200 hover:border-amber-400',
    popular: false,
    plan: 'pro_pack', // <-- you already use this in PowerShell test
  }
]

export default function BuyCredits() {
  const navigate = useNavigate()
  const [userCredits, setUserCredits] = useState(0)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(null)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          setLoading(false)
          return
        }

        setUserId(session.user.id)
        setUserEmail(session.user.email || '')

        const { data: profile } = await supabase
          .from('users')
          .select('credits, full_name, name, username')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profile) {
          setUserCredits(Number(profile.credits) || 0)

          // pick the first available name field
          const n =
            profile.full_name ||
            profile.name ||
            profile.username ||
            'PCGH User'
          setUserName(n)
        }
      } catch (err) {
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handlePurchase = async (pkg) => {
    if (!userId || !userEmail) {
      setError('You must be logged in to purchase credits.')
      return
    }

    setPurchasing(pkg.id)
    setError('')
    setSuccess(null)

    try {
      // 1) ask backend to create hosted payment + return link
      const { link } = await initFlutterwavePayment({
        plan: pkg.plan,     // IMPORTANT: must match server PLAN_MAP keys
        user_id: userId,
        email: userEmail,
        name: userName || 'PCGH User',
      })

      // 2) redirect user to Flutterwave hosted checkout
      window.location.href = link
    } catch (err) {
      setError(err?.message || 'Failed to initialize payment. Please try again.')
      setPurchasing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900">Buy Credits</h1>
          <p className="text-gray-600 mt-3 text-lg">
            Power up your growth with more credits
          </p>

          {userId && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-5 py-2.5 shadow-sm">
              <Coins className="w-5 h-5 text-amber-500" />
              <span className="text-gray-700">Current balance:</span>
              <span className="font-bold text-gray-900 text-lg">{userCredits}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="max-w-md mx-auto mb-8 p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-emerald-800">Payment Successful</p>
                <p className="text-emerald-700 text-sm">
                  {success.credits} credits added to your account
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="mt-4 w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CREDIT_PACKAGES.map((pkg) => {
            const Icon = pkg.icon
            return (
              <div
                key={pkg.id}
                className={`relative bg-white rounded-2xl border-2 ${pkg.borderColor} shadow-sm transition-all duration-200 overflow-hidden ${
                  pkg.popular ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
                }`}
              >
                {pkg.popular && (
                  <div className="bg-emerald-500 text-white text-xs font-bold text-center py-1.5 tracking-wide uppercase">
                    Most Popular
                  </div>
                )}

                <div className="p-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900">{pkg.label}</h3>

                  <div className="mt-4 mb-1">
                    <span className="text-4xl font-bold text-gray-900">
                      {'\u20A6'}{pkg.priceNaira.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mb-6">Nigerian Naira</p>

                  <div className="flex items-center gap-2 mb-6 py-3 px-4 bg-gray-50 rounded-lg">
                    <Coins className="w-5 h-5 text-amber-500" />
                    <span className="text-gray-900 font-semibold text-lg">{pkg.credits.toLocaleString()}</span>
                    <span className="text-gray-600 text-sm">credits</span>
                  </div>

                  <ul className="space-y-2.5 mb-6 text-sm text-gray-700">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      {pkg.credits.toLocaleString()} engagement actions
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      Instant delivery
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      No expiry
                    </li>
                  </ul>

                  <button
                    onClick={() => handlePurchase(pkg)}
                    disabled={purchasing !== null}
                    className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 ${
                      pkg.popular
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {purchasing === pkg.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader className="w-4 h-4 animate-spin" />
                        Redirecting...
                      </span>
                    ) : (
                      `Pay ${'\u20A6'}${pkg.priceNaira.toLocaleString()}`
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Secured by Flutterwave</span>
          </div>
          <p>Credits are added after payment verification. All purchases are final.</p>
        </div>
      </div>
    </div>
  )
}
