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
- Local browser storage
- JSON export and import for backups or moving data between machines

## Fast GitHub Pages deployment

1. Create a new GitHub repository.
2. Push these files to the repository.
3. In GitHub, open `Settings > Pages`.
4. Set source to `Deploy from a branch`.
5. Choose the `main` branch and `/root`.
6. Save. GitHub will give you a public web URL.

This first version stores data in each browser's local storage. For group live collaboration, the next step is adding a small hosted database such as Supabase or Firebase.

## Shared data roadmap

Supabase is the recommended next step for sharing the same trip plan across all four riders.

Project URL:

```text
https://oipqywiuptslfvhnjovn.supabase.co
```

Create a `.env` file from `.env.example` when the app moves to a build step or hosted environment:

```bash
cp .env.example .env
```

Never commit `.env`. The current static MVP does not read these values yet; this file is here so the Supabase migration has a clean place to start.

For a static GitHub Pages deployment, copy `config.example.js` to `config.js`, add the Supabase anon/public key, and do not commit `config.js` until you are intentionally ready for the deployed frontend to use that public key.

Run `supabase/schema.sql` in the Supabase SQL editor to create the first shared-data tables.

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
