type DistanceMatrixResponse = {
  rows?: Array<{
    elements?: Array<{
      status?: string;
      distance?: { value?: number };
    }>;
  }>;
};

function cleanAddress(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function calculateDrivingMiles(
  originPostcode: string | null | undefined,
  destinationAddress: string | null | undefined
): Promise<number | null> {
  // Uses the same browser key as Places autocomplete; Distance Matrix API must be enabled in Google Cloud.
  const origin = cleanAddress(originPostcode);
  const destination = cleanAddress(destinationAddress);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();

  if (!origin || !destination || !apiKey) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("units", "imperial");
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as DistanceMatrixResponse;
    const meters = data.rows?.[0]?.elements?.[0]?.distance?.value;
    const status = data.rows?.[0]?.elements?.[0]?.status;
    if (status !== "OK" || typeof meters !== "number") return null;
    const miles = meters / 1609.344;
    return Math.round(miles * 10) / 10;
  } catch {
    return null;
  }
}

