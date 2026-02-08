const TOTAL_SECONDS = 30

export default function CountdownTimer({ elapsed }) {
  const remaining = Math.max(0, TOTAL_SECONDS - (elapsed || 0))
  const progress = Math.min(1, (elapsed || 0) / TOTAL_SECONDS)
  const isComplete = remaining === 0

  const radius = 22
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
          <circle
            cx="26"
            cy="26"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="4"
          />
          <circle
            cx="26"
            cy="26"
            r={radius}
            fill="none"
            stroke={isComplete ? '#22c55e' : '#3b82f6'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${isComplete ? 'text-green-600' : 'text-gray-900'}`}>
            {remaining}s
          </span>
        </div>
      </div>
      <div className="min-w-0">
        {isComplete ? (
          <p className="text-sm font-semibold text-green-700">Ready to verify</p>
        ) : (
          <p className="text-sm font-medium text-gray-600">
            Wait {remaining}s before verifying
          </p>
        )}
        <div className="w-32 bg-gray-200 rounded-full h-1.5 mt-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-1000 ease-linear ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
