/**
 * Interactive job map (Google Maps).
 *
 * Requires Geocoding API enabled in Google Cloud Console
 * APIs & Services → Library → Geocoding API → Enable
 * Uses the same NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
 *
 * After deploying:
 * - Enable Geocoding API in Google Cloud Console
 * - Visit /api/migrate to add lat/lng columns
 * - Visit /api/geocode-customers to geocode all existing customers
 */

import JobMapPage from "@/components/JobMapPage";

export default function MapRoutePage() {
  return <JobMapPage />;
}
