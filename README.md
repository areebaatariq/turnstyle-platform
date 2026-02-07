# Turnstyle Platform

A digital wardrobe platform that consolidates styling workflows into one professional system. Built for independent stylists and their clients—manage closets, create looks, collaborate on requests, message in real time, and track receipts.

## What is Turnstyle?

Turnstyle helps stylists move from scattered tools (Stylebook, Google Drive, iMessage) to a single, client-collaborative platform:

- **Stylists:** Bulk import clients (CSV), manage client closets, create and edit looks (mobile & desktop), send invites, and message clients.
- **Clients:** Own their closet, approve or request changes on looks, and communicate with their stylist in-app.

### Features

- Bulk client import via CSV and invitation management  
- Bulk photo upload for closet items  
- Client-owned closets with stylist collaboration  
- Look creation and approval workflow (responsive)  
- Real-time messaging  
- Receipt tracking with photo upload  
- Google & Apple OAuth sign-in  

## Project structure

```
turnstyle-platform/
├── backend/          # Node.js + Express API (auth, closets, looks, messages, etc.)
├── frontend/         # React + Vite + TypeScript (Shadcn UI)
├── tests/            # Cypress E2E + Postman API tests
└── README.md
```

## Quick start

### Prerequisites

- Node.js 18+
- MongoDB (for backend data)
- (Optional) pnpm for frontend

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` (see [backend/README.md](backend/README.md) for required variables: `PORT`, `JWT_SECRET`, `MONGODB_URI`, OAuth credentials, etc.).

```bash
npm run dev
```

API runs at `http://localhost:3000` by default.

### 2. Frontend

```bash
cd frontend
npm install   # or pnpm install
```

Create a `.env` or `.env.local` with your API URL (e.g. `VITE_API_URL=http://localhost:3000`).

```bash
npm run dev
```

App runs at `http://localhost:5173` (or the port Vite shows).

### 3. Run tests

- **E2E (Cypress):** From repo root, `cd frontend && npm run test:e2e` (or `test:e2e:open` for UI).
- **API (Postman/Newman):** From `backend`, `npm run test:api`.

## Environment variables

Env files (`.env`, `.env.local`, etc.) are **not** committed. Copy from examples or see:

- [backend/README.md](backend/README.md) — server, JWT, MongoDB, Google/Apple OAuth, SendGrid, etc.
- Frontend: set `VITE_API_URL` (and any other `VITE_*` vars your app uses).

## Documentation

- [Backend API & setup](backend/README.md)  
- [Product requirements (PRD)](frontend/PRD.md)  
- [Tests](tests/README.md)  

## License

ISC
