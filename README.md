# RidePlan

A local-first motorcycle trip planning web app for route planning, stops, fuel, costs, checklists, and shared notes.

## Run locally

```bash
npm run dev
```

Then open:

```text
http://localhost:5173
```

## What is included

- Trip dashboard with mileage, ride time, estimated cost, and actual spend
- Daily route planner
- Stops database for hotels, restaurants, fuel, attractions, repair, emergency, and other stops
- Bike fuel range planning and actual fuel logs
- Budget tracker with per-person actual cost estimate
- Packing, bike, and document checklists
- Shared planning notes
- Supabase shared storage with local browser backup
- JSON export and import for backups or moving data between machines

## Fast GitHub Pages deployment

1. Create a new GitHub repository.
2. Push these files to the repository.
3. In GitHub, open `Settings > Pages`.
4. Set source to `Deploy from a branch`.
5. Choose the `main` branch and `/root`.
6. Save. GitHub will give you a public web URL.

This version stores a local browser backup and syncs the shared trip plan through Supabase when the schema is installed.

## Shared data roadmap

Supabase is the recommended next step for sharing the same trip plan across all four riders.

Project URL:

```text
https://oipqywiuptslfvhnjovn.supabase.co
```

Create a `.env` file from `.env.example` if the app later moves to a build step or hosted environment:

```bash
cp .env.example .env
```

Never commit `.env`. The current static app reads `config.js` directly so it can run on GitHub Pages without a build step.

For the current static GitHub Pages deployment, `config.js` contains the Supabase URL and publishable key. That key is intended for browser use; protect data access with Supabase row level security policies.

Run `supabase/schema.sql` in the Supabase SQL editor before expecting shared sync to work. Until then, the app will continue saving locally.

The app currently syncs the working trip plan through `trip_documents`, a single JSON document table. The normalized tables below are included for the next data-model pass after the trip planning workflow stabilizes.

Suggested first tables:

- `trips`
- `route_days`
- `stops`
- `bikes`
- `fuel_logs`
- `expenses`
- `checklist_items`
- `notes`

The frontend can stay static and GitHub Pages-friendly while reading and writing trip data through Supabase.
