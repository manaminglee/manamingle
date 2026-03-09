# Realm – Video pods for your vibe

**Realm** is an interest-based group video chat app. Unlike Omegle or random chat clones, you enter a **realm** (interest), pick your **vibe**, and join a **pod** of up to 4 people who share that interest. Everyone sees everyone's video.

## What makes it different

- **Realm + vibe** – Pick an interest (e.g. Gaming, Music) and your mood (Chill, Hype, Deep talks, etc.)
- **Pods, not strangers** – Max 4 per pod; everyone shares the same interest
- **Icebreakers** – Conversation starters shown in the room
- **In-pod chat** – Text chat alongside video
- **Find new pod** – Switch to another group with the same interest
- **Visual identity** – Syne + DM Sans, teal/amber, subtle grain and gradients

## Quick start

1. **Install**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. **Development**
   - Terminal 1: `npm run dev` (backend on :3000)
   - Terminal 2: `npm run dev:client` (React on :5173) → open http://localhost:5173

3. **Production**
   ```bash
   npm run build
   npm start
   ```
   Open http://localhost:3000

## Stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node, Express, Socket.IO
- **Video:** WebRTC mesh (each peer connects to the others)
- **Security:** Helmet, CORS, rate limiting, sanitization

## Env

See `.env.example`:
- `PORT` – server port (default 3000)
- `NODE_ENV` – development / production
- `FRONTEND_ORIGIN` – CORS origin(s)
- `TURN_USERNAME` / `TURN_PASSWORD` – optional TURN for strict NATs

## License

MIT
