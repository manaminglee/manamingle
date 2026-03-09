# Environment variables and secrets

All **keys and sensitive passwords** must live in environment variables loaded from `.env` (or a path you set via `DOTENV_CONFIG_PATH`). Never commit `.env` or any file that contains real secrets.

## Server (root `.env`)

1. Copy the template:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set at least:
   - **`ADMIN_KEY`** – Strong random string (min 16 chars) for admin panel auth.  
     Example: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - **`FRONTEND_ORIGIN`** – In production, your front-end origin(s), comma-separated (e.g. `https://yoursite.com`).
3. Optional:
   - **`PORT`** – Default `3000`.
   - **`NODE_ENV`** – `development` or `production`.
   - **`TURN_USERNAME`** / **`TURN_PASSWORD`** – Only if you use a TURN server for WebRTC.

See **`.env.example`** in the project root for the full list and comments.

## Client (`client/`)

- Use **`client/.env.example`** as a template for optional **`client/.env.local`** (e.g. `VITE_SOCKET_URL` if the API is on another domain).
- **Do not put secrets in any `VITE_*` variable** – Vite embeds them in the build, so they would be visible to users.

## Security checklist

- `.env` and `.env.local` are in `.gitignore`; never add them to version control.
- Only `.env.example` and `client/.env.example` (no real values) should be committed.
- In production, set `ADMIN_KEY` to a strong value so the `/admin` dashboard is protected.
- The server never logs `ADMIN_KEY`, `TURN_PASSWORD`, or any other secret env value.
