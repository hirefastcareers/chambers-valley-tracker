type DistanceMatrixResponse = {
  status?: string;
  error_message?: string;
  rows?: Array<{
    elements?: Array<{
      status?: string;
      distance?: { value?: number };
    }>;
  }>;
};

/** One statute mile in metres (used for Distance Matrix `distance.value`, which is always metres). */
const METRES_PER_MILE = 1609.344;

function cleanAddress(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function calculateDrivingMiles(
  originPostcode: string | null | undefined,
  destinationAddress: string | null | undefined
): Promise<number | null> {
  // Server-side key for Distance Matrix API (do not use NEXT_PUBLIC key here).
  const origin = cleanAddress(originPostcode);
  const destination = cleanAddress(destinationAddress);
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!origin || !destination || !apiKey) {
    return null;
  }

  // `units=imperial` affects human-readable distance.text only; rows[].elements[].distance.value is always metres.
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("units", "imperial");
  url.searchParams.set("mode", "driving");
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as DistanceMatrixResponse;
    const topStatus = data.status;
    if (topStatus && topStatus !== "OK") {
      return null;
    }
    const rawMetres = data.rows?.[0]?.elements?.[0]?.distance?.value;
    const status = data.rows?.[0]?.elements?.[0]?.status;
    if (status !== "OK" || typeof rawMetres !== "number") {
      return null;
    }
    const miles = rawMetres / METRES_PER_MILE;
    return Math.round(miles * 10) / 10;
  } catch {
    return null;
  }
}

