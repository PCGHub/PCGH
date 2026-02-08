import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import TaskFeed from './pages/TaskFeed'
import SubmitLink from './pages/SubmitLink'
import MyLinks from './pages/MyLinks'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import AdminLogin from './pages/AdminLogin'
import BuyCredits from './pages/BuyCredits'
import AdsManager from './pages/AdsManager'
import Navbar from './components/Navbar'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50">Loading...</div>

  return (
    <BrowserRouter>
      {session && <Navbar />}
      <Routes>
        {!session ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<TaskFeed />} />
            <Route path="/submit" element={<SubmitLink />} />
            <Route path="/links" element={<MyLinks />} />
            <Route path="/ads" element={<AdsManager />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/buy-credits" element={<BuyCredits />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
