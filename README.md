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
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=garden_tracker
APP_PASSWORD=        # e.g. gardens2024
```

