# TaxSeer Frontend – Investigation Report

## Summary

This is a **tax-filing SaaS application** (TaxSeer) built on Angular 22.1 (Fuse template). It allows tax professionals to manage filers, recipients, file IRS information returns (1099-NEC, W-2, 1095-C, etc.), manage W-9 requests, and view orders/filings. Every single data source in the app is **hardcoded dummy data** — there are zero HTTP API calls to a real backend in the business logic. `provideHttpClient()` is configured in `app.config.ts` but is only used by the Transloco i18n loader. No environment files exist. There is no "add-to-cart" standalone component — cart logic is embedded inside the dashboard component, which is why the user says it "isn't running" as a separate component.

---

## 1. App Overview and Purpose

TaxSeer is a US IRS e-filing platform for accountants. Key capabilities:
- **Dashboard**: Launch new filings (manual entry or bulk CSV import), see resume items, filer table with search
- **Filing Wizard**: 5-step wizard — choose filer → choose form & year → select recipients → enter amounts → review and add to cart
- **Filer Details**: Tabbed detail view per filer (filer info, recipients, filings pipeline, orders, downloads, summary)
- **Recipients / W-9**: Manage recipients and track W-9 request status across filers
- **Orders**: History of past filings submitted to IRS/SSA
- **Settings**: Account profile, user management, role permissions

---

## 2. Routes and Pages

All routes live under `/taxseer/…`

| URL pattern | Component | File |
|---|---|---|
| `/taxseer/dashboard` | `TaxseerDashboard` | `pages/dashboard/dashboard.ts` |
| `/taxseer/filers/:filerId` | `FilerDetailsComponent` | `pages/filer-details/filer-details.ts` |
| `/taxseer/recipients` | `TaxseerRecipients` | `pages/recipients/recipients.ts` |
| `/taxseer/orders` | `TaxseerOrders` | `pages/orders/orders.ts` |
| `/taxseer/settings` | `Settings` | `pages/settings/settings.ts` |
| `/taxseer/filing/new` | → redirect to dashboard | `routes.ts` |
| `/taxseer/filers` | → redirect to `/taxseer/filers/1` | `routes.ts` |
| `/taxseer/w9` | → redirect to `/taxseer/recipients` | `routes.ts` |

Route file: `src/app/views/taxseer/routes.ts`  
Root route file: `src/app/app.routes.ts`  
Layout: `src/app/views/taxseer/layout/taxseer-layout.ts` (wraps all routes, renders top nav + `<router-outlet>`)

---

## 3. All Services and Data Sources

### Services (Angular Injectable)

| Service | File | Data Source |
|---|---|---|
| `TaxseerFilerStore` | `data/taxseer-filers.data.ts` | **In-memory signal store, seeded from hardcoded `SEED` array** |
| `TranslocoHttpLoader` | `core/transloco/transloco-http-loader.ts` | HTTP GET `/i18n/{lang}.json` — the only real HTTP call in the entire app |

### Hardcoded Data Arrays (all dummy)

| Constant | File | Description |
|---|---|---|
| `TAXSEER_FILERS` / `SEED` | `data/taxseer-filers.data.ts` | 9 filer companies with EIN, address, form types, stats |
| `TAXSEER_ORDERS` | `pages/orders/orders.data.ts` | 9 hardcoded IRS order records |
| `FILER_RECIPIENTS` | `pages/filer-details/filer-details.data.ts` | 8 recipients (filerId 1 and 9) |
| `FILER_FILINGS` | `pages/filer-details/filer-details.data.ts` | ~60 filing rows (mix of statuses) |
| `FILER_DOWNLOADS` | `pages/filer-details/filer-details.data.ts` | 3 download records |
| `INITIAL_ORDERS` | `pages/orders/orders.ts` | 8 order records (duplicate of orders.data.ts with slightly different shape) |
| `INITIAL_RECIPIENTS` | `pages/recipients/recipients.ts` | 11 W-9 recipient records |
| Dashboard inline arrays | `pages/dashboard/dashboard.ts` | Filers, recipients, resumeItems — all hardcoded in component class |

### No HTTP Calls Exist in Business Logic

- `provideHttpClient()` is registered in `app.config.ts` but no component or business service injects `HttpClient`
- No `environment.ts` or `environment.prod.ts` files exist anywhere in the project
- No `environments/` folder exists under `src/`

---

## 4. Data Models / Interfaces

### Filer (two versions, nearly identical)

```typescript
// Canonical (taxseer-filers.data.ts)
type TaxseerFiler = {
  id: number; name: string; ein: string;
  address: string; address2: string; city: string; state: string; zip: string;
  email: string; phone: string; stateId: string; name2: string; mask: boolean;
  formsUsed: string[];
  pending: number; ready: number; filed: number;
  w9Total: number; w9Required: number; w9Received: number;
  warning?: string;
}

// Dashboard-local (dashboard.ts)
type Filer = { id, name, ein, address, address2?, city, state, zip, phone?, email?,
  stateNo?, forms: string[], recent?, pending, filed, w9Total, w9Received, w9Waiting }
```

### Recipient (two versions)

```typescript
// Dashboard-local
type Recipient = { id, filerId, name, first?, middle?, last?, dba?,
  tin, type: 'SSN'|'EIN'|'Unknown', country?, address, address2?,
  city, state, zip, email, econsent: boolean, w9: string,
  pendingForm?: boolean, selected?: boolean }

// filer-details.data.ts
type FilerRecipient = { id: string, filerId: number, type, tin, name,
  address, city, state, zip, email, w9: 'Requested'|'Submitted'|'Not requested' }
```

### Orders

```typescript
type TaxseerOrder = { id, filerName, formSummary, placedDate, taxYear, forms, amount,
  status: 'rejected'|'in-process'|'accepted', rejectedForms, acceptedForms,
  recipientCopies, downloadable, detail?: { filingType, submissionId, ... } }

type OrderItem = { no, filer, placed, year, forms: Record<string,number>, amt,
  status: 'process'|'accepted'|'rejected', rej?, copies, files: 'ready'|'none'|'expired' }
```

*(Note: `TaxseerOrder` and `OrderItem` are the same domain entity with different field names — this should be unified.)*

### Filing / Forms

```typescript
type FilerFiling = { id, filerId, taxYear, form: string, recipient, tin,
  amount: number|null, status: FilingStatus, edited, order?, issue? }

type FilingStatus = 'Pending'|'Completed'|'In cart'|'Submitted'|'Accepted'|'Rejected'
```

### NEC Amount Row (form box entry)

```typescript
type NecAmountRow = { id, name, tin, address,
  box1, box4, box5, box7: number|null, box2: boolean, box3: number|null,
  state, payerStateNumber, accountNumber, secondTin: boolean,
  recipientIssues: string[], warning: string, expanded: boolean }
```

### Settings Types

```typescript
type User = { id, first, last, email, role, filers: 'all'|string[], status, last_in, you? }
type Role = { k, name, desc, locked?, permissions?: string[] }
type Me = { first, last, email, phone }
```

---

## 5. The Add-to-Cart Situation

### Problem
There is **no standalone "add-to-cart" component**. Cart logic is embedded directly inside `TaxseerDashboard` (`dashboard.ts`).

### What "add to cart" currently does
1. The filing wizard's Step 5 (Review) shows a summary and a button "Add N forms to cart"
2. Clicking it calls `addToCart()` in `dashboard.ts`:
   ```typescript
   addToCart(): void {
     const count = this.formCount();
     this.cartCount += count;  // just increments a local number
     this.doneCount = count;
     this.activeView = 'done'; // switches to a "done" confirmation view
   }
   ```
3. The cart count is displayed in the top nav as a hardcoded `52` in `taxseer-top-nav.html`
4. The "Review cart" button on the dashboard calls `notify('Cart opened')` — it's a no-op toast
5. There is no cart page, no cart service, no checkout flow

### Why it "isn't running"
- `addToCart()` only mutates local component state (`cartCount`, `activeView`) — **it does not persist anything**
- The top nav always shows `52` regardless of what happens in the wizard
- There is no inter-component communication between the dashboard's cart state and the nav
- Clicking "Review cart" or "Checkout" triggers toast messages only
- `addSelectedToCart()` in `filer-details.ts` changes a local `FilingStatus` to `'In cart'` but this is also ephemeral in-memory state

### Fix needed
A new `CartComponent` (panel/drawer) and a `CartService` (injectable) need to be created to:
1. Hold cart state (list of form submissions + total count)
2. Be shared between `dashboard`, `filer-details`, and the top nav
3. Replace the hardcoded `52` in the nav with a real cart count signal
4. Wire the "Review cart" / "Checkout" buttons to open the cart component

---

## 6. Search Functionality Details

### Filer Search (Dashboard + Wizard Step 1)
- **Location**: `dashboard.ts` → `filteredFilers` computed getter
- **Mechanism**: Client-side string filter on `name + ein`
- **Current**: Filters the local `readonly filers: Filer[]` array
- **API replacement**: `GET /api/filers?q={query}` — query parameter search

```typescript
get filteredFilers(): Filer[] {
  const query = this.filerSearch.toLowerCase().replace(/-/g, '').trim();
  return this.filers.filter(filer =>
    `${filer.name} ${filer.ein}`.toLowerCase().replace(/-/g, '').includes(query)
  );
}
```

### Recipient Search (Wizard Step 3 / Filer Details)
- **Location**: `dashboard.ts` → `visibleRecipients` getter + `recipientSearch` field
- **Mechanism**: Client-side filter on `name` and last 4 of TIN, also by `filerId`
- **API replacement**: `GET /api/recipients?filerId={id}&q={query}`

```typescript
// filer-details.ts — also computed signal
readonly filteredRecipients = computed(() => {
  const q = this.recipientSearch().trim().toLowerCase();
  return this.recipients().filter(r =>
    `${r.name} ${r.tin.slice(-4)} ${r.city}`.toLowerCase().includes(q)
  );
});
```

### Order Search (Orders page)
- **Location**: `orders.ts` → `filteredOrders` getter
- **Mechanism**: Client-side filter by filer name, year, status, and free-text search on order number/filer name
- **API replacement**: `GET /api/orders?filer={name}&year={year}&status={status}&q={query}`

### W-9 Recipient Search (Recipients page)
- **Location**: `recipients.ts` → `matchesFilters()` private method
- **Mechanism**: Client-side filter by status tile + free-text on filer + recipient name
- **API replacement**: `GET /api/w9-requests?status={status}&q={query}`

### Form Search (Wizard Step 2)
- **Location**: `dashboard.ts` → `matchesFormQuery()` method
- **Mechanism**: Client-side filter on form code + label from hardcoded `formGroups` array
- **This list is static**: form types (1099-NEC, W-2, etc.) won't change — keep local or make a `GET /api/form-types` call

---

## 7. What Needs to Be Replaced with Real API Calls

### Priority 1 — Core Data CRUD

| What | Current | API endpoint needed |
|---|---|---|
| List filers | `TAXSEER_FILERS` const array | `GET /api/filers` |
| Search filers | client-side filter | `GET /api/filers?q=` |
| Get single filer | `TaxseerFilerStore.getById()` | `GET /api/filers/{id}` |
| Create filer | `TaxseerFilerStore.save()` (in-memory) | `POST /api/filers` |
| Update filer | `TaxseerFilerStore.save()` (in-memory) | `PUT /api/filers/{id}` |
| Delete filer | not implemented | `DELETE /api/filers/{id}` |

| What | Current | API endpoint needed |
|---|---|---|
| List recipients by filer | local array filter on `filerId` | `GET /api/recipients?filerId=` |
| Search recipients | client-side | `GET /api/recipients?filerId=&q=` |
| Create recipient | push to local array | `POST /api/recipients` |
| Update recipient | `Object.assign()` on local array item | `PUT /api/recipients/{id}` |
| Delete recipient | filter local array | `DELETE /api/recipients/{id}` |
| Copy recipients to another filer | local array manipulation | `POST /api/recipients/copy` |

| What | Current | API endpoint needed |
|---|---|---|
| List filings by filer+year | `FILER_FILINGS` const filtered | `GET /api/filings?filerId=&year=` |
| Create filing | not implemented | `POST /api/filings` |
| Update filing status | local signal update | `PATCH /api/filings/{id}/status` |
| Delete filing | local signal filter | `DELETE /api/filings/{id}` |

### Priority 2 — Filing Workflow

| What | Current | API endpoint needed |
|---|---|---|
| Add forms to cart | local `cartCount++` | `POST /api/cart/items` |
| Get cart | hardcoded count 52 | `GET /api/cart` |
| Remove from cart | local status change | `DELETE /api/cart/items/{id}` |
| Checkout / submit | `notify('Checkout opened')` toast | `POST /api/orders` |
| Submit bulk import CSV | `demoBulkRows()` generates fake data | `POST /api/filings/bulk-import` |

### Priority 3 — W-9 and Orders

| What | Current | API endpoint needed |
|---|---|---|
| W-9 request status | `INITIAL_RECIPIENTS` local array | `GET /api/w9-requests?filerId=` |
| Send W-9 request | sets local `status='Requested'` | `POST /api/w9-requests` |
| Resend W-9 reminder | increments local `rem` counter | `POST /api/w9-requests/{id}/remind` |
| List orders | `INITIAL_ORDERS` const | `GET /api/orders` |
| Order detail | inline in order object | `GET /api/orders/{id}` |
| Download files | `prepareDownload()` fake timeout | `POST /api/downloads` + `GET /api/downloads/{id}` |

### Priority 4 — Authentication / Settings

| What | Current | API endpoint needed |
|---|---|---|
| Current user profile | hardcoded `me: Me` | `GET /api/me` |
| Update profile | local assignment | `PUT /api/me` |
| List users | hardcoded array | `GET /api/users` |
| Invite user | push to local array | `POST /api/users/invite` |
| Update user | `Object.assign()` | `PUT /api/users/{id}` |
| Remove user | filter local array | `DELETE /api/users/{id}` |
| Wallet balance | hardcoded `$100` in top nav HTML | `GET /api/wallet` |

---

## 8. Suggested Java Spring Boot API Endpoints

### Base URL convention: `/api/v1/`

```
# Auth
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

# Filers
GET    /api/v1/filers?q={query}&page={n}&size={n}
POST   /api/v1/filers
GET    /api/v1/filers/{id}
PUT    /api/v1/filers/{id}
DELETE /api/v1/filers/{id}

# Recipients
GET    /api/v1/recipients?filerId={id}&q={query}&w9Status={status}
POST   /api/v1/recipients
GET    /api/v1/recipients/{id}
PUT    /api/v1/recipients/{id}
DELETE /api/v1/recipients/{id}
POST   /api/v1/recipients/copy            # body: { recipientIds, targetFilerId }

# W-9
GET    /api/v1/w9-requests?filerId={id}&status={status}&q={query}
POST   /api/v1/w9-requests                # body: { recipientId }
POST   /api/v1/w9-requests/{id}/remind

# Filings (form drafts)
GET    /api/v1/filings?filerId={id}&taxYear={year}&status={status}&q={query}
POST   /api/v1/filings                    # manual entry
POST   /api/v1/filings/bulk-import        # multipart/form-data CSV upload
GET    /api/v1/filings/{id}
PUT    /api/v1/filings/{id}
PATCH  /api/v1/filings/{id}/status
DELETE /api/v1/filings/{id}

# Cart
GET    /api/v1/cart
POST   /api/v1/cart/items                 # body: { filingIds }
DELETE /api/v1/cart/items/{filingId}

# Orders (IRS submissions)
GET    /api/v1/orders?filerId={id}&year={year}&status={status}&q={query}
POST   /api/v1/orders                     # checkout — submits cart to IRS
GET    /api/v1/orders/{id}

# Downloads
POST   /api/v1/downloads                  # body: { filerId, taxYear, type }
GET    /api/v1/downloads?filerId={id}
GET    /api/v1/downloads/{id}/file        # streams the file

# Users & Settings
GET    /api/v1/me
PUT    /api/v1/me
GET    /api/v1/users
POST   /api/v1/users/invite
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}
GET    /api/v1/roles
PUT    /api/v1/roles/{key}/permissions

# Wallet
GET    /api/v1/wallet
POST   /api/v1/wallet/add-funds
```

### PostgreSQL tables implied by the data models
- `filers` — maps to `TaxseerFiler`
- `recipients` — maps to `FilerRecipient` / dashboard `Recipient`
- `filings` — maps to `FilerFiling`
- `w9_requests` — maps to `recipients.ts` `Recipient` (status, sent date, reminders)
- `orders` — maps to `TaxseerOrder`
- `order_items` — filings linked to an order
- `cart_items` — current user's in-progress cart (filingId + userId)
- `downloads` — maps to `FilerDownload`
- `users` — maps to `User`
- `roles` — maps to `Role`
- `role_permissions` — maps to `grants` Record

---

## 9. Key Integration Notes for the Java Backend

### Search — Use Query Parameters
The user requested query-param-based search. All search calls should follow:
```
GET /api/v1/filers?q=tech&page=0&size=20
GET /api/v1/recipients?filerId=1&q=mark&w9Status=Requested
GET /api/v1/orders?filer=1&year=2025&status=accepted&q=1204
```
Spring Boot: use `@RequestParam` with `Optional<String>` and JPA `Specifications` or `@Query` with `LIKE`.

### Add-to-Cart Component
Create a new `CartComponent` (`src/app/views/taxseer/components/cart/cart.component.ts`) as a slide-in panel. Create a `CartService` (`src/app/views/taxseer/services/cart.service.ts`) as a singleton that:
1. Fetches cart state from `GET /api/v1/cart`
2. Exposes an Angular signal for cart count (used by the top nav)
3. Is injected by both `dashboard.ts` and the new `CartComponent`

The top nav currently has `52` hardcoded in `taxseer-top-nav.html` — this must be replaced with `{{ cartService.count() }}`.

### No Changes to CSS or UI Layout
- All styling changes are forbidden per user request
- The `CartComponent` should use existing CSS classes from the project's Tailwind theme (`.card`, `.taxseer-navy`, `.btn`, etc.) as seen in `STYLING.md`
- The component can be a new file but must match the existing visual theme

### Dashboard Duplicate Data
`dashboard.ts` has its own inline `readonly filers: Filer[]` and `recipients: Recipient[]` arrays that are **separate copies** of the data in `taxseer-filers.data.ts`. When integrating the API, both sets need to be replaced via the same service, not patched separately.

### Angular Version
Angular **22.1** — use standalone components, `inject()` function, `signal()` / `computed()` for state (not RxJS BehaviorSubjects unless needed for HTTP), and `HttpClient` with `inject(HttpClient)`.

---

## 10. Files Not to Touch

Per user instructions: **do not modify any CSS, SCSS, or HTML layout**. Only logic files:
- All `.scss` files — **hands off**
- `taxseer-top-nav.html` — only change the `52` cart count binding, not the HTML structure
- `STYLING.md` — reference only

---

## Conclusions

1. **The app is a complete UI prototype** with rich, working logic — all against hardcoded data.
2. **Zero real HTTP calls** exist in the business layer today. The `provideHttpClient()` setup is in place though, so adding `HttpClient` usage requires no app-config change.
3. **The "add-to-cart" is broken** because it's embedded in the dashboard component with no service layer and no communication to the top nav. It needs a `CartService` + `CartComponent`.
4. **Two conflicting data shapes** exist for Orders (`TaxseerOrder` vs `OrderItem`) — pick one when building the API layer.
5. **The Java backend should expose REST endpoints** as listed in section 8, with all searches via `?q=` query params.
6. **No environment files exist** — create `src/environments/environment.ts` and `environment.prod.ts` with `apiBaseUrl` before wiring HTTP calls.
