# PCGH Development Guide

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app will open at `http://localhost:5173`

## Environment Setup

The `.env` file already contains Supabase credentials:
- `VITE_SUPABASE_URL` - Database URL
- `VITE_SUPABASE_SUPABASE_ANON_KEY` - Public API key

These are automatically loaded by Vite.

## Project Structure

```
src/
├── components/
│   └── Navbar.jsx          # Navigation component
├── lib/
│   ├── supabase.js         # Supabase client
│   └── api.js              # API functions (auth, tasks, credits)
├── pages/
│   ├── Login.jsx           # Authentication
│   ├── Signup.jsx          # Registration
│   ├── Dashboard.jsx       # Home dashboard
│   ├── TaskFeed.jsx        # Available tasks
│   ├── SubmitLink.jsx      # Submit new link
│   ├── MyLinks.jsx         # View submitted links
│   ├── Profile.jsx         # User profile & settings
│   └── Admin.jsx           # Admin dashboard
├── App.jsx                 # Router setup
├── main.jsx                # Entry point
└── index.css               # Global styles
```

## Key Features Implemented

### 1. Authentication
- Signup with email, password, username
- Login functionality
- Session management
- Auto 20 free credits on signup

**Files:** `Signup.jsx`, `Login.jsx`

### 2. Credit System
- Users earn 1 credit per completed task
- Spend credits to get engagement
- Track all transactions in ledger
- Automatic balance updates

**Files:** `api.js::creditTransactions`, `Profile.jsx`

### 3. Task Distribution
- Tasks shown based on priority score
- Weighted algorithm prevents bot detection
- Staggered distribution over time
- Auto-verification for clicks/views

**Files:** `api.js::getAvailableTasks`, `TaskFeed.jsx`

### 4. Link Submission
- Submit URL with target metrics
- Automatic task generation
- Real-time progress tracking
- Status tracking (active/completed/expired)

**Files:** `SubmitLink.jsx`, `MyLinks.jsx`, `api.js::submitLink`

### 5. Dashboard
- Real-time credit balance
- Task completion stats
- Links submitted count
- Quick action buttons

**Files:** `Dashboard.jsx`

### 6. Admin Panel
- System health metrics
- User statistics
- Task completion rates
- Platform analytics

**Files:** `Admin.jsx`

## How to Use (User Flow)

### As a Task Completer:
1. Sign up (get 20 free credits)
2. Go to /tasks
3. See available tasks
4. Click "Complete Task" (auto-verified)
5. Earn 1 credit
6. Repeat (max 50/day)
7. Credits accumulate in account

### As a Link Submitter:
1. Have credits (earn them or buy later)
2. Go to /submit
3. Enter URL, type, target engagement
4. Confirm cost (auto-calculated)
5. Submit link
6. Track progress in /links
7. Get real engagement from real users

## Database Schema Overview

### Key Tables:

**users**
- id, email, username, full_name
- credits, reputation_score
- tier (free/basic/pro/agency)
- completed_tasks_count, submitted_links_count
- pod_id (for community rotation)

**links**
- id, user_id, url, link_type
- target_engagement, current_engagement
- status (active/completed/expired)
- credits_spent

**tasks**
- id, link_id, user_id, task_type
- status (available/assigned/completed)
- credit_reward, priority_score
- assigned_to_user_id

**task_completions**
- id, task_id, user_id
- proof_type, verified
- credits_earned

**credit_transactions**
- id, user_id, amount
- transaction_type (earned/spent/bonus)
- description, created_at

**user_pods**
- id, pod_number, current_members_count

## API Functions (api.js)

All functions handle errors automatically.

```javascript
// Auth
API.signUp(email, password, username, fullName)
API.signIn(email, password)
API.signOut()

// User
API.getCurrentUser()
API.getUserProfile(userId)
API.updateUserProfile(userId, updates)

// Links
API.submitLink(userId, linkData)
API.getUserLinks(userId)

// Tasks
API.getAvailableTasks(userId, limit)
API.completeTask(userId, taskId, proof)

// Transactions
API.getCreditTransactions(userId, limit)
```

## Making Changes

### Adding a New Task Type:

1. Update database schema:
```sql
-- Add to task_type CHECK constraint
ALTER TABLE tasks
ADD CONSTRAINT tasks_task_type_check
CHECK (task_type IN ('click', 'view', 'install', 'share', 'new_type'));
```

2. Update task generation in `api.js::generateTasksForLink`:
```javascript
const taskTypes = ['click', 'view', 'new_type']
```

3. Update TaskFeed display in `TaskFeed.jsx` if needed

### Modifying Credit Rewards:

1. Change in `api.js::completeTask`:
```javascript
credits_earned: 2  // Changed from 1
```

2. Update display in `SubmitLink.jsx`:
```javascript
const creditCost = Math.ceil(formData.targetEngagement * 1.5) // More expensive
```

### Adding Admin Features:

1. Create new page in `src/pages/AdminFeature.jsx`
2. Add route in `App.jsx`:
```jsx
<Route path="/admin/feature" element={<AdminFeature />} />
```

3. Add navigation link in `Navbar.jsx` (admin only check later)

## Testing the System

### Test User Flow:

1. Create 3 test accounts
2. Account 1: Submit a link with 10 target clicks
3. Account 2: Complete 10 tasks
4. Account 3: Check leaderboard

### Test Credit Math:

1. User A earns 50 credits
2. Submit link with 40 target engagement
3. Cost calculated: 40 × 1.2 = 48 credits
4. User balance: 50 - 48 = 2 credits remaining
5. Tasks generated: 40 tasks for others

### Test Task Distribution:

1. Submit multiple links from different users
2. Check task feed on account that hasn't completed any
3. Verify priority scoring works (older tasks shown first)
4. Verify different users see different tasks (randomization)

## Performance Tips

### Reduce Database Calls:
```javascript
// ❌ Bad: Multiple queries
const user = await API.getUserProfile(userId)
const tasks = await API.getAvailableTasks(userId)

// ✅ Good: Batch if possible
const [user, tasks] = await Promise.all([
  API.getUserProfile(userId),
  API.getAvailableTasks(userId)
])
```

### Optimize Queries:
- Use `.maybeSingle()` for zero-or-one queries
- Add pagination for large datasets
- Use `.limit()` to avoid loading everything

### Caching:
```javascript
// Simple cache with useState
const [cachedTasks, setCachedTasks] = useState(null)

useEffect(() => {
  if (!cachedTasks) {
    API.getAvailableTasks().then(setCachedTasks)
  }
}, [])
```

## Deployment

### To Vercel (Recommended):

1. Push code to GitHub
2. Connect repo to Vercel
3. Set environment variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_SUPABASE_ANON_KEY
4. Deploy

The app builds automatically.

### To traditional server:

```bash
npm run build
# Upload dist/ folder to server
```

## Debugging

### Enable Supabase logs:
```javascript
// In main.jsx
const supabaseClient = createClient(url, key)
supabaseClient.auth.setAuth(session)
```

### Check browser console:
- Look for API errors
- Verify auth state
- Check network requests

### Supabase Dashboard:
- Go to supabase.co
- Select project
- Check database logs
- Monitor auth events
- View API usage

## Common Issues

**Issue: 403 Unauthorized on links page**
- RLS policy not allowing user to see their own links
- Fix: Check policy allows `auth.uid() = user_id`

**Issue: Credits not updating**
- Transaction not recorded
- Check credit_transactions table for entry
- Verify user balance calculation

**Issue: Tasks not appearing in feed**
- Tasks not generated or all expired
- Check tasks table for available tasks
- Verify user_id != task's user_id

**Issue: App won't load**
- Supabase credentials invalid
- Check .env file has correct values
- Verify Supabase project is active

## Next Features to Build

1. **Payment Integration**
   - Paystack webhook handler
   - Credit purchase flow
   - Payment history

2. **Notifications**
   - Email on task completion
   - Alert when link gets engagement
   - Referral notifications

3. **Analytics**
   - User dashboard with charts
   - Link performance metrics
   - Earnings breakdown by source

4. **Referral System**
   - Unique referral links
   - Bonus tracking
   - Commission calculations

5. **Mobile App**
   - React Native version
   - Simplified task interface
   - Push notifications

## Support

For issues:
1. Check browser console for errors
2. Verify Supabase connection
3. Test with sample data
4. Check RLS policies

Build, test, iterate. 🚀
