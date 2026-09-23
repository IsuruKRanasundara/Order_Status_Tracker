# Order Status Tracker

A React + TypeScript frontend and layered backend scaffold.

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

The frontend displays starter order list, details, and disabled status filter components. API and order type modules are placeholders until the backend contract is defined.

The backend files, Prisma schema, and service test file are existing placeholders. No API or database integration is implemented. The backend test script is also a placeholder and exits with an error.

## Next steps

Define the order model and allowed status transitions, implement backend persistence and endpoints, and connect the frontend API module. Keep network requests in `api`, reusable UI in `components`, and model types in `types`.
