import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, pageSize, itemCount, onPageChange }) {
  const hasNext = itemCount === pageSize
  const hasPrev = page > 0

  if (!hasNext && !hasPrev) return null

  return (
    <div className="flex items-center justify-between mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
        Previous
      </button>
      <span className="text-sm text-gray-500">Page {page + 1}</span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
