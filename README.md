# Alexander's Birthday Candle Dash

A single-page React game built with Next.js to celebrate Alexander's birthday. Pop the candles, chase combos, and save high scores to Postgres with Sequelize.

## Quick Start

1) Install dependencies:

```bash
npm install
```

2) Create your local environment file:

```bash
cp .env.example .env.local
```

3) Update `DATABASE_URL` for your local Postgres (AlexDB):

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/AlexDB
DATABASE_SSL=false
```

4) Run the app:

```bash
npm run dev
```

Visit `http://localhost:3000`.

## High Scores API

- `GET /api/scores` returns the top 10 scores.
- `POST /api/scores` accepts `{ "name": "Alex", "candles": 29, "timeMs": 8200 }` and returns the updated list.
- Ranking is by `candles` (desc) then `timeMs` (asc).

## Vercel + Neon

Set these environment variables in Vercel:

- `DATABASE_URL` (your Neon connection string)
- `DATABASE_SSL=true` (or include `sslmode=require` in the URL)

Sequelize will auto-create the `scores` table on first use.
