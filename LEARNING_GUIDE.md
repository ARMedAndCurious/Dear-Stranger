# Learning guide

## Registration and login

`AuthPage` in `client/src/main.jsx` collects the email and password. `client/src/api.js` sends JSON to Express with the browser's cookie and the CSRF token obtained from `/api/auth/me`. In `server/src/routes/auth.js`, rate limiting and Zod validation run before the controller. `server/src/controllers/auth.js` hashes a new password with bcrypt before storing the user. For login it selects the normally hidden hash and compares it with the supplied password. Neither the password nor hash is sent back. Both successful paths regenerate the session ID, record the user ID in the server session, and return a fresh CSRF token. The HttpOnly cookie lets the browser maintain the session without JavaScript reading the session ID.

`AuthProvider` loads `/api/auth/me` when the app starts, restoring the signed-in state after refresh. Logout destroys the server session and fetches a fresh anonymous CSRF token. The session store in `server/src/index.js` uses MongoDB so a server restart should not inherently sign everyone out; verify this in your deployment.

## React → Express → MongoDB

For notebook creation, `NotebookForm` collects the fields and sends a POST through `request()`. Vite forwards `/api` requests to Express during development. In production the reverse proxy must do this instead. `server/src/app.js` parses JSON, restores the session and checks the CSRF token. The notebook router then runs `requireAuth` and the Zod schema before `controllers/notebooks.js` calls `Notebook.create`. Mongoose validates and writes to MongoDB. The API responds with the saved fields; the dashboard reloads the owner's list. Failures are displayed, not replaced with fake data.

## Middleware and ownership

Middleware functions run in order and can stop a request by responding instead of calling `next()`. `requireAuth` rejects requests without a session user. Authentication alone is not enough: the edit controller uses `findOneAndUpdate({ _id, owner: req.session.userId }, ...)`, so a different account cannot update the document even if it knows its ID. The response deliberately uses the same 404 for missing and unauthorized notebooks.

The unique slug index in `models/Notebook.js` protects against concurrent requests. A check such as “does this slug exist?” followed by an insert would race: two requests could both see it as free. MongoDB's unique index makes one insert fail, and the error handler turns that into a 409 response.

## Security decisions

The HttpOnly cookie reduces token theft through JavaScript; `Secure` prevents cookie transmission over plain HTTP in production. SameSite and a session-bound CSRF token reduce cross-site request forgery, including login CSRF. Regeneration prevents session fixation. Bcrypt slows password guessing, and passwords are limited to 72 UTF-8 bytes to avoid bcrypt's truncation. Strict request schemas prevent clients from supplying fields such as owner. Public notebook responses omit owner information. React escapes rendered text by default. These measures do not eliminate XSS, leaked links, stolen devices, credential stuffing, or deployment misconfiguration. An unlisted link is not private against someone who obtains it.

## Running and debugging

1. Install a supported Node.js version and MongoDB, or create a MongoDB Atlas database. From the project root run `npm install`.
2. Copy `.env.example` to `.env`; configure `MONGODB_URI`, `SESSION_SECRET`, `CLIENT_ORIGIN`, `PORT` and `NODE_ENV`. Use a randomly generated secret, never the example text.
3. Start MongoDB, then run `npm run dev`. Visit `http://localhost:5173`. The API listens on port 4000 by default.
4. Use browser Network tools to inspect status codes and safe error messages; don't share cookies, passwords or secrets. Check that the database is reachable, the API is running, the frontend origin matches, and `/api/auth/me` succeeds before investigating CSRF failures. If using HTTPS production, confirm proxy and cookie settings in the implementation report.
5. Run `npm run build`, `npm run lint`, and `npm test`. The API tests require a compatible MongoDB binary or `TEST_MONGODB_URI` pointing at a dedicated disposable test database. **The suite deletes user and notebook records in that database.** On Windows PowerShell: `$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/dear-stranger-test'; npm test`.

Try registering, creating both kinds of notebook, copying and opening a link in a private browser window, editing as the owner, and attempting an edit from another account. See `IMPLEMENTATION_REPORT.md` for actual test results and deployment limitations.
