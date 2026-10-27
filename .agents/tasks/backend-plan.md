# TaxSeer Backend Implementation Plan

## Codebase Investigation Summary

### What is already in place

**Backend** (`D:\Rasool\Project\TAXSEER\Taxseer-Backend`)
- Spring Boot **4.1.1**, Java **21**, fully compiles (`.\mvnw.cmd compile` → BUILD SUCCESS).
- `pom.xml` dependencies confirmed present:
  - `spring-boot-starter-webflux` ✓
  - `spring-boot-starter-data-r2dbc` ✓
  - `r2dbc-postgresql 1.0.5.RELEASE` ✓
  - `postgresql` (JDBC, runtime scope) ✓
  - `lombok` (optional, annotation-processor path configured) ✓
- `application.properties` — DB wired to AWS RDS PostgreSQL via R2DBC. **Do not touch.**
- `schema.sql` — currently only the `test` table. Will be **replaced entirely**.
- `TaxseerApplication.java` — bare `@SpringBootApplication` main class. Safe to leave alone.
- `com.taxseer.Test.*` — working CRUD example. Pattern: `@Table` entity + Lombok, `R2dbcRepository`, `@RestController` with constructor-injected repo. **Do not touch this package.**

**Frontend** (`D:\Rasool\TaxSeerPractice\tax-filing-frontend-fuse-`)
- Angular 19, Angular Material, Tailwind. No HTTP calls today — everything uses in-memory arrays.
- Pages that need API wiring: **Dashboard** (filing wizard), **Filer Details**, **Recipients/W-9**, **Orders**, **Settings**.
- Existing dummy data shapes are the source of truth for entity design:
  - `TaxseerFiler` — 9 filers, fields: id, name, ein, address/city/state/zip, email, phone, stateId, name2, mask, formsUsed[], pending/ready/filed/w9 counts.
  - `FilerRecipient` — per-filer, fields: id, filerId, type (SSN/EIN), tin, name, address, city, state, zip, email, w9 status.
  - `FilerFiling` — per-filer/year, fields: id, filerId, taxYear, form, recipientName, tin, amount, status (Pending/Completed/In cart/Submitted/Accepted/Rejected), issue, orderId, editedAt.
  - `TaxseerOrder` — fields: id (string), filerName, formSummary, placedDate, taxYear, forms, amount, status (rejected/in-process/accepted), rejectedForms, acceptedForms, recipientCopies, downloadable, detail.
  - `FilerDownload` — fields: id, filerId, by, date, type, forms, status (Ready/Preparing/Expired).
  - Users — first, last, email, phone, role (accountant/preparer/reviewer/viewer), filers (all | string[]), status (Active/Invited).
  - Roles — key, name, desc, locked, permissions[].

### Compilation concerns
- None in existing code. The Test package is clean.
- `spring-boot-starter-data-r2dbc-test` and `spring-boot-starter-webflux-test` exist as test deps but no tests are written — no concern.
- Spring Boot 4.x uses `@EnableR2dbcAuditing` if `@CreatedDate`/`@LastModifiedDate` are used; plan avoids auditing annotations to keep entities simple.
- R2DBC does not support `@JoinColumn` or JPA relationships — all foreign keys are plain `Long` fields. Already the pattern in the Test class.

---

## Packages to create

| Package | Path |
|---|---|
| `com.taxseer.config` | CORS + DataSeeder |
| `com.taxseer.filer` | Filer CRUD |
| `com.taxseer.recipient` | Recipient CRUD |
| `com.taxseer.filing` | Filing CRUD |
| `com.taxseer.cart` | Cart + checkout |
| `com.taxseer.order` | Order read/write |
| `com.taxseer.w9` | W-9 request lifecycle |
| `com.taxseer.download` | Download records |
| `com.taxseer.user` | User management |
| `com.taxseer.role` | Role management |
| `com.taxseer.wallet` | Wallet balance |

---

## Implementation Plan

- [ ] 1. **Replace schema.sql with full domain schema.**
      Drop-and-recreate (via `IF NOT EXISTS`) all 10 domain tables: `filer`, `recipient`, `filing`, `cart_item`, `taxseer_order`, `w9_request`, `download`, `app_user`, `app_role`, `wallet`. Keep the original `test` table at the bottom unchanged so the Test package compiles.
      Files: `src/main/resources/schema.sql`
      Verify: `.\mvnw.cmd compile` from backend dir → BUILD SUCCESS.

- [ ] 2. **Create CORS configuration.**
      `com.taxseer.config.CorsConfig` — a `@Configuration` class with a `@Bean CorsWebFilter` allowing origin `http://localhost:4200` with all methods and headers. This is required for the Angular dev server to call the API.
      Files: `src/main/java/com/taxseer/config/CorsConfig.java`
      Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 3. **Create `filer` package (entity → repo → service → controller).**
      Entity `Filer.java` mapped to table `filer`. `FilerRepository` extends `R2dbcRepository<Filer, Long>` + derived query method for name/ein search. `FilerService` wraps repo with `findAll()`, `search(String q)`, `findById()`, `save()`, `delete()`. `FilerController` at `/api/filers` — GET with optional `?q=` query param, GET `/{id}`, POST, PUT `/{id}`, DELETE `/{id}`.
      Files: `src/main/java/com/taxseer/filer/{Filer,FilerRepository,FilerService,FilerController}.java`
      Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 4. **Create `recipient` package.**
      Entity `Recipient.java` (`recipient` table, FK `filer_id`). Repo: `findByFilerId`, `findByFilerIdAndNameContainingIgnoreCase`. Service + controller at `/api/recipients` with `?filerId=` and optional `?q=` query params. CRUD endpoints.
      Files: `src/main/java/com/taxseer/recipient/{Recipient,RecipientRepository,RecipientService,RecipientController}.java`
      Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 5. **Create `filing` package.**
      Entity `Filing.java` (`filing` table). Repo: `findByFilerId`, `findByFilerIdAndTaxYear`, `findByFilerIdAndStatus`. Controller at `/api/filings` with optional `?filerId=`, `?taxYear=`, `?status=` query params. Add `PATCH /{id}/status` endpoint that accepts `{status}` in request body to update filing status.
      Files: `src/main/java/com/taxseer/filing/{Filing,FilingRepository,FilingService,FilingController}.java`
      Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 6. **Create `cart` package.**
      Entity `CartItem.java` (`cart_item` table, FK `filing_id`). Service with `add()`, `remove()`, `getCart(Long userId)`, `checkout(Long userId)` — checkout sets all associated `Filing` statuses to `"In cart"`. Controller at `/api/cart`.
      Files: `src/main/java/com/taxseer/cart/{CartItem,CartRepository,CartService,CartController}.java`
      Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 7. **Create `order` package.**
      Entity `TaxseerOrder.java` (`taxseer_order` table, String `@Id`). Repo: `findByFilerIdAndStatus`, `findByStatus`, `findByFilerNameContainingIgnoreCase`. Controller at `/api/orders` with optional `?status=`, `?q=`, `?filerId=` query params.
      Files: `src/main/java/com/taxseer/order/{TaxseerOrder,OrderRepository,OrderService,OrderController}.java`
      Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 8. **Create `w9` package.**
      Entity `W9Request.java` (`w9_request` table). Service methods: `send(recipientId, filerId)`, `remind(id)` (increments reminders), `markReceived(id)` (sets status to Submitted). Controller at `/api/w9` — GET `?filerId=`, POST `/send`, POST `/{id}/remind`, POST `/{id}/received`.
      Files: `src/main/java/com/taxseer/w9/{W9Request,W9Repository,W9Service,W9Controller}.java`
      Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 9. **Create `download` package.**
      Entity `Download.java` (`download` table). Controller at `/api/downloads` — GET `?filerId=`, POST `/`.
      Files: `src/main/java/com/taxseer/download/{Download,DownloadRepository,DownloadService,DownloadController}.java`
      Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 10. **Create `user` and `role` packages.**
       `AppUser.java` / `AppRole.java` entities. `UserController` at `/api/users` — full CRUD plus POST `/{id}/resend-invite`. `RoleController` at `/api/roles` — GET `/`, PUT `/{id}`.
       Files: `src/main/java/com/taxseer/user/{AppUser,AppUserRepository,UserService,UserController}.java` and `src/main/java/com/taxseer/role/{AppRole,AppRoleRepository,RoleService,RoleController}.java`
       Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 11. **Create `wallet` package.**
       Entity `Wallet.java` (`wallet` table). Controller at `/api/wallet` — GET `?userId=`, POST `/add-funds` body `{userId, amount}`.
       Files: `src/main/java/com/taxseer/wallet/{Wallet,WalletRepository,WalletService,WalletController}.java`
       Verify: `.\mvnw.cmd compile` → BUILD SUCCESS.

- [ ] 12. **Create DB DataSeeder.**
       `com.taxseer.config.DataSeeder` annotated `@Component @Profile("!test")` implementing `ApplicationRunner`. On startup, check `filerRepository.count().block() == 0` before inserting. Seed: 9 filers (matching the frontend dummy data), 8 recipients (matching FILER_RECIPIENTS), 10 representative filings (matching FILER_FILINGS), 9 orders (matching TAXSEER_ORDERS). This ensures the UI renders populated data on first boot.
       Files: `src/main/java/com/taxseer/config/DataSeeder.java`
       Verify: `.\mvnw.cmd spring-boot:run` starts; curl `http://localhost:8080/api/filers` returns a JSON array with 9 filers.

- [ ] 13. **Create Angular API service layer.**
       Add `provideHttpClient(withFetch())` to `app.config.ts`. Create `src/app/core/api/api.config.ts` (exports `API_BASE = 'http://localhost:8080'`). Create one Angular `@Injectable` service per domain: `filer.service.ts`, `recipient.service.ts`, `filing.service.ts`, `order.service.ts`, `cart.service.ts`, `w9.service.ts`, `download.service.ts`, `user.service.ts`, `role.service.ts`, `wallet.service.ts`. All methods return `Observable<T>` via `HttpClient`. Search methods use `?q=` query params, matching the backend controller signatures.
       Files: `src/app/app.config.ts`, `src/app/core/api/*.service.ts`
       Verify: `npm run build` → zero TypeScript errors.

- [ ] 14. **Wire Dashboard to FilerService + RecipientService.**
       In `dashboard.ts`: inject `FilerService` and `RecipientService`. Replace `readonly filers: Filer[]` hard-coded array with `filers: Filer[] = []` loaded from `filerService.getAll()`. Replace `recipients: Recipient[]` hard-coded array with `recipients: Recipient[] = []` loaded from `recipientService.getByFiler(selectedFilerId)` when a filer is selected. Wire filer search box to `filerService.search(q)`. Preserve all wizard step logic, amountRows, bulkRows, validation, and computed properties exactly as-is.
       Files: `src/app/views/taxseer/pages/dashboard/dashboard.ts`
       Verify: `npm run build` → zero TypeScript errors.

- [ ] 15. **Wire Filer Details to FilingService + RecipientService + DownloadService.**
       In `filer-details.ts`: inject `FilerService`, `RecipientService`, `FilingService`, `DownloadService`. When `routeId` signal changes, load recipients, filings, and downloads from API. Replace store.getById with `filerService.getById()`. Wire filer profile save to `filerService.update()`. Preserve all tab logic, filtering, and computed signals.
       Files: `src/app/views/taxseer/pages/filer-details/filer-details.ts`
       Verify: `npm run build` → zero TypeScript errors.

- [ ] 16. **Create new AddToCartComponent.**
       Create `src/app/views/taxseer/components/add-to-cart/add-to-cart.ts` + `add-to-cart.html`. Inputs: `filings: FilerFiling[]`, `userId: number`. Output: `cartUpdated EventEmitter`. Inject `CartService`. Show filing list, total count, price ($2/form), and an 'Add to cart' button. On click: call `cartService.addToCart()` for each filing using `concatMap`, emit `cartUpdated` on completion. Show disabled/spinner state during in-flight calls. Match existing pill classes (`p-ok`, `p-warn`, etc.) and use `mat-button`.
       Files: `src/app/views/taxseer/components/add-to-cart/add-to-cart.ts`, `add-to-cart.html`
       Verify: `npm run build` → zero TypeScript errors; AddToCartComponent selector renders in dashboard review step.

- [ ] 17. **Wire Recipients/W-9 page.**
       In `recipients.ts`: inject `RecipientService` + `W9Service`. Replace `INITIAL_RECIPIENTS` constant with API load on init. Wire `requestRecipient()` to `w9Service.sendRequest()`. Wire `resendRequest()` to `w9Service.remind()`. Keep all grouping, filtering, expand/collapse, and toast logic unchanged.
       Files: `src/app/views/taxseer/pages/recipients/recipients.ts`
       Verify: `npm run build` → zero TypeScript errors.

- [ ] 18. **Wire Orders page.**
       In `orders.ts`: inject `OrderService`. Replace `INITIAL_ORDERS` constant with API load on init. When filter/search params change, re-call `orderService.getAll({status, q, filerId})`. Map `TaxseerOrder` API shape to local `OrderItem` type via a private helper. Keep all filter chips, expand/detail, and toast logic unchanged.
       Files: `src/app/views/taxseer/pages/orders/orders.ts`
       Verify: `npm run build` → zero TypeScript errors.

- [ ] 19. **Wire Settings page + top-nav wallet balance.**
       In `settings.ts`: inject `UserService`, `RoleService`, `WalletService`. Replace in-memory `users` and `roles` arrays with API loads. Wire `saveUser()`, `removeUser()`, `resendInvite()`, and `saveRoles()` to corresponding API calls. In `taxseer-top-nav.ts`: inject `WalletService`, load balance into a `signal`. Update `taxseer-top-nav.html` to display `{{ walletBalance() }}` (this is the only HTML file that may be touched).
       Files: `src/app/views/taxseer/pages/settings/settings.ts`, `src/app/views/taxseer/layout/taxseer-top-nav.ts`, `src/app/views/taxseer/layout/taxseer-top-nav.html`
       Verify: `npm run build` → zero TypeScript errors; `.\mvnw.cmd compile` → BUILD SUCCESS.

---

## Entity→Endpoint quick reference

| Domain | Base URL | Key query params |
|---|---|---|
| Filer | `/api/filers` | `?q=` (search by name/ein) |
| Recipient | `/api/recipients` | `?filerId=`, `?q=` |
| Filing | `/api/filings` | `?filerId=`, `?taxYear=`, `?status=` |
| Cart | `/api/cart` | `?userId=` |
| Order | `/api/orders` | `?status=`, `?q=`, `?filerId=` |
| W-9 | `/api/w9` | `?filerId=` |
| Download | `/api/downloads` | `?filerId=` |
| User | `/api/users` | — |
| Role | `/api/roles` | — |
| Wallet | `/api/wallet` | `?userId=` |

---

## Constraints (must be respected by every step)

- **Never** modify `application.properties`.
- **Never** touch anything in `com.taxseer.Test.*`.
- **Never** modify any `.css`, `.scss`, or `.html` file in the frontend — except `taxseer-top-nav.html` (wallet balance binding only) and the new `add-to-cart.html`.
- All frontend changes are TypeScript logic only — data source replacement, not UI rewrites.
- PowerShell: chain commands with `;` not `&&`.
- Backend build command: `.\mvnw.cmd compile` from `D:\Rasool\Project\TAXSEER\Taxseer-Backend`.
- Frontend build command: `npm run build` from `D:\Rasool\TaxSeerPractice\tax-filing-frontend-fuse-`.
