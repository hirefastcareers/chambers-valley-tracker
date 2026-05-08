/**
 * Requires Geocoding API enabled in Google Cloud Console
 * APIs & Services → Library → Geocoding API → Enable
 * Uses the same NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
 *
 * After deploying:
 * - Enable Geocoding API in Google Cloud Console
 * - Visit /api/migrate to add lat/lng columns
 * - Visit /api/geocode-customers to geocode all existing customers
 */

type GeocodeResponse = {
  status: string;
  results?: Array<{
    geometry?: { location?: { lat: number; lng: number } };
  }>;
};

/**
 * Calls Google Geocoding HTTP API and returns WGS84 coordinates or null.
 */
export async function geocodeAddressWithKey(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as GeocodeResponse;
  if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) return null;

  const { lat, lng } = data.results[0].geometry.location;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}
