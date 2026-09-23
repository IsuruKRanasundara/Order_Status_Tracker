# Order Status Tracker

A React + TypeScript order dashboard and an Express + TypeScript backend.

## Structure

```text
backend/
  src/
    controllers/order.controller.ts
    routes/order.routes.ts
    services/order.service.ts
    repositories/order.repository.ts
    domain/order-status.ts
    domain/transition-validator.ts
    middleware/error-handler.ts
    app.ts
    server.ts
  prisma/schema.prisma
  tests/order.service.test.ts
  package.json
  tsconfig.json
frontend/
  src/
    api/orders.api.ts
    components/OrderList.tsx
    components/OrderDetails.tsx
    components/StatusFilter.tsx
    types/order.ts
    App.tsx
    main.tsx
  package.json
README.md
AI_NOTES.md
AGENTS.md
.gitignore
```

The frontend also retains its Vite, TypeScript, ESLint, HTML, and CSS configuration files.

## Run the frontend

With Node.js and npm installed and compatible with the package's Vite version:

```sh
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite. Run `npm run lint` and `npm run build` in `frontend` to validate changes. After building, use `npm run preview` to preview the production build.

## Current state

The frontend displays a responsive dashboard with order totals, search by order ID, status filtering, and a selectable event timeline. Loading, empty, and error states include retry actions. Pending and rejected events are visible in history. Refresh reloads the list and selected order; data is not automatically polled.

The frontend connects to `http://localhost:3000` by default. To use another API address, copy `frontend/.env.example` to `frontend/.env.local`, edit `VITE_API_URL`, and restart Vite. Keep the backend's `FRONTEND_ORIGIN` aligned with the frontend URL (default `http://localhost:5173`). Google Fonts are optional; system fonts are used when unavailable.

Start the backend and frontend in separate terminals. Run the supplied Postman collection to create orders, then select **Refresh orders** in the dashboard. Select an order ID or arrow to inspect its event history. Search and status filtering operate on the fetched list; the summary cards always describe all fetched orders. **Awaiting events** filters orders whose status is null, while **Pending events** counts pending events across every order.

The backend implements webhook ingestion, status validation, duplicate detection, out-of-order event reconciliation, filtered order listing, and full event history. Storage is in memory: restarting the server clears all orders and event IDs. The existing Prisma schema is a draft and is not used by the running application.

## Run and test the backend

Use Node.js 22 or newer. From the repository root:

```sh
cd backend
npm install
npm run dev
```

The API runs at `http://localhost:3000`. Set `PORT` to change the port and `FRONTEND_ORIGIN` to change the allowed browser origin (default `http://localhost:5173`). These are process environment variables; `.env` files are not loaded automatically. In Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm test
npm run typecheck
npm run build
npm start
```

`npm test` runs service and HTTP integration tests with Node's test runner. `typecheck` checks application and test files; `build` compiles the application. `start` runs the compiled server after building.

## API contract

| Method | Path | Response |
| --- | --- | --- |
| POST | `/webhooks/orders` | `{ duplicate, event, order }`; 200 when applied, 202 while pending |
| GET | `/orders` | Array of order summaries |
| GET | `/orders?status=paid` | Summaries filtered by current applied status |
| GET | `/orders/:id` | Order summary plus an `events` array |

Webhook body:

```json
{
  "eventId": "evt_123",
  "orderId": "ord_9",
  "status": "paid",
  "timestamp": "2026-09-20T10:15:00Z"
}
```

Send `Content-Type: application/json`. IDs must be nonempty strings (up to 200 characters; surrounding whitespace is trimmed). Timestamps require an explicit timezone and at most millisecond precision; timestamps are normalized to UTC. Invalid bodies or filters return 400, missing orders return 404, conflicting IDs or invalid transitions return 409, and bodies exceeding 16 KB return 413. Errors have shape `{ "error": { "code": "...", "message": "..." } }`.

Order summaries contain `id`, `status`, `updatedAt`, and `pendingEventCount`. `updatedAt` is the timestamp of the latest applied event. Status and updatedAt are `null` until a valid `created` event is received; this avoids inventing order state. Each history entry includes the original normalized event fields plus `receivedAt`, `outcome` (`applied`, `pending`, or `rejected`), and `reason`.

### Event processing decisions

- Allowed transitions: `created -> paid -> shipped -> delivered`, with cancellation allowed from `created` or `paid`. Delivered and cancelled are terminal states.
- Valid events may arrive in any order. Events are sorted by provider timestamp and replayed. A missing predecessor leaves the event and subsequent events pending; receiving the predecessor automatically reconciles them. For example, `shipped`, `created`, then `paid` ends at shipped when their timestamps describe that sequence.
- Equal timestamps use the status sequence as a deterministic tie breaker (`created`, `paid`, `shipped`, `delivered`, `cancelled`). Cancellation still follows branch validation, so shipping and cancellation cannot both be accepted.
- An identical event ID and normalized payload is idempotent, even after a pending event becomes applied. Reusing an ID with different content returns 409. A repeated status with a different event ID is an invalid transition.
- Regressions and terminal-state changes are rejected and logged. A new event that contradicts an already accepted timeline is rejected rather than rewriting accepted events. Thus, for contradictory histories, the first accepted events win; valid histories converge regardless of arrival order.
- Well-formed rejected events remain in history and are excluded from replay. Retrying a rejected event returns the same rejection without another history entry. Invalid request bodies and conflicting reuse of IDs do not enter order history.
- Processing is synchronous and atomic within one server process. A database implementation would require transactions and unique event IDs for concurrency across processes.

### Quick PowerShell example

With the backend running, send a created event followed by a paid event:

```powershell
$body = @{ eventId = 'evt_created'; orderId = 'ord_9'; status = 'created'; timestamp = '2026-09-20T10:00:00Z' } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/webhooks/orders -Method Post -ContentType 'application/json' -Body $body
$body = @{ eventId = 'evt_paid'; orderId = 'ord_9'; status = 'paid'; timestamp = '2026-09-20T10:15:00Z' } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/webhooks/orders -Method Post -ContentType 'application/json' -Body $body
Invoke-RestMethod http://localhost:3000/orders/ord_9
```

## Next steps

For larger datasets, move frontend search/filtering to paginated server queries and add automatic updates. Keep network requests in `api`, reusable UI in `components`, and model types in `types`.

Persistent storage, webhook authentication, pagination, and pending-event expiry/reconciliation jobs are not implemented. In-memory storage keeps the assignment small and is explicitly allowed in the brief. Pending events remain pending indefinitely if their predecessors never arrive. With more time, add persistence with transactions and a retention/reconciliation policy before deploying multiple server instances. Record your actual total time spent before submission.
