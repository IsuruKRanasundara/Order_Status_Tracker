# AI assistance notes

Added the requested frontend API, components, and types structure, plus root documentation and ignore rules. Replaced the Vite demo with a simple order tracker starter screen. Preserved the existing backend scaffold and package configuration.

The frontend scaffold was subsequently replaced by the React dashboard described below.

## Backend implementation

OpenAI Codex implemented the in-memory repository, event service, request validation, Express routes/controllers, error handling, server setup, service and HTTP tests, and documentation. Existing user-written status definitions, transition validation, and the draft Prisma schema were present before this work. The validator was retained with an import adjustment for the backend's ESM configuration; Prisma remains unused.

The assistant used the assignment PDF as requirements context and consulted the official Express error-handling and Zod validation documentation. The backend uses the existing dependencies and Node's test runner.

An actual AI mistake during the earlier scaffold work was using delete-and-add operations for the same path in one patch. The patch tool rejected that operation; the assistant caught the error from the tool output and changed the editing approach. During backend validation, the tsx runner initially failed while looking up the Windows sandbox user, before executing tests. The assistant retried with the required execution permission rather than reporting the failed attempt as a passing test run.

Before submission, the candidate should record which parts they personally wrote or substantially rewrote and the actual time spent. This note does not claim that the generated backend was independently authored by the candidate.

## React dashboard

Codex implemented the responsive dashboard styling, order summary cards, search/filter controls, typed API functions, selected-order timeline, loading/empty/error states, and retry/refresh controls. The UI uses real backend data without seeded display records. Requests use abort cleanup to prevent outdated results from replacing a newer selection. React's official effect documentation was consulted for request lifecycle handling.

During validation, ESLint caught an API error wrapper that discarded the original network error. Codex attached the original error as `cause` before rerunning checks. The initial large shell write also exceeded the Windows command-length limit; it made no changes, and the writes were split into smaller commands.

## Create order portal

At the user's request, Codex added a native dialog form, editable/generated order IDs, a `POST /orders` endpoint, server-side creation timestamps, idempotent retries, duplicate-order protection, and service/HTTP tests. This extends the original assignment's webhook-only creation flow. The existing status rules still apply. No customer or product fields were invented because they are not part of the order model.

## Event operations and API checklist

Codex used the user's pasted 24-request checklist to add status-action controls, an editable event form with exact payload retries and raw JSON support, and a sequential in-app API check runner with response assertions. Existing backend rules were reused. Integration tests run actual frontend request/check code against an isolated backend, including repeated runs and stopping before subsequent requests.

Validation caught a missing closing brace in the initial API-function edit. The initial transpilation-based integration harness tolerated that syntax error, while lint and the build correctly rejected it. Codex fixed the brace and made the harness fail on transpiler error diagnostics. Review also identified that using the current time for a missing predecessor could place it after an older pending successor; timestamp preparation was corrected and covered by an integration test.
