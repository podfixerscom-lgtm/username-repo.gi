# Crazy Cart

Crazy Cart is a full-stack commerce and operations foundation built with
Next.js, TypeScript, Prisma, and PostgreSQL. The customer storefront and the
staff-only operations dashboard are separate route areas. The storefront is
localized in Bangla and uses BDT (৳); the operations area has a dark theme.

## Requirements

- Node.js 20.19 or newer
- PostgreSQL 14 or newer

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL
   database. Generate an `AUTH_SECRET` with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Generate a separate 32-byte key for `RESELLER_ENCRYPTION_KEY` with the
   same command. Keep both secrets out of source control and use a durable,
   access-controlled secret store in production.
2. Set both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env` to create
   the first admin. Use a unique password with at least 12 characters.
3. Install dependencies, generate the Prisma client, apply the checked-in
   PostgreSQL migration, and seed the initial settings, admin, and main
   warehouse:

   ```powershell
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

4. Open `http://localhost:3000` for the storefront or
   `http://localhost:3000/admin/login` for staff sign-in.

## Git-based production deployment

This app needs a Node.js server and PostgreSQL; it cannot run as a static-only
site. Vercel is the recommended Git deployment target, and other hosts that
support Next.js 16 and Node.js 20.19 or newer can use the same commands.

1. Push this project to a GitHub, GitLab, or Bitbucket repository. Import that
   repository into Vercel and keep the detected Next.js build settings:
   install `npm install`, build `npm run build`, output directory default.
   Do not set a static export or a custom output directory.
2. Create a production PostgreSQL 14+ database with TLS enabled. Add these
   variables to the hosting provider's **Production** environment (and
   Preview too if preview deployments should connect to a separate database):

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `DATABASE_URL` | Yes | PostgreSQL connection string for the app and migrations. Use the provider's pooled URL only if it supports the app's transaction workload; otherwise use the direct URL. |
   | `AUTH_SECRET` | Yes | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep it stable across deploys. |
   | `RESELLER_ENCRYPTION_KEY` | Yes | Generate a separate key with the same command and keep it stable; it is needed to save/decrypt reseller credentials and digital license keys. Back it up securely. |
   | `SEED_ADMIN_EMAIL` | Initial setup | Email for the first administrator. |
   | `SEED_ADMIN_PASSWORD` | Initial setup | Unique password of at least 12 characters. Remove both seed variables after the first seed run. |
   | `STORE_NAME`, `STORE_TAGLINE`, `ORDER_NUMBER_PREFIX`, `STORE_CONTACT_EMAIL`, `STORE_CONTACT_PHONE`, `STORE_CONTACT_ADDRESS` | Optional | Initial store defaults; existing settings are not overwritten by seed. |
   | `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GTM_ID` | Optional | Analytics IDs; scripts are consent-gated. Set before building if used. |

   Never commit `.env` or put secrets in `NEXT_PUBLIC_*` variables. `.env.example`
   is only a local template and its placeholder values are not production-ready.
3. Before the first app deploy, run migrations against the production database
   from a trusted terminal with production `DATABASE_URL` configured:

   ```sh
   npm ci
   npm run db:generate
   npm run db:deploy
   npm run db:seed
   ```

   Use `npm run db:deploy` for every production release that adds a migration.
   `npm run db:migrate` is for local development only. The seed is safe to
   re-run for store defaults, but only creates the initial admin if it does not
   already exist. Remove `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` after
   creating the account.
4. Trigger the first deployment from the hosting provider. Later pushes to the
   production branch deploy automatically. Set the same production secrets in
   the provider before the first build. Configure a custom domain and HTTPS in
   the provider dashboard.

GitHub Actions runs lint, unit tests, and a production build for pushes and pull
requests. A passing build does not confirm that production database credentials,
migrations, payment providers, or external integrations are live; verify the
deployed storefront and `/admin/login` after deployment.

The seed creates the initial admin only when both seed credentials are
provided. It also creates the Standard shipping class and default delivery
rates (Dhaka ৳70, Chattogram ৳90, elsewhere ৳130; first 1 kg included and ৳20
per additional started kg). Re-running it does not overwrite an existing
account's role/password or configured delivery rates. Additional users can be
assigned `ADMIN`, `MANAGER`, or `STAFF` in the database; user provisioning UI
is intentionally outside this step.

## Catalog and inventory

- Products support physical or digital types, categories, brands, images, and
  variants with BDT pricing, unique SKUs, size, and color.
- FIFO inventory batches retain their warehouse, received quantity, remaining
  quantity, and unit cost. Adjustments and transfers are recorded in an audit
  history; the main warehouse is created by the seed.
- Digital assets support HTTPS download references and AES-256-GCM encrypted
  license keys. This phase does not upload files or deliver assets during
  checkout.
- The protected operations dashboard includes product editing, digital asset
  management, catalog tools, stock adjustments/transfers, and reseller source
  setup.

The checked-in initial migration already contains the app-compatible
equivalents of the supplied SQL. It uses Prisma's `TEXT`/CUID identifiers and
normalized fields rather than creating duplicate tables: product `title` and
`base_price_bdt` correspond to `products.name` and `products.price`;
`product_images` replaces the JSON image array; `digital_assets` stores
download references and encrypted license keys; `inventory_batches` is the
warehouse-aware FIFO batch table; and `stock_adjustments.quantity_change` and
`note` represent the quantity delta and reason. Reseller auth and markup
labels are represented by PostgreSQL enums. Deleting a reseller source keeps
imported products by nulling their source relation rather than cascading
product deletion.

## Reseller API contract

The adapter is vendor-neutral because no specific supplier API was provided.
Set each source's base URL to the API root. Crazy Cart requests
`<base-url>/products?limit=500` with `Accept: application/json` and either a
`Bearer` authorization header or an `X-API-Key` header. The API may return a
JSON array, `{ "products": [...] }`, `{ "data": [...] }`, or
`{ "data": { "products": [...] } }`.

Each product needs `id` or `external_product_id`, `title`, and a supplier
price. Optional fields are `description`, `images`, `stock`, and `variants`.
Variant entries can include `id`/`external_variant_id`, `sku`, `name`, `size`,
`color`, `stock`, and `supplier_price`. Product-level supplier price and stock
are used as defaults when variant values are omitted. Images can be URL
strings or objects with `url` and optional `alt_text`/`altText`.

Sync upserts by reseller source and external product ID, computes retail BDT
prices from the source markup, reconciles source quantities against FIFO
batches in the main warehouse, and updates `last_synced_at` after a successful
complete sync. Responses are limited to 5 MB and 500 products per sync.
Supplier endpoints must use public HTTPS hosts. This generic adapter may need
an explicit vendor-specific mapping before connecting a supplier with a
different API contract.

The encryption key must remain stable to decrypt saved credentials and license
keys. Back it up securely; rotating it requires a planned re-encryption process,
which is not part of this phase.

## Storefront and checkout

- The public storefront has configurable theme colors, announcement, home hero,
  footer/contact details, product search/category browsing, product details,
  size guides, guest reviews with manager/admin moderation, active offers, and
  dismissible offer notices.
- The cart is stored in the browser. At checkout, product/variant prices,
  availability, promo code, shipping, and stock are re-read on the server;
  browser-provided prices are never trusted.
- Shipping uses the active zone rate, total physical weight, and each distinct
  active shipping-class surcharge once per package. Digital-only orders have no
  shipping charge. Products without an explicit class use the seeded Standard
  class. Admins can optionally set a BDT free-delivery threshold in General
  Settings; it is checked against the merchandise subtotal before promo
  discounts and waives all delivery charges, including weight and class
  surcharges. Leaving it blank disables free delivery.
- In-stock physical orders reserve FIFO batches in one serializable transaction.
  If a product permits preorder and any physical line is short, the order
  reserves no stock; the order is marked `PENDING` when
  `autoMoveToPending` is enabled. Otherwise, unavailable stock blocks checkout.
- Digital license-key products check available keys and reserve each key once;
  downloadable assets remain reusable. Digital delivery/download access is not
  automated in this phase, and key values are never shown on the thank-you page.
- COD orders with stock are confirmed. bKash, Nagad, and SSLCommerz are only
  payment-method scaffolding: no gateway is connected and these orders remain
  `AWAITING_PAYMENT`/`PENDING`; the app never marks an unverified payment as
  successful.
- Order numbers use the configured prefix followed by a transactionally
  incremented, zero-padded sequence, for example `1001-000001`.
- Marketing events are consent-gated. Configured Meta Pixel, Google Analytics,
  or Tag Manager scripts load only after opt-in. The client event dispatcher
  and Meta CAPI payload builder are extension points; no server-side CAPI
  request is sent yet. Do not include customer contact details in marketing
  event payloads.

The storefront checkout migration is additive. Applying migrations and
seeding requires a reachable PostgreSQL instance; the database connection and
live order flow are not tested by the repository's local unit suite.

## Order operations

- Staff can search orders, record quick notes, update allowed statuses, scan an
  order number, and open invoice or parcel-label print views. Confirming a
  pending order reserves FIFO inventory; cancellation releases reservations
  only when payment and courier state allow it.
- The POS stores offline sales in this browser's IndexedDB queue. Keep the
  authenticated POS page open while disconnected. On sync, the server
  revalidates current prices and stock and uses an idempotency key; conflicts
  remain for staff review. Clearing browser data removes unsynced sales.
- Supplier purchase orders can be received into a selected warehouse; each
  receipt adds a costed FIFO batch and an audit adjustment in one transaction.
- Customer profiles show normalized-phone order history and returns. Fraud
  checks currently report local history only as `UNKNOWN`; this is not an
  external fraud verdict.
- The generic courier adapter boundary and booking models are present, but
  provider credentials, settings, and live Steadfast/Pathao/RedX calls are
  intentionally not enabled until their official API contracts are supplied
  and verified. Do not mark an order shipped based on an unverified request.

## Accounting and reports

- Admins and managers can create cash, bank, mobile-wallet, and other accounts;
  the masked reference field must not contain a full account number or secret.
  Opening balances plus posted income, expenses, and transfers determine the
  current recorded balance. Entries are not edited or deleted; corrections
  should be recorded as offsetting transactions.
- Income and expense categories are separate. Payroll is prepared once per
  staff member and month; marking it paid posts the net amount as an expense.
  Tax, statutory benefits, and payslip delivery are not configured.
- Delivered COD bookings can be reconciled against the gross remittance and
  courier fee. Both ledger entries are posted transactionally to the selected
  account. Provider booking APIs remain disabled pending verified contracts.
- The activity log records important order, inventory, purchasing, account,
  payroll, and COD reconciliation actions. Notes and payment credentials are
  not copied into audit summaries.
- The dashboard defaults to today's Bangladesh date and supports date/status
  filters. Booked sales exclude pending, unpaid, returned, and cancelled
  orders; estimate-from-orders includes pending and unpaid orders but excludes
  returned/cancelled orders. “All caught up” covers pending/payment orders,
  failed courier bookings, and delivered COD remittances awaiting reconciliation.
- Profit reports use delivered status-change dates, allocated FIFO batch costs,
  recorded non-COD income, and recorded expenses. They are estimates: uncosted
  units, digital-product costs, taxes, and costs not entered in the ledger are
  not inferred. Stock valuation is a current FIFO-cost snapshot. Customer
  performance uses order placement dates, while courier performance uses
  booking creation dates.
- Subscription usage is informational only. No subscription provider, plan,
  or quota limit is configured for this single-store deployment.

## Structure

- `src/app/(storefront)` — public customer storefront
- `src/app/admin` — staff login and protected operations pages
- `src/app/admin/(protected)/inventory` — products, digital assets, reseller
  import, and sync
- `src/app/admin/(protected)/catalog` and `stock` — categories, brands,
  warehouses, FIFO adjustments, transfers, and audit history
- `src/app/admin/(protected)/accounting` — financial accounts, ledger,
  payroll, courier COD reconciliation, and activity history
- `src/app/admin/(protected)/reports` — sales, profit, stock, customer, and
  courier reports
- `src/auth` — credentials authentication and server-side role checks
- `src/lib` — shared PostgreSQL client, inventory, pricing, secret encryption,
  reseller adapter/services, accounting, and analytics
- `prisma` — PostgreSQL schema, initial migration, and settings/admin/warehouse
  seed

Real payment gateway integrations, verified provider-specific courier APIs,
file uploads, and digital fulfillment remain outside this phase.

Protect each future server action, API route, and data access boundary with
`requireStaff` or `requireStaff(["ADMIN", "MANAGER"])`; a protected layout is
not a substitute for authorization at data boundaries.
