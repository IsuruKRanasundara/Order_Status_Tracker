# Repository guidance

- The backend is implemented with in-memory storage. The frontend remains a scaffold; Prisma is a draft. Do not describe placeholder functionality as implemented.
- Keep frontend UI in `frontend/src/components`, requests in `frontend/src/api`, and types in `frontend/src/types`.
- Keep backend HTTP handling in controllers/routes, business logic in services, persistence in repositories, and transition rules in domain modules.
- Define the backend contract before assuming frontend endpoints or status values.
- Follow existing TypeScript and React conventions and preserve unrelated user changes.
- Keep secrets out of source control and document required configuration with example environment files.
- Update README.md when setup or implemented behavior changes.
- Validate frontend changes with `npm run lint` and `npm run build` from `frontend` when dependencies are available.
- Validate backend changes with `npm test`, `npm run typecheck`, and `npm run build` from `backend`. Include meaningful tests for changes to event ordering, idempotency, and transition rules.
- Report any checks that could not run and why.
