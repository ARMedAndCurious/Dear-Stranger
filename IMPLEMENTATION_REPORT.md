# Implementation report

## Batch 3 update (supersedes prior details below)

Explore is available at `/explore` and uses `GET /api/notebooks/discover/list?search=&page=1`, filtering public notebooks before paginating. `POST /api/speech/transcribe?language=indic-auto` accepts only 16 kHz mono PCM WAV, at most 30 seconds, behind the existing CSRF protection and a rate limit. The browser records in memory; the server forwards it to Gnani Prisma v3 and does not intentionally persist it. Browser/OS, reverse proxies, and Gnani may process metadata; review [Gnani's terms and retention policy](https://docs.gnani.ai/api/STT/speech-to-text.md) before deploying. Set `GNANI_API_KEY` to enable it. The official documentation specifies up to 30 seconds and a multipart `audio_file` request; the app stops at 29 seconds.

Approved pages accept `?language=en` (or another supported code), preserve originals and cache translations only after a second safety review. Set `GOOGLE_TRANSLATE_API_KEY` for Google Cloud Translation Basic and the existing `OPENAI_API_KEY` / `OPENAI_MODERATION_MODEL` for the safety review. Without both services, translated text remains unavailable and original reading continues. Configure an API-restricted Google key, and review provider retention and billing. Speech and translation have only been tested with controlled doubles, not real credentials; their quality and language accuracy are unverified. The 3D page turn, recording UX and mobile layouts also need browser testing. Database integration tests remain blocked on this Windows ARM host; see final test results in the session.

## Batch 2 update (supersedes Batch 1 details below)

Notebook URLs are now generated server-side from the title plus a random suffix; existing URLs remain valid. `Advice` stores the original text, notebook reference, review status/reason and an idempotency key. A unique notebook/key index prevents repeat submissions; public pagination selects approved text and creation date only. The owner review API checks notebook ownership and advice membership in the same notebook. Removing a page changes its status to rejected; it does **not** erase the original text from storage.

`POST /api/notebooks/:slug/advice` accepts `{ text, submissionId }` with a CSRF token; `GET /api/notebooks/:slug/advice?page=1` returns one approved page and a total. Owner-only `GET /api/notebooks/manage/:id/advice` and `PATCH /api/notebooks/manage/:id/advice/:adviceId` (action `approve`, `reject` or `remove`) manage submissions. The dashboard receives approved and awaiting-review counts. Submission rate limiting is per IP and process; no contributor IP is stored in the advice document. Browser sessions and infrastructure may still process network information, so anonymity is not absolute.

Deterministic checks flag possible links, personal data and repeated content. Optionally set `OPENAI_API_KEY` and `OPENAI_MODERATION_MODEL` to an OpenAI chat-completions model supporting JSON object responses. Advice not flagged by deterministic checks is sent to OpenAI when configured; read the provider's privacy and retention terms before enabling it. Invalid responses, timeouts, missing configuration and uncertain decisions result in owner review, never automatic approval. The service validates structured output but AI moderation can make mistakes and can be manipulated; it is not a guarantee of safety, particularly across languages. Owners should review content before approving. Processing is synchronous, with a 10-second provider timeout; server crashes can leave entries pending for manual review.

Batch 2 verification: `npm run build` and `npm run lint` passed; `npm test` had 8 passing standalone tests and 9 skipped database tests, failing overall because MongoDB's Windows ARM download returned 403. No end-to-end, responsive browser, real provider or database verification was possible. Tests configured via `TEST_MONGODB_URI` create a randomly named isolated test database and leave it behind; use only a disposable MongoDB deployment with permissions to create databases. No Batch 3 features were added.

## Structure

- `client/src/main.jsx`: routes, authentication state, forms and pages; `api.js`: credentialed requests and CSRF token; `style.css`: responsive visual styling. Vite proxies `/api` in development.
- `server/src/index.js`: configuration, database connection, indexes, session store and startup. `app.js`: Express middleware and application wiring.
- `server/src/routes/`, `controllers/`, `models/`, `validation/`, and `middleware/`: API routing, request handling, Mongoose schemas, Zod schemas and shared security/error handling respectively.
- `server/test/`: Vitest validation and Supertest API tests.

## Request flow and sessions

The browser first calls `GET /api/auth/me`. Express creates a server-side session and returns its CSRF token, plus the current user or null. The browser keeps the token in memory and includes it in `X-CSRF-Token` for all POST/PATCH requests. The session ID is in a signed, HttpOnly, SameSite=Lax cookie, Secure in production; session data lives in MongoDB, not the cookie. Sessions expire after seven days. Login and registration regenerate the session ID and CSRF token to mitigate session fixation. Logout destroys the session and clears the cookie. Passwords are bcrypt-hashed with cost 12; they and their hashes are never returned. Session persistence depends on the MongoDB session store.

In development, Vite forwards `/api` to Express. For production, serve `client/dist` with SPA fallback to `index.html` and reverse-proxy `/api` to Express on the **same HTTPS origin**. The API is not a static file server. Configure the reverse proxy to be the one trusted proxy, remove client-supplied forwarding headers, and forward HTTPS protocol correctly. `CLIENT_ORIGIN` must match the actual frontend HTTPS origin exactly. Cross-site hosting is not supported by the Lax-cookie setup.

## Data and API

`User` has a unique normalized email and a non-selected password hash. `Notebook` has an indexed owner reference, title, description, globally unique indexed slug, visibility, and timestamps. Startup waits for index creation. A unique database index is the final authority on duplicate slugs, even for simultaneous requests; conflicts return 409. Slugs are immutable, lowercase, 3–80 characters with hyphens between words; `mine` is reserved for the owner list route.

| Endpoint | Behavior |
| --- | --- |
| POST `/api/auth/register` | Validate, hash password, create user, establish session. |
| POST `/api/auth/login` | Validate credentials, rotate and establish session. |
| POST `/api/auth/logout` | Destroy session. |
| GET `/api/auth/me` | Return current user or null and a CSRF token. |
| POST `/api/notebooks` | Authenticated creation, 201 or 409 on slug conflict. |
| GET `/api/notebooks/mine` | List only session owner's notebooks. |
| GET `/api/notebooks/:slug` | Public view for either visibility; no owner or account data. |
| PATCH `/api/notebooks/:id` | Owner-only title/description update; returns 404 for missing or another owner's notebook. |

Authorization is enforced in the update database query using both `_id` and session `userId`. Strict Zod validation rejects unexpected fields. Errors return safe JSON messages; malformed JSON and oversized bodies are handled centrally. Authentication attempts are rate limited per IP, in process. Public and unlisted notebooks are both accessible to anyone with a link; no public discovery is implemented, so neither appears in a directory. Visibility is stored for future discovery, which must exclude unlisted notebooks.

## Environment

Copy `.env.example` to `.env`. Set `MONGODB_URI` to a reachable MongoDB deployment; `SESSION_SECRET` to a long random value of at least 32 characters; `CLIENT_ORIGIN` to the exact frontend origin; `PORT` to the API port; and `NODE_ENV=production` for HTTPS deployments. Never commit secrets. MongoDB needs durable storage, restricted network access, and backups.

## Verification performed

- `npm run build`: passed after dependency updates.
- `npm run lint`: passed (frontend ESLint).
- `npm audit --omit=dev`: 0 vulnerabilities at execution time; a full install audit also reported development-dependency advisories.
- `npm test`: **failed overall**. Two standalone validation tests passed; seven API tests were skipped because `mongodb-memory-server` attempted to download an unavailable Windows ARM MongoDB binary (HTTP 403). The API suite has not been verified. To run it with an existing MongoDB, set `TEST_MONGODB_URI` to a **dedicated disposable test database**; tests delete its users and notebooks. Never point it at real data.
- Responsive browser automation and end-to-end deployment were not performed.

## Known limitations and risks

Production deployment and real MongoDB session persistence remain unverified. The default rate limiter is per-process and resets on restart; multi-instance deployments require a shared limiter. No account recovery, email verification, password change, account deletion or session revocation UI exists. An unlisted URL is a bearer link, not a secret or access control. CSRF does not protect against same-origin XSS; keep dependencies patched and do not render untrusted HTML. Rate limiting is basic and does not eliminate credential stuffing. Cookie security requires HTTPS, the specified reverse-proxy setup, and a strong secret. Clipboard access requires a secure context or localhost. No discovery, advice, speech, translation or moderation is implemented.
