export function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <SkeletonBlock className="h-6 w-16" />
        <SkeletonBlock className="h-6 w-20" />
      </div>
      <SkeletonBlock className="h-5 w-3/4 mb-3" />
      <SkeletonBlock className="h-4 w-1/2 mb-4" />
      <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  )
}

export function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <SkeletonBlock className="h-4 w-24 mb-3" />
      <SkeletonBlock className="h-8 w-16" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonBlock className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}
