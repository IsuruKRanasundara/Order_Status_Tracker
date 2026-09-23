# Repository guidance

- This project is a scaffold. Do not describe placeholder functionality as implemented.
- Keep frontend UI in `frontend/src/components`, requests in `frontend/src/api`, and types in `frontend/src/types`.
- Keep backend HTTP handling in controllers/routes, business logic in services, persistence in repositories, and transition rules in domain modules.
- Define the backend contract before assuming frontend endpoints or status values.
- Follow existing TypeScript and React conventions and preserve unrelated user changes.
- Keep secrets out of source control and document required configuration with example environment files.
- Update README.md when setup or implemented behavior changes.
- Validate frontend changes with `npm run lint` and `npm run build` from `frontend` when dependencies are available.
- Add meaningful backend tests when business rules are implemented; the existing backend test script is a placeholder.
- Report any checks that could not run and why.
