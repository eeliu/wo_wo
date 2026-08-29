# Word Notebook - Project Plan

## Overview

Personal vocabulary notebook. Users record unfamiliar words for later viewing, searching, and review.

## Technology Stack

| Layer | Technology | Description |
|----|------|------|
| Frontend | Plain HTML + JavaScript + Vite | Lightweight, framework-free, and maintainable |
| Hosting | Cloudflare Pages | Free, global CDN, and automatic HTTPS |
| Data | Supabase (PostgreSQL) | Free tier and automatic REST API |
| Authentication | Supabase Auth (email and password) | Standard, secure, and extensible |

## Security Plan (Decided)

Use **Supabase Auth email and password sign-in** because:
- Data isolation: each user sees only their own words
- Standard security: Supabase handles password hashing, JWTs, and sessions
- Extensibility: the architecture supports multiple users without changes
- **Row Level Security (RLS)** protects data at the database layer

### Security Notes
1. **RLS is required**: all tables use row-level security, and access requires `user_id = auth.uid()`
2. **Never expose the service_role key in the frontend**: use only the anon key, protected by RLS
3. **Environment variables**: manage the Supabase URL and anon key through `.env`, and never commit them
4. **HTTPS**: provided automatically by Cloudflare

## Data Model

### Table: words
| Field | Type | Description |
|------|------|------|
| id | uuid (PK, default gen_random_uuid()) | Primary key |
| user_id | uuid (FK -> auth.users) | Owner |
| word | text | Word |
| meaning | text | Meaning |
| example | text (nullable) | Example |
| note | text (nullable) | Note |
| status | text (default 'new') | Status: new / learning / mastered |
| created_at | timestamptz (default now()) | Creation time |
| updated_at | timestamptz | Update time |

### RLS Policies
```sql
CREATE POLICY "Users can view own words" ON words
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own words" ON words
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own words" ON words
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own words" ON words
  FOR DELETE USING (auth.uid() = user_id);
```

## Features

1. **Authentication**
  - Registration (email and password)
  - Sign in / sign out
  - Persistent sessions

2. **Word records**
  - Add words (word, meaning, example, note)
  - Edit words
  - Delete words

3. **Lists and filters**
  - Filter by status (all / new / learning / mastered)
  - Keyword search
  - Sort by time

4. **Review status**
  - Set status: new → learning → mastered

## Project Structure

```
wo_wo/
├── index.html              # Main page
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── .env.example            # Environment variable example
├── .gitignore
├── src/
│   ├── main.js             # Entry point and Supabase initialization
│   ├── supabase.js         # Supabase client
│   ├── auth.js             # Authentication logic
│   ├── words.js            # Word CRUD logic
│   └── style.css           # Styles
├── supabase/
│   └── schema.sql          # Database tables and RLS policies
└── README.md               # Deployment and usage guide
```

## Deployment (Cloudflare Pages)

1. Create a Supabase project and run `supabase/schema.sql`
2. Get the Supabase URL and anon key
3. Configure `.env` locally
4. Push to the GitHub repository
5. Connect the repository in Cloudflare Pages with build command `npm run build` and output directory `dist`
6. Set environment variables (Supabase URL and anon key)
7. Deploy and optionally connect a custom domain

## Milestones

- [ ] M1: Project skeleton + Supabase client
- [ ] M2: Database schema + RLS
- [ ] M3: Authentication
- [ ] M4: Word CRUD + interface
- [ ] M5: Search, filtering, and status management
- [ ] M6: Deployment documentation + launch
