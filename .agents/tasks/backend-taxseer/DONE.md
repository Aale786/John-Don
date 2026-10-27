# TaxSeer Backend + Frontend Integration — DONE

## What was built

### Backend (Spring Boot 4.1.1 · WebFlux · R2DBC · PostgreSQL)

A fully reactive REST API was scaffolded from scratch under `com.taxseer.*`.  
Each domain follows the pattern: `Entity → Repository (R2dbcRepository) → Service → Controller`.  
CORS is open to `http://localhost:4200` via a `CorsWebFilter` bean in `CorsConfig`.  
The DB schema is initialised at startup from `src/main/resources/schema.sql`.

| Domain | Package | Table(s) |
|--------|---------|----------|
| Filer | `com.taxseer.filer` | `filers` |
| Recipient | `com.taxseer.recipient` | `recipients` |
| Filing | `com.taxseer.filing` | `filings` |
| Cart | `com.taxseer.cart` | `cart_items` |
| Order | `com.taxseer.order` | `taxseer_orders` |
| Wallet | `com.taxseer.wallet` | `wallets` |
| W9 Request | `com.taxseer.w9` | `w9_requests` |
| Download | `com.taxseer.download` | `downloads` |
| User | `com.taxseer.user` | `app_users` |
| Role | `com.taxseer.role` | `app_roles` |

### Frontend (Angular 19 · Standalone components · Angular Material · Tailwind)

Ten Angular services were created under `src/app/core/api/`, one per domain.  
Each service replaces the corresponding dummy-data file — no CSS, SCSS, or HTML was touched.  
Pages updated to consume live API data: Dashboard, Filer Details, Recipients, Orders, Settings, Filing, Add-to-Cart.

---

## REST Endpoints

### Filers — `GET /api/filers`
| Method | Path | Query params | Notes |
|--------|------|--------------|-------|
| GET | `/api/filers` | `q` (search) | returns Flux\<Filer\> |
| GET | `/api/filers/{id}` | — | |
| POST | `/api/filers` | — | body: Filer JSON |
| PUT | `/api/filers/{id}` | — | body: Filer JSON |
| DELETE | `/api/filers/{id}` | — | |

### Recipients — `GET /api/recipients`
| Method | Path | Query params | Notes |
|--------|------|--------------|-------|
| GET | `/api/recipients` | `filerId`, `q` | all or filtered |
| GET | `/api/recipients/{id}` | — | |
| POST | `/api/recipients` | — | |
| PUT | `/api/recipients/{id}` | — | |
| DELETE | `/api/recipients/{id}` | — | |

### Filings — `GET /api/filings`
| Method | Path | Query params | Notes |
|--------|------|--------------|-------|
| GET | `/api/filings` | `filerId`, `taxYear`, `status` | |
| GET | `/api/filings/{id}` | — | |
| POST | `/api/filings` | — | |
| PUT | `/api/filings/{id}` | — | |
| DELETE | `/api/filings/{id}` | — | |
| PATCH | `/api/filings/{id}/status` | — | body: `{ "status": "..." }` |

### Cart — `GET /api/cart`
| Method | Path | Query params | Notes |
|--------|------|--------------|-------|
| GET | `/api/cart` | `userId` | |
| POST | `/api/cart` | — | body: `{ "filingId": n, "userId": n }` |
| DELETE | `/api/cart/{id}` | — | |
| POST | `/api/cart/checkout` | — | body: `{ "userId": n }` → creates Order |

### Orders — `GET /api/orders`
| Method | Path | Query params | Notes |
|--------|------|--------------|-------|
| GET | `/api/orders` | `status`, `q`, `filerId` | |
| GET | `/api/orders/{id}` | — | |
| POST | `/api/orders` | — | |

### Wallet — `GET /api/wallet`
| Method | Path | Query params | Notes |
|--------|------|--------------|-------|
| GET | `/api/wallet` | `userId` | |
| POST | `/api/wallet/add-funds` | — | body: `{ "userId": n, "amount": "..." }` |

### W9 Requests — `GET /api/w9`
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/w9?filerId=` | list by filer |
| POST | `/api/w9/send` | body: `{ "recipientId": n, "filerId": n }` |
| POST | `/api/w9/{id}/remind` | send reminder |
| POST | `/api/w9/{id}/received` | mark received |

### Downloads — `GET /api/downloads`
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/downloads?filerId=` | list by filer |
| POST | `/api/downloads` | create record |

### Users — `GET /api/users`
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/users` | all users |
| GET | `/api/users/{id}` | |
| POST | `/api/users` | |
| PUT | `/api/users/{id}` | |
| DELETE | `/api/users/{id}` | |
| POST | `/api/users/{id}/resend-invite` | re-sends invite |

### Roles — `GET /api/roles`
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/roles` | |
| PUT | `/api/roles/{id}` | |

---

## How to run

### Backend

Requirements: Java 21, Maven Wrapper (`mvnw.cmd`) included in the repo.

```bash
cd D:\Rasool\Project\TAXSEER\Taxseer-Backend
.\mvnw.cmd spring-boot:run
```

The server starts on **http://localhost:8080**.  
The DB schema is applied automatically on startup (AWS RDS PostgreSQL, credentials already in `application.properties` — do not edit).

### Frontend (development)

```bash
cd D:\Rasool\TaxSeerPractice\tax-filing-frontend-fuse-
npm install        # first time only
npm run start      # dev server at http://localhost:4200
```

The Angular services point to `http://localhost:8080/api` — start the backend first.

### Frontend (production build)

```bash
npm run build
# output: dist/fuse/
```

---

## Build verification (final run)

| Target | Command | Result |
|--------|---------|--------|
| Backend compile | `.\mvnw.cmd compile` | ✅ BUILD SUCCESS |
| Frontend build | `npm run build` | ✅ Application bundle generation complete |
