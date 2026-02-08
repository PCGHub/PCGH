# PCGH Quick Reference Card

## What is PCGH?

A community platform where users help each other grow by exchanging real engagement (clicks, views, installs) using a credit-based economy.

**Core Mechanic:**
- Earn credits by completing tasks
- Spend credits to get engagement for your links
- Platform takes 20% as commission

---

## Key Numbers

| Metric | Value |
|--------|-------|
| Signup bonus | 20 credits |
| Task reward | 1 credit |
| Max tasks/day | 50 |
| Credit cost multiplier | 1.2x |
| Credit expiration | 90 days |
| Pod size | 200-250 users |
| Pod rotation | Weekly |
| Platform margin | 20% |
| Payback period | 1 credit = 1 engagement |

---

## System Flow

```
TASK COMPLETER PATH:
Signup → Get 20 credits → Complete tasks → Earn 1 credit/task → Accumulate balance

LINK SUBMITTER PATH:
Have credits → Submit link (URL + target engagement) → Pay cost (target × 1.2)
→ System generates tasks → Others complete → Get real engagement

PLATFORM:
Collects 20% commission on every engagement delivered
```

---

## Database Tables (Quick Lookup)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| users | User profiles | id, credits, reputation, tier |
| links | Submitted URLs | id, url, target_engagement, current_engagement |
| tasks | Individual tasks | id, link_id, status, credit_reward, assigned_to_user_id |
| task_completions | Records of done work | id, task_id, user_id, verified, credits_earned |
| credit_transactions | Ledger | id, user_id, amount, type, created_at |
| user_pods | Community groups | id, pod_number, current_members_count |

---

## API Quick Reference

```javascript
// Auth
API.signUp(email, password, username, fullName)
API.signIn(email, password)
API.signOut()

// Profile
API.getUserProfile(userId)
API.updateUserProfile(userId, updates)

// Actions
API.getAvailableTasks(userId, limit)
API.completeTask(userId, taskId, proof)
API.submitLink(userId, linkData)
API.getUserLinks(userId)

// History
API.getCreditTransactions(userId, limit)
```

---

## How the Algorithm Works

### Task Priority Score (0-100)

```
SCORE = (40 × DAYS_WAITING) + (30 × REPUTATION) + (20 × RARITY) + (10 × RANDOM)

Example:
- Task waiting 5 days = 40×5 = 200 points
- User reputation 50 = 30×50 = 1500 points
- Common task = 20×1 = 20 points
- Random factor = 10×random = 0-10 points
- TOTAL = 1720+ points

Older tasks shown first ✓
Better reputation users see more ✓
Prevents gaming ✓
```

### Pod System

```
All users divided into pods of ~200 people

Weekly rotation = New pod assignments = New engagement sources

Result: Can't identify bot network patterns
```

---

## Security Model

### What Users Can See:
- ✓ Their own profile
- ✓ Their own links
- ✓ Their own transactions
- ✓ Available tasks (not theirs)
- ✓ Other users' usernames only

### What Users CAN'T See:
- ✗ Other users' credits
- ✗ Other users' transactions
- ✗ Other users' links
- ✗ Internal admin data

**Implementation:** Row Level Security (RLS) on all tables

---

## Pricing Tiers

| Plan | Cost | Credits/Week | Tasks/Day | Features |
|------|------|--------------|-----------|----------|
| Free | Free | 20 | 5 | Ads, basic |
| Basic | ₦1K | 100 | 50 | Standard |
| Pro | ₦3K | 500 | ∞ | Premium, API |
| Agency | ₦20K/mo | 5K | ∞ | Dedicated |

---

## Revenue Breakdown (Per Link Submission)

```
User submits 100 clicks target

Cost to user: 100 × 1.2 = 120 credits

Distribution:
- 100 credits → Rewards for task completers (≈80 users × 1.25 credits avg)
- 20 credits → Platform commission

Platform makes 20% on every engagement
```

---

## Anti-Fraud Measures

| Risk | Detection | Prevention |
|------|-----------|-----------|
| Bot tasks | Task completion <5s | Require 15s+ |
| Collusion | Same users engage repeatedly | Pod rotation |
| Velocity | 100 tasks in 1 hour | Cap at 50/day |
| Geographic | All followers from one country | Mix pods by location |
| Low quality | Comments "Great post" | Require unique text |

---

## Admin Dashboard Metrics

```
Total Users: Count from users table
Active Users: Users with last_active_at in last 7 days
Task Completion Rate: completed_tasks / total_tasks
Credits Circulating: Sum of all user balances
User Tier Distribution: Count by tier
```

---

## Common Questions

**Q: Can I make real money?**
A: Yes, but it requires scale. At ₦20/1000 credits earned, need 5,000+ credits to make ₦100.

**Q: Will I get banned?**
A: Low risk on blog clicks (undetectable). Medium risk on YouTube. High risk on Instagram. PCGH not liable.

**Q: How long to get engagement?**
A: Staggered over 1-3 days. Never all at once.

**Q: How many people can use my link?**
A: Limited by credits. Max ≈1,200 engagements per link before expiry.

**Q: What happens if I get banned?**
A: PCGH offers 50% credit refund (not guaranteed). Keep backups.

---

## Launch Checklist

- [ ] Deploy to Vercel
- [ ] Test with 3 accounts
- [ ] Verify credits system works
- [ ] Check admin dashboard
- [ ] Enable RLS
- [ ] Set up monitoring
- [ ] Invite 50 beta testers
- [ ] Monitor for 1 week
- [ ] Fix critical issues
- [ ] Public launch

---

## Monitoring Commands

**Check system health:**
```sql
-- Active users today
SELECT COUNT(DISTINCT user_id) FROM task_completions
WHERE created_at > NOW() - interval '1 day'

-- Total credits in circulation
SELECT SUM(credits) FROM users

-- Task completion rate
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') * 100 / COUNT(*) as completion_rate
FROM tasks

-- Fraud detection: suspicious velocity
SELECT user_id, COUNT(*) FROM task_completions
WHERE created_at > NOW() - interval '1 hour'
GROUP BY user_id HAVING COUNT(*) > 30
```

---

## File Structure (Minimal)

```
src/
├── lib/
│   ├── supabase.js (client setup)
│   └── api.js (all backend calls)
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── TaskFeed.jsx
│   ├── SubmitLink.jsx
│   └── ...
├── components/
│   └── Navbar.jsx
├── App.jsx (router)
└── index.css (styles)
```

**To add new page:**
1. Create `src/pages/NewPage.jsx`
2. Add route in `App.jsx`
3. Add nav link in `Navbar.jsx`

---

## Deployment (Quick)

```bash
# Build
npm run build

# Deploy to Vercel (one-click from UI)
# OR upload dist/ folder to server

# Environment variables needed:
VITE_SUPABASE_URL=<your-url>
VITE_SUPABASE_SUPABASE_ANON_KEY=<your-key>
```

---

## Cost Structure (Monthly)

| Item | Cost |
|------|------|
| Supabase (storage) | ₦15K |
| Hosting (Vercel) | Free |
| SMS notifications | ₦20K |
| Payment processing (Paystack) | Variable (1.5% + ₦100/txn) |
| Support staff | ₦100K |
| Marketing | ₦150K |
| **Total** | **₦285K base** |

**Breakeven:** 75-100 paying users at ₦1,000-2,000/month

---

## Next Features (Roadmap)

**Month 1 (Beta):**
- Paystack integration
- Referral system

**Month 2 (Scale):**
- Telegram bot
- Leaderboards
- Email notifications

**Month 3 (Expand):**
- Mobile app
- B2B API
- Cross-border

---

## Emergency Contacts

**Supabase issues:** dashboard.supabase.co
**Deployment issues:** Vercel dashboard
**Paystack issues:** paystack.com/support

---

**Last Updated:** 2025-02-05
**Status:** MVP Complete ✓
**Ready to Launch:** Yes
**Next Step:** Deploy to production

🚀 Let's ship it!
