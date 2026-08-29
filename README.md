# 📖 Word Notebook

A personal vocabulary notebook for recording unfamiliar words, searching entries, filtering them by status, and managing review progress.

## Tech Stack

- **Frontend**: HTML + JavaScript + Vite
- **Hosting**: GitHub Pages
- **Data**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email accounts)

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Enter the Supabase project configuration on the application's login page. It is stored in the current browser only and is not committed to the project repository. After configuring the project, users can register or sign in with their own email accounts.

1. Create a project at [supabase.com](https://supabase.com)
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase Dashboard → **SQL Editor** to create the table and RLS policies
3. Run [`supabase/storage.sql`](supabase/storage.sql) in the Supabase Dashboard → **SQL Editor** to create the image bucket and storage policies
4. Get the `Project URL` and `anon public` key from **Project Settings → API**
5. Start the application and enter the `Project URL` and `anon public` key on the login page

The application only uses the public anon key. Never enter or expose the `service_role` key.

### 3. Enable email authentication

1. Open **Authentication → Providers** in the Supabase Dashboard
2. Confirm that the **Email** provider is enabled
3. Return to the application, enter the Supabase configuration, and register or sign in with an email and password

### 4. Start the development server

```bash
npm run dev
```

Open `http://localhost:5173`, enter the Supabase configuration on first launch, and register or sign in with an email and password.

## Build

```bash
npm run build
```

The output is written to the `dist/` directory.

## Deploy to GitHub Pages

This project uses **GitHub Actions** to build and deploy to GitHub Pages.

### 1. Configure GitHub Pages

1. In the GitHub repository, open **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**. Do not select a branch, as that would override the Actions deployment.

### 2. Configure Supabase

The GitHub Actions build does not require a Supabase URL, key, or repository secret. When the deployed page is opened for the first time, enter the `Project URL` and `anon public` key. The configuration is stored in the current browser only. Never enter or commit the `service_role` key.

### 3. Trigger deployment

Push to the `main` branch to trigger deployment automatically. You can also run **Deploy to GitHub Pages** manually from the **Actions** page.

After deployment, open `https://<your-username>.github.io/wo_wo/`.

### 4. Configure the email verification URL

If email confirmation is enabled in Supabase, open **Authentication → URL Configuration** and set:

- **Site URL**: `https://<your-username>.github.io/wo_wo/`
- **Redirect URLs**: `https://<your-username>.github.io/wo_wo/`

This allows users who register from GitHub Pages to return to the application after clicking the verification email.

### Preview the production build locally

```bash
npm run build
npm run preview
```

> Note: GitHub Pages deploys this project under `/wo_wo/`, and `vite.config.js` sets the `base` path accordingly. If you deploy to a custom domain or a user site (`username.github.io`), change `base` to `'/'`.

## Security

This project uses **Supabase Auth + Row Level Security (RLS)** to protect data:

1. **RLS is enabled**: the `words` table only allows each user to access rows where `auth.uid() = user_id`. Even with the anon key, users cannot read another user's data.
2. **Only the anon key is used in the frontend**: the `service_role` key, which has unrestricted access, is never exposed.
3. **Configuration isolation**: the Supabase project configuration is entered by the user and stored in the current browser, not in the Git repository.
4. **HTTPS**: GitHub Pages provides HTTPS automatically.
5. **Account security**: Supabase Auth manages email accounts. Passwords are not stored in the project or browser configuration; signing in with the same account from another browser provides access to the same data.

> ⚠️ **Important**: Never put the `service_role` key in frontend code or commit it to the repository. Doing so would allow anyone to bypass RLS and directly modify the database.

## Data Model

### `words` table

| Field | Type | Description |
|------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner, linked to `auth.users` |
| word | text | Word or phrase |
| meaning | text | Meaning |
| example | text | Example sentence (optional) |
| note | text | Note (optional) |
| status | text | `new` / `learning` / `mastered` |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update time |

## Features

- ✅ Email registration, sign-in, and sign-out
- ✅ Add, edit, and delete words
- ✅ Filter by status (new / learning / mastered)
- ✅ Search by keyword
- ✅ Mark a word as mastered
- ✅ Per-user data isolation
- ✅ Markdown editing (bold, italic, lists, blockquotes, inline code, and more)
- ✅ Edit and preview modes
- ✅ Private image uploads through Supabase Storage, with short-lived signed URLs
- ✅ Time navigation by today, yesterday, this week, this month, and month