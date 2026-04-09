# Chambers Valley Garden Care — Job Tracker

Mobile-first PWA for tracking garden jobs, follow-ups, recurring reminders, customer history/photos, and earnings.

## Setup Instructions

1. Clone repo, run `npm install`
2. Copy `.env.example` to `.env.local` and fill in values
3. Visit `/api/setup` once to create all database tables
4. After deploys that add DB columns, visit `/api/migrate`
5. Run `npm run dev` to test locally
6. Deploy to Vercel — add env vars in Vercel dashboard

## Environment Variables

```bash
DATABASE_URL=        # Neon connection string

# Cloudinary — browser uploads use unsigned presets. In the Cloudinary dashboard,
# create an **unsigned** upload preset (e.g. `garden_tracker`) and allow it for image uploads.
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=   # used client-side for Places autocomplete
GOOGLE_MAPS_API_KEY=                 # used server-side for Distance Matrix mileage calculations (same value as NEXT_PUBLIC_GOOGLE_PLACES_API_KEY)

APP_PASSWORD=        # e.g. gardens2024
```

Set the same `NEXT_PUBLIC_*` variables in the Vercel project settings so production builds include them in the client bundle.
Also set `GOOGLE_MAPS_API_KEY` in Vercel for server-side distance calculations.

Google Cloud must have both the **Places API** and **Distance Matrix API** enabled for the same key.
To enable Distance Matrix API: Google Cloud Console -> APIs & Services -> Library -> search for `Distance Matrix API` -> Enable.
Also ensure API key restrictions allow Distance Matrix API calls. If the key uses **API restrictions** (recommended), the allowed APIs list must include **Distance Matrix API** as well as **Places API** — a Places-only restriction causes `REQUEST_DENIED` from Distance Matrix.

