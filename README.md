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

## Financial records

`/loans`, `/income`, `/expenses` and `/goals` each render a summary, a filterable table and a
create/edit dialog. `/profile` shows the account plus an overview assembled from all four
`/summary` endpoints, because the API has no combined dashboard route.

All four are built from one generic screen, so a resource is a field/column config rather than a
separate page:

| Piece | Where |
| --- | --- |
| HTTP transport | `services/apiClient.ts` (shared with auth) |
| Transport per resource | `services/finance/records.ts` |
| Field, form and payload rules | `types/RecordFormTypes.ts`, `helpers/recordForm.ts` |
| Screen, table, toolbar, dialog | `components/Records/**` |
| Per-resource config | `components/{Loans,Income,Expenses,Goals}/*Config.tsx` |

Three contract rules are worth knowing before changing any of it:

- **Money is integer paise.** `150050` is Rs 1,500.50, and `1500` is Rs 15.00. `helpers/money.ts`
  owns the conversion in both directions and rounds away the floating point error in
  `1234.56 * 100`. **Interest rates are percentages and are never divided.**
- **Amounts are always shown as INR**, whatever the app's currency selector is set to, because the
  API fixes the currency to INR and offers no FX rate to convert with.
- **Request bodies are strict.** A blank optional is omitted rather than sent as `null`, and
  `PATCH` sends only the fields that changed. Goal `progressPercent`, `remainingAmount` and
  `daysRemaining` are server-computed and must never be sent.

There are no cross-resource links in this API: an expense cannot be attached to a goal, so goal
progress comes from each goal's own `currentAmount`. Likewise there is no repayment ledger, so no
outstanding loan balance or payoff figure is displayed — only what the record stores.



## Where things live

- **Pages**: `app/**`
- **Reusable UI**: `components/**`
  - **Shared calculator shell**: `components/Common/CommonCalculator/*`
  - **Loan calculators & amortization**: `components/Common/LoanCalculator/*`
  - **Charts**: `components/Charts/*`
  - **Landing page sections**: `components/LandingPage/*`
  - **Blog UI**: `components/Blog/*`
  - **Auth**: `components/{AuthPanel,AuthField,LoginPanel,RegisterPanel,RequireAuth,RequireAnonymous,AuthMenu,ProfileMenu}/*`
  - **Navbar**: `components/{AppBar,ToolsMenu,CurrencySelector}/*` — signed in, the tools collapse behind one item and the account behind one icon
- **API boundary**: `services/auth/*` — the only code that talks to the backend
- **Session state**: `contexts/authContext.tsx`

## Remote runtime config

Calculator FAQs and some homepage content are fetched at runtime via `helpers/config.ts` from a JSON file hosted on GitHub.
