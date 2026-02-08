import { useState, useEffect, useRef, useCallback } from 'react'
import { AlertCircle, CheckCircle, ExternalLink, XCircle, RotateCcw, ShieldCheck, Loader } from 'lucide-react'
import { API } from '../lib/api'
import Pagination from '../components/Pagination'
import { CardSkeleton } from '../components/Skeleton'

const BUTTON_DISABLE_SECONDS = 30
const PAGE_SIZE = 10

export default function TaskFeed() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [taskStates, setTaskStates] = useState({})
  const [page, setPage] = useState(0)
  const timerRefs = useRef({})

  const fetchTasks = useCallback(async (userId, pageNum) => {
    try {
      const availableTasks = await API.getAvailableTasks(userId, PAGE_SIZE, pageNum * PAGE_SIZE)
      setTasks(availableTasks)
    } catch (err) {
      setError('Failed to load tasks')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const user = await API.getCurrentUser()
        setCurrentUser(user)
        await fetchTasks(user.id, page)
      } catch (err) {
        setError('Failed to load tasks')
        console.error(err)
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (currentUser) {
      setLoading(true)
      fetchTasks(currentUser.id, page)
    }
  }, [page, currentUser, fetchTasks])

  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach(clearInterval)
    }
  }, [])

  const updateTaskState = useCallback((taskId, updates) => {
    setTaskStates(prev => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), ...updates }
    }))
  }, [])

  const startTimer = useCallback((taskId) => {
    if (timerRefs.current[taskId]) clearInterval(timerRefs.current[taskId])
    timerRefs.current[taskId] = setInterval(() => {
      setTaskStates(prev => {
        const current = prev[taskId]
        if (!current || current.phase !== 'visiting') return prev
        return {
          ...prev,
          [taskId]: { ...current, elapsed: (current.elapsed || 0) + 1 }
        }
      })
    }, 1000)
  }, [])

  const stopTimer = useCallback((taskId) => {
    if (timerRefs.current[taskId]) {
      clearInterval(timerRefs.current[taskId])
      delete timerRefs.current[taskId]
    }
  }, [])

  const handleStartTask = async (task) => {
    updateTaskState(task.id, { phase: 'starting', error: null })

    try {
      const result = await API.startTaskAttempt(task.id)

      if (result.status === 'locked') {
        updateTaskState(task.id, {
          phase: 'locked',
          message: result.message,
          attemptsLeft: 0,
        })
        return
      }

      updateTaskState(task.id, {
        phase: 'visiting',
        attemptId: result.attempt_id,
        attemptNumber: result.attempt_number,
        attemptsLeft: result.attempts_left,
        elapsed: 0,
        error: null,
      })

      startTimer(task.id)

      if (task.links?.url) {
        window.open(task.links.url, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      console.error(err)
      updateTaskState(task.id, { phase: 'ready', error: 'Failed to start task. Try again.' })
    }
  }

  const handleVerifyTask = async (task) => {
    const state = taskStates[task.id]
    if (!state?.attemptId) return

    stopTimer(task.id)
    updateTaskState(task.id, { phase: 'verifying' })

    try {
      const result = await API.verifyTaskAttempt(task.id, state.attemptId)

      if (result.status === 'completed') {
        setTasks(prev => prev.filter(t => t.id !== task.id))
        updateTaskState(task.id, { phase: 'completed' })
        setSuccessMessage('Task completed! You earned 1 credit.')
        setTimeout(() => setSuccessMessage(''), 4000)
        return
      }

      if (result.status === 'locked') {
        updateTaskState(task.id, {
          phase: 'locked',
          message: result.message,
          durationSeconds: result.duration_seconds,
          attemptsLeft: 0,
        })
        return
      }

      if (result.status === 'failed') {
        updateTaskState(task.id, {
          phase: 'failed',
          message: result.message,
          durationSeconds: result.duration_seconds,
          attemptsLeft: result.attempts_left,
          attemptId: null,
        })
        return
      }
    } catch (err) {
      console.error(err)
      updateTaskState(task.id, {
        phase: 'visiting',
        error: 'Verification failed. Try clicking Verify again.',
      })
      startTimer(task.id)
    }
  }

  const getTaskPhase = (taskId) => taskStates[taskId]?.phase || 'ready'

  if (loading && tasks.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="h-9 w-56 bg-gray-200 rounded-lg animate-pulse mb-2" />
            <div className="h-5 w-80 bg-gray-200 rounded-lg animate-pulse" />
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
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Available Tasks</h1>
        <p className="text-gray-500 mb-8">Help others and earn credits. Each task gives you 1 credit.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex gap-3 items-start animate-fade-in">
            <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-green-700 text-sm font-medium">{successMessage}</p>
          </div>
        )}

        {tasks.length === 0 && !loading ? (
          <div className="bg-white rounded-xl p-16 text-center border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-gray-400" size={28} />
            </div>
            <p className="text-gray-600 text-lg font-medium">No tasks available right now</p>
            <p className="text-gray-400 text-sm mt-2">Check back soon -- new tasks are added regularly.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {tasks.map((task) => {
                const phase = getTaskPhase(task.id)
                const state = taskStates[task.id] || {}

                return (
                  <div
                    key={task.id}
                    className={`bg-white rounded-xl p-6 border transition-all duration-300 ${
                      phase === 'visiting'
                        ? 'border-blue-300 shadow-md ring-1 ring-blue-100'
                        : phase === 'locked'
                        ? 'border-gray-300 opacity-60'
                        : 'border-gray-200 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold capitalize">
                        {task.task_type}
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-semibold">
                        +{task.credit_reward} credit
                      </span>
                      {task.links?.link_type && (
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium capitalize">
                          {task.links.link_type}
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 text-lg">{task.links?.title || 'Task'}</h3>
                    {(task.links?.description || task.description) && (
                      <p className="text-gray-500 text-sm mt-1.5 line-clamp-2">
                        {task.links?.description || task.description}
                      </p>
                    )}

                    {task.instructions && (
                      <div className="bg-gray-50 rounded-lg p-3 mt-3 border border-gray-100">
                        <p className="text-sm text-gray-700">{task.instructions}</p>
                      </div>
                    )}

                    {phase === 'visiting' && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-sm text-blue-700 text-center">
                          Visit the link and stay for at least 30 seconds, then come back and click Verify.
                        </p>
                      </div>
                    )}

                    {phase === 'failed' && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-2">
                          <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-red-700">Task failed</p>
                            <p className="text-sm text-red-600 mt-0.5">{state.message}</p>
                            {state.attemptsLeft > 0 && (
                              <p className="text-xs text-red-500 mt-1.5 font-medium">
                                You have {state.attemptsLeft} more attempt.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {phase === 'locked' && (
                      <div className="mt-4 p-3 bg-gray-100 border border-gray-200 rounded-xl">
                        <div className="flex items-start gap-2">
                          <XCircle size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Task unavailable</p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {state.message || 'You have used both attempts for this task.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {state.error && phase !== 'locked' && phase !== 'failed' && (
                      <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-600">{state.error}</p>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-gray-400 text-xs">
                        By <span className="font-medium text-gray-500">{task.task_owner?.username || 'Unknown'}</span>
                      </p>

                      <TaskButton
                        phase={phase}
                        elapsed={state.elapsed || 0}
                        taskUrl={task.links?.url}
                        onStart={() => handleStartTask(task)}
                        onVerify={() => handleVerifyTask(task)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              itemCount={tasks.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}

function TaskButton({ phase, elapsed, taskUrl, onStart, onVerify }) {
  if (phase === 'starting') {
    return (
      <button disabled className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg opacity-50 text-sm">
        <Loader className="animate-spin" size={16} />
        Starting...
      </button>
    )
  }

  if (phase === 'visiting') {
    const timerComplete = (elapsed || 0) >= BUTTON_DISABLE_SECONDS

    return (
      <div className="flex items-center gap-2">
        {!timerComplete && (
          <button
            onClick={() => {
              if (taskUrl) window.open(taskUrl, '_blank', 'noopener,noreferrer')
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition text-sm"
          >
            <ExternalLink size={14} />
            Re-visit Link
          </button>
        )}
        <button
          onClick={timerComplete ? onVerify : undefined}
          className={`inline-flex items-center gap-1.5 px-5 py-2.5 font-medium rounded-lg text-sm transition-all duration-300 ${
            timerComplete
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 animate-pulse-once'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ShieldCheck size={16} />
          {timerComplete ? 'Verify & Claim' : 'Waiting...'}
        </button>
      </div>
    )
  }

  if (phase === 'verifying') {
    return (
      <button disabled className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg opacity-50 text-sm">
        <Loader className="animate-spin" size={16} />
        Verifying...
      </button>
    )
  }

  if (phase === 'locked') {
    return (
      <button disabled className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-200 text-gray-400 font-medium rounded-lg cursor-not-allowed text-sm">
        <XCircle size={16} />
        Unavailable
      </button>
    )
  }

  if (phase === 'failed') {
    return (
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition text-sm"
      >
        <RotateCcw size={16} />
        Try Again
      </button>
    )
  }

  return (
    <button
      onClick={onStart}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 hover:shadow-lg transition text-sm"
    >
      Start Task
      <ExternalLink size={16} />
    </button>
  )
}
