# Chambers Valley Garden Care — Job Tracker

Mobile-first PWA for tracking garden jobs, follow-ups, recurring reminders, customer history/photos, and earnings.

## Setup Instructions

1. Clone repo, run `npm install`
2. Copy `.env.example` to `.env.local` and fill in values
3. Visit `/api/setup` once to create all database tables
4. Run `npm run dev` to test locally
5. Deploy to Vercel — add env vars in Vercel dashboard

## Environment Variables

```bash
DATABASE_URL=        # Neon connection string

# Cloudinary — browser uploads use unsigned presets. In the Cloudinary dashboard,
# create an **unsigned** upload preset (e.g. `garden_tracker`) and allow it for image uploads.
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=

APP_PASSWORD=        # e.g. gardens2024
```

Set the same `NEXT_PUBLIC_*` variables in the Vercel project settings so production builds include them in the client bundle.

