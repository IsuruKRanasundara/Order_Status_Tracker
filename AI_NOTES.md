# AI assistance notes

Added the requested frontend API, components, and types structure, plus root documentation and ignore rules. Replaced the Vite demo with a simple order tracker starter screen. Preserved the existing backend scaffold and package configuration.

The frontend API and type modules remain placeholders, and the status filter remains disabled until frontend integration is implemented.

## Backend implementation

OpenAI Codex implemented the in-memory repository, event service, request validation, Express routes/controllers, error handling, server setup, service and HTTP tests, and documentation. Existing user-written status definitions, transition validation, and the draft Prisma schema were present before this work. The validator was retained with an import adjustment for the backend's ESM configuration; Prisma remains unused.

The assistant used the assignment PDF as requirements context and consulted the official Express error-handling and Zod validation documentation. The backend uses the existing dependencies and Node's test runner.

An actual AI mistake during the earlier scaffold work was using delete-and-add operations for the same path in one patch. The patch tool rejected that operation; the assistant caught the error from the tool output and changed the editing approach. During backend validation, the tsx runner initially failed while looking up the Windows sandbox user, before executing tests. The assistant retried with the required execution permission rather than reporting the failed attempt as a passing test run.

Before submission, the candidate should record which parts they personally wrote or substantially rewrote and the actual time spent. This note does not claim that the generated backend was independently authored by the candidate.
