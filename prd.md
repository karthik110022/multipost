1. Introduction
Product Name: Multipost

Working Title: “MultiPost”
Primary Goal:
Enable users to manually post content (text, images, video) to multiple social media platforms simultaneously through a single interface.

Secondary Goals:

Provide a streamlined workflow to link multiple social accounts.
Offer clear status feedback (success/failure) per platform.
Easily extend to scheduling, analytics, or additional features in the future.
2. Scope & Objectives
Scope

Build an MVP for immediate manual posting to at least two major platforms (e.g., Twitter, Facebook), while storing user data in Supabase.
Provide basic user authentication and social account linking via OAuth.
Show a log/history of posted content.
Objectives

Simplicity: User-friendly interface for composing and posting content.
Consistency: Uniform experience across different social networks.
Extensibility: Supabase-based back end allows easy integration of new features (e.g., scheduled jobs, analytics).
3. Key Features
User Registration & Authentication

Implement user signup/login using Supabase Auth (built-in email/password or third-party providers).
Password reset flow via Supabase’s password recovery mechanism.
Social Account Linking (OAuth)

Users connect platforms: Twitter, Facebook, LinkedIn, Instagram (business/creator) via separate OAuth flows.
Store access tokens in Supabase’s PostgreSQL database.
Encryption of tokens at rest (Supabase’s recommended approach).
Manual Post Creation

Single text area for post content.
Optional image/video upload (as supported by the platform).
Checkboxes to choose which linked platforms to target.
Publishing Process

App calls internal Next.js API routes, which then forward posts to each social network’s API.
Supabase acts as the primary data store for posts, user profiles, tokens, etc.
Real-time feedback on success/failure.
Post History

All prior post records stored in a posts table in Supabase.
Each record tracks the posting status to each platform (success/failure).
Simple UI to view past posts with timestamps.
Settings

User Profile: Name, email, password changes handled by Supabase Auth.
Linked Accounts: Manage connected social media tokens, re-authenticate if tokens expire.
(Optional) Notification preferences.
4. System Architecture & Tech Stack
Front-end

Next.js + TypeScript for SSR and client-side rendering.
Tailwind CSS (optional) or any styling framework for UI components.
Supabase Client in the front end for user authentication and data fetching (e.g., Supabase JS).
Back-end

Supabase as a hosted PostgreSQL database + authentication + storage solution.
Next.js API Routes for custom endpoints interacting with social media platforms.
The Next.js server environment reads/writes data to Supabase via Supabase Admin Key or service role as needed.
Social Platform Integrations

Twitter API: OAuth 2.0 or 1.0a.
Facebook Graph API: For pages or user feed posting.
LinkedIn: UGC post endpoint.
Instagram Graph API: For business/creator accounts.
Authentication & Security

Supabase Auth for user sessions.
Tokens for social platforms stored securely in the Supabase database (encrypted columns if needed).
HTTPS for all user-facing traffic.
Deployment

Next.js on Vercel (or Netlify, or self-hosted).
Supabase handles the DB, auth, storage, etc.
CI/CD pipeline with GitHub Actions or a similar tool.
5. Database Schema (Supabase)
Below is a simplified schema, which can be adjusted in Supabase’s dashboard or via SQL migration scripts.

users

id (UUID, PK)
email (unique)
created_at (timestamp)
Supabase handles password-hashing automatically via Auth.
social_accounts

id (UUID, PK)
user_id (FK → users.id)
platform (text enum: “twitter”, “facebook”, etc.)
access_token (text, potentially encrypted)
refresh_token (text, potentially encrypted)
token_expires (timestamp)
created_at (timestamp)
posts

id (UUID, PK)
user_id (FK → users.id)
content (text)
created_at (timestamp)
post_status

id (UUID, PK)
post_id (FK → posts.id)
platform (text)
status (text: “success”, “failure”)
error_message (nullable text)
created_at (timestamp)
6. Page Structure & User Flows
bash
Copy
Edit
/pages
  ├─ index.tsx            # Landing page
  ├─ login.tsx            # Login via Supabase Auth
  ├─ signup.tsx           # Signup via Supabase Auth
  ├─ dashboard.tsx        # Overview after login
  ├─ create-post.tsx      # Manual post creation
  ├─ post-history.tsx     # List user’s past posts
  ├─ settings/
  │   ├─ index.tsx        # Profile updates (with Supabase Auth)
  │   └─ linked-accounts.tsx  # Manage social accounts
  └─ api/
      ├─ manual-post.ts   # API route distributing a post to social platforms
      └─ social/
          ├─ twitter.ts   # Endpoint for posting to Twitter
          ├─ facebook.ts  # Endpoint for posting to Facebook
          ├─ linkedin.ts  # ...
          └─ instagram.ts # ...
Flows
User Authentication via Supabase

On login/sign up, calls Supabase Auth endpoints using the @supabase/supabase-js client.
Stores session in local storage or cookies.
Linking Social Accounts

User clicks “Connect Twitter.”
The app’s Next.js API route handles OAuth handshake.
The OAuth tokens are stored in Supabase DB under social_accounts.
Manual Post Creation

On create-post.tsx, user composes message, optionally attaches media.
Chooses which platforms to post.
The Next.js API route /api/manual-post retrieves tokens from Supabase, calls each social/[platform] handler.
Results are logged in posts and post_status tables.
Post History

post-history.tsx fetches user-specific posts from posts and joins with post_status.
Displays each post’s content, timestamp, and per-platform status.
Settings

linked-accounts.tsx shows all connected platforms.
Allows removing or re-linking an account if tokens are invalid.
settings/index.tsx handles user profile updates via Supabase Auth management (e.g., email updates, password changes).
7. Non-Functional Requirements
Performance

Supabase’s managed Postgres scales with moderate user traffic.
Next.js SSR or SSG for fast page loads.
Security

Rely on Supabase Auth for user sign-in/out.
Store OAuth tokens securely—could use Supabase’s “Encrypted Columns” feature or an external encryption library.
Scalability

Supabase can handle increased load with usage-based pricing.
Next.js can scale horizontally on Vercel or other hosts.
Reliability

Error handling for each platform’s API (token expiration, rate limit, etc.).
Logging of all requests to help diagnose issues.
