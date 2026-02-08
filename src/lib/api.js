import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function callEdgeFunction(functionName, action, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...body }),
  })

  const data = await res.json()
  if (!res.ok && !data.status) throw new Error(data.error || 'Request failed')
  return data
}

export const API = {
  // Auth
  signUp: async (email, password, username, fullName) => {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: fullName
        }
      }
    })

    if (signUpError) throw signUpError

    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: signUpData.user.id,
        email,
        username,
        full_name: fullName,
        credits: 150,
        tier: 'free',
        tier_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })

    if (profileError) throw profileError

    return signUpData.user
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  },

  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  },

  // User profile
  getUserProfile: async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return null

      const meta = authUser.user_metadata || {}
      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: authUser.email,
          username: meta.username || authUser.email.split('@')[0],
          full_name: meta.full_name || '',
          credits: 150,
          tier: 'free'
        })
        .select()
        .maybeSingle()

      if (insertError) throw insertError
      return newProfile
    }

    return data
  },

  updateUserProfile: async (userId, updates) => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .maybeSingle()

    if (error) throw error
    return data
  },

  // Links
  submitLink: async (userId, link) => {
    const { data, error } = await supabase
      .from('links')
      .insert({
        user_id: userId,
        url: link.url,
        link_type: link.type,
        title: link.title,
        description: link.description,
        target_engagement: link.targetEngagement,
        target_unit: link.targetUnit,
        credits_spent: link.creditsSpent
      })
      .select()
      .maybeSingle()

    if (error) throw error

    // Create tasks for this link
    await API.generateTasksForLink(data.id, userId, link.targetEngagement)

    // Deduct credits
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -link.creditsSpent,
        transaction_type: 'spent',
        description: `Submitted link: ${link.title}`,
        related_link_id: data.id
      })

    // Update user credits
    const userProfile = await API.getUserProfile(userId)
    await supabase
      .from('users')
      .update({
        credits: userProfile.credits - link.creditsSpent,
        total_spent_credits: userProfile.total_spent_credits + link.creditsSpent,
        submitted_links_count: userProfile.submitted_links_count + 1
      })
      .eq('id', userId)

    return data
  },

  getUserLinks: async (userId, limit = 10, offset = 0) => {
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data || []
  },

  // Tasks
  generateTasksForLink: async (linkId, userId, count) => {
    const taskTypes = ['click', 'view']
    const tasks = Array.from({ length: count }, (_, i) => ({
      link_id: linkId,
      user_id: userId,
      task_type: taskTypes[i % taskTypes.length],
      credit_reward: 1,
      priority_score: 50 + Math.floor(Math.random() * 50)
    }))

    const { error } = await supabase.from('tasks').insert(tasks)
    if (error) throw error
  },

  getAvailableTasks: async (userId, limit = 10, offset = 0) => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        links: link_id (
          url,
          title,
          link_type,
          description
        ),
        task_owner: user_id (
          username
        )
      `)
      .eq('status', 'available')
      .neq('user_id', userId)
      .is('assigned_to_user_id', null)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data || []
  },

  completeTask: async (userId, taskId, proof) => {
    // Record completion
    const { data: completion, error: completionError } = await supabase
      .from('task_completions')
      .insert({
        task_id: taskId,
        user_id: userId,
        proof_type: proof.type,
        proof_url: proof.url,
        credits_earned: 1,
        verified: proof.type === 'auto_verified'
      })
      .select()
      .maybeSingle()

    if (completionError) throw completionError

    // Update task status
    await supabase
      .from('tasks')
      .update({
        status: 'completed',
        assigned_to_user_id: userId,
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId)

    // Add credits
    const userProfile = await API.getUserProfile(userId)
    await supabase
      .from('users')
      .update({
        credits: userProfile.credits + 1,
        total_earned_credits: userProfile.total_earned_credits + 1,
        completed_tasks_count: userProfile.completed_tasks_count + 1
      })
      .eq('id', userId)

    // Record transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: 1,
        transaction_type: 'earned',
        description: 'Completed task',
        related_task_id: taskId
      })

    return completion
  },

  getCreditTransactions: async (userId, limit = 20, offset = 0) => {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data || []
  },

  getPayments: async (userId) => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  createPendingPayment: async (userId, packageInfo) => {
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount_naira: packageInfo.priceNaira,
        credits_purchased: packageInfo.credits,
        payment_method: 'card',
        provider: 'paystack',
        provider_reference: packageInfo.reference,
        status: 'pending'
      })
      .select()
      .maybeSingle()

    if (paymentError) throw paymentError
    return payment
  },

  completePaystackPayment: async (userId, paymentInfo) => {
    const { error: updatePaymentError } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        provider_reference: paymentInfo.reference,
        completed_at: new Date().toISOString()
      })
      .eq('id', paymentInfo.paymentId)
      .eq('user_id', userId)

    if (updatePaymentError) throw updatePaymentError

    const profile = await API.getUserProfile(userId)
    const newBalance = (Number(profile.credits) || 0) + paymentInfo.credits

    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newBalance })
      .eq('id', userId)

    if (updateError) throw updateError

    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: paymentInfo.credits,
        transaction_type: 'purchase',
        description: `Purchased ${paymentInfo.credits} credits - ${paymentInfo.label} (Paystack)`,
        balance_before: Number(profile.credits) || 0,
        balance_after: newBalance
      })

    return { success: true }
  },

  startTaskAttempt: async (taskId) => {
    return callEdgeFunction('task-verify', 'start', { task_id: taskId })
  },

  verifyTaskAttempt: async (taskId, attemptId) => {
    return callEdgeFunction('task-verify', 'verify', { task_id: taskId, attempt_id: attemptId })
  },

  getTaskAttemptStatus: async (taskId) => {
    return callEdgeFunction('task-verify', 'status', { task_id: taskId })
  }
}
