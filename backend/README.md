# Circle for Life

**Create. Compete. Earn.**

A production-grade gamified AI social platform designed for viral growth, retention, and engagement. Think **Instagram + Midjourney + Duolingo + Game Economy**.

---

## Core Loop

```
Creation → Posting → Voting → Gems → Unlocks → More Creation
```

Users generate AI content, post to the Circle feed, receive votes, earn Gems, and spend Gems on upgrades — creating an addictive growth flywheel.

---

## Features

### AI Playground (Control Panel)
- Multi-provider AI chat: OpenAI, Anthropic, Google Gemini, Groq, Mistral, OpenRouter, Together AI, DeepSeek
- Multi-provider image generation: DALL-E, Stability AI, Flux (BFL), Replicate, fal.ai
- Auto-fetch available models per API key
- Local LLM support via WebLLM (in-browser, no server cost)

### 10-Level Progression System
| Level | Title | Min Gems | Key Unlocks |
|-------|-------|----------|-------------|
| 1 | Newcomer | 0 | AI Chat, Feed |
| 2 | Explorer | 100 | Blog reading |
| 3 | Creator | 500 | Blog posting, Image gen |
| 4 | Artisan | 1,500 | API Tester, Premium models |
| 5 | Champion | 5,000 | Advanced analytics |
| 6 | Master | 10,000 | User management, Audit log |
| 7 | Legend | 20,000 | Custom themes |
| 8 | Titan | 30,000 | All premium models |
| 9 | Ascendant | 50,000 | P2P Chat preview |
| 10 | Eternal | 100,000 | Full P2P Chat, AI tools |

### Gem Economy
- **Earn**: Daily login (+5-30), blog posts (+2), likes received (+1), comments (+1), referrals (+10), streaks (bonus multiplier)
- **Spend**: Premium AI models, customization, ad-free passes
- Anti-exploit validation and inflation prevention built-in

### Blog System
- Create, like, comment on posts
- Post directly from AI Playground conversations
- Level-gated (read at Lv2, write at Lv3)
- Trending / Popular / Newest sorting

### P2P Chat (The Reward)
- Bot-free zone: every user earned their way in
- AI Tone Check: warns if message sounds aggressive
- AI Scheduling Detection: highlights dates/times
- Auto language detection
- Level-gated (preview at Lv9, full at Lv10)

### User Management & RBAC
- 6 roles: `super_admin`, `admin`, `moderator`, `creator`, `user`, `guest`
- Granular permissions (25+ permission types)
- Admin actions: ban, shadow ban, adjust gems, set level, change tier, trust score, reset password, admin notes
- Full audit logging for all admin actions

### Referral System
- Unique invite codes per user
- +10 gems for referrer on signup
- Attribution tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20+ |
| **Framework** | Fastify 5 |
| **Language** | TypeScript |
| **Database** | Supabase (PostgreSQL) or Local CSV |
| **Auth** | JWT (access + refresh tokens) |
| **Password** | bcrypt (12 rounds) |
| **Validation** | Zod |
| **Logging** | Pino |
| **Frontend** | HTML/CSS/JS SPA (served by Fastify) |
| **Local LLM** | WebLLM (WebGPU, in-browser) |

---

## Quick Start

### Prerequisites
- Node.js 20+
- A Supabase project (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/ruturajsolanki/circle-for-life.git
cd circle-for-life
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Copy your project URL, anon key, and service role key from **Settings → API**

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DB_MODE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-random-secret-min-32-chars
JWT_REFRESH_SECRET=another-random-secret
```

### 4. Run

```bash
npm run dev
```

Open **http://localhost:3000** — login with `admin@circleforlife.app` / `admin123456`.

### Local Mode (No Supabase needed)

To run with local CSV files instead:

```env
DB_MODE=local
```

Data is stored in `./data/` as CSV files. Great for development and demos.

---

## Deployment

### Railway (Recommended)

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select this repo
4. Add environment variables (see `.env.example`)
5. Railway auto-detects `railway.json` and deploys

### Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect this repo
4. Render auto-detects `render.yaml`

### Docker

```bash
docker build -t circle-for-life .
docker run -p 3000:3000 --env-file .env circle-for-life
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/auth/register` | Register new user |
| POST | `/v1/auth/login` | Login |
| POST | `/v1/auth/refresh` | Refresh token |
| GET | `/v1/auth/me` | Current user profile |

### User Management (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/manage/users` | List users (paginated, searchable) |
| GET | `/v1/manage/users/:id` | Get user details |
| POST | `/v1/manage/users` | Create user |
| PATCH | `/v1/manage/users/:id` | Update user |
| DELETE | `/v1/manage/users/:id` | Soft delete user |
| POST | `/v1/manage/users/:id/role` | Assign role |
| POST | `/v1/manage/users/:id/ban` | Ban user |
| DELETE | `/v1/manage/users/:id/ban` | Unban user |
| POST | `/v1/manage/users/:id/shadow-ban` | Toggle shadow ban |
| POST | `/v1/manage/users/:id/gems` | Adjust gems |
| POST | `/v1/manage/users/:id/set-level` | Set level |
| POST | `/v1/manage/users/:id/tier` | Change tier |
| POST | `/v1/manage/users/:id/reset-password` | Reset password |
| POST | `/v1/manage/users/:id/verify-email` | Toggle email verification |
| POST | `/v1/manage/users/:id/reset-streak` | Reset streak |
| POST | `/v1/manage/users/:id/trust-score` | Set trust score |
| POST | `/v1/manage/users/:id/status` | Change status |
| POST | `/v1/manage/users/:id/notes` | Update admin notes |
| GET | `/v1/manage/audit-log` | View audit log |
| GET | `/v1/manage/stats` | Platform statistics |

### Blog
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/blog/posts` | Blog feed |
| GET | `/v1/blog/posts/:id` | Single post |
| POST | `/v1/blog/posts` | Create post |
| POST | `/v1/blog/posts/:id/like` | Toggle like |
| POST | `/v1/blog/posts/:id/comment` | Add comment |
| DELETE | `/v1/blog/posts/:id` | Delete post |

### P2P Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/chat/conversations` | List conversations |
| POST | `/v1/chat/conversations` | Start conversation |
| GET | `/v1/chat/conversations/:id/messages` | Get messages |
| POST | `/v1/chat/conversations/:id/messages` | Send message |
| GET | `/v1/chat/users/available` | Chat-eligible users |
| POST | `/v1/chat/ai/tone-check` | AI tone analysis |
| POST | `/v1/chat/ai/schedule-detect` | AI scheduling detection |

### AI Control Panel
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/control-panel/providers` | List providers & models |
| POST | `/v1/control-panel/chat` | Chat completion |
| POST | `/v1/control-panel/image` | Image generation |
| POST | `/v1/control-panel/models` | Fetch live models |

---

## Project Structure

```
src/
├── config/          # Environment, database, Supabase config
├── db/              # Unified database layer (CSV ↔ Supabase)
├── localdb/         # CSV-based local database (dev/demo)
├── supabase/        # Supabase PostgreSQL store
├── middleware/       # Auth, RBAC, rate limiting
├── routes/          # All API route handlers
│   ├── localAuth.routes.ts
│   ├── userManagement.routes.ts
│   ├── blog.routes.ts
│   ├── chat.routes.ts
│   ├── controlPanel.routes.ts
│   └── dashboard.routes.ts    # Full web UI (SPA)
├── services/        # Business logic, AI, game economy
├── models/          # MongoDB models (for cloud mode)
├── utils/           # Logger, helpers
└── server.ts        # Entry point
```

---

## Database Schema

See `supabase-schema.sql` for the complete PostgreSQL schema including:
- `users` — 35+ columns with full profile, gems, streaks, moderation
- `blog_posts`, `blog_likes`, `blog_comments` — Blog system
- `conversations`, `chat_messages` — P2P chat with AI metadata
- `gem_transactions` — Full gem economy ledger
- `votes`, `follows`, `reports` — Social features
- `audit_log` — Admin action tracking

---

## Security

- JWT authentication with access + refresh tokens
- bcrypt password hashing (12 rounds)
- Role-based access control with 25+ granular permissions
- Shadow banning (user doesn't know they're banned)
- Trust score system for progressive trust
- Audit logging for all admin actions
- Input validation with Zod on all endpoints

---

## License

MIT

---

Built with determination by the Circle for Life team.
