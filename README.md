# MoneyReload – Investment & Loan Calculators

- **Live app**: `https://moneyreload.com`

Next.js (App Router) site containing financial calculators (SIP, FD/RD, lumpsum, loans/mortgage, income tax) plus an MDX-powered blog.

## Tech stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: MUI v6, CSS modules
- **Charts**: Recharts
- **Content**: MDX blog posts in `content/blogs/*.mdx`
- **SEO**: `next-sitemap` (runs on `postbuild`)

## Local development

Install deps and start the dev server:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment variables

Create `.env.local` (optional but recommended):

```bash
PROD_URL=http://localhost:3000

# Base URL of the MoneyReload API. Defaults to http://localhost:7000.
# The API must also list this app's origin in its own CORS_ORIGINS.
NEXT_PUBLIC_API_URL=http://localhost:7000
```

`PROD_URL` is used for canonical URLs, metadata, sitemap generation, and footer links.

`NEXT_PUBLIC_API_URL` is read only by `services/auth/`, which is the single boundary to the
authentication API. It is `NEXT_PUBLIC_` because authentication is a Bearer token held in browser
storage: the API sets no cookies, so there is no server session and nothing to proxy.

## Authentication

- **Public routes** need no session: every calculator, the blog and the static pages are unchanged.
- **Sign in**: `/login` · **Register**: `/register`
- **Private routes**, which require a session and redirect to `/login` without one:
  `/profile`, `/loans`, `/income`, `/expenses`, `/goals`

Tokens are stored in `localStorage` under `moneyreload.auth` and sent as `Authorization: Bearer`.
They are renewed from `expiresIn` before the access token lapses, and only ever one refresh runs at
a time, because concurrent refreshes are treated by the API as token reuse and revoke every session.

Because the session lives in the browser, private routes are guarded on the client
(`components/RequireAuth`) rather than in `middleware.ts`.



## Where things live

- **Pages**: `app/**`
- **Reusable UI**: `components/**`
  - **Shared calculator shell**: `components/Common/CommonCalculator/*`
  - **Loan calculators & amortization**: `components/Common/LoanCalculator/*`
  - **Charts**: `components/Charts/*`
  - **Landing page sections**: `components/LandingPage/*`
  - **Blog UI**: `components/Blog/*`
  - **Auth**: `components/{AuthPanel,AuthField,LoginPanel,RegisterPanel,RequireAuth,RequireAnonymous,AuthMenu,AuthenticatedPage}/*`
- **API boundary**: `services/auth/*` — the only code that talks to the backend
- **Session state**: `contexts/authContext.tsx`

## Remote runtime config

Calculator FAQs and some homepage content are fetched at runtime via `helpers/config.ts` from a JSON file hosted on GitHub.
