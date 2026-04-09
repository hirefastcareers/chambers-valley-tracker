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

  console.log("[distance] home postcode:", origin ?? null);
  console.log("[distance] customer address:", destination ?? null);

  if (!origin || !destination || !apiKey) {
    console.log("[distance] skipping call: missing origin, destination, or GOOGLE_MAPS_API_KEY");
    return null;
  }

  // `units=imperial` affects human-readable distance.text only; rows[].elements[].distance.value is always metres.
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("units", "imperial");
  url.searchParams.set("mode", "driving");
  url.searchParams.set("key", apiKey);
  const urlForLog = new URL(url.toString());
  urlForLog.searchParams.set("key", "REDACTED");
  console.log("[distance] Distance Matrix URL:", urlForLog.toString());

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.log("[distance] Distance Matrix non-OK response:", {
        status: res.status,
        statusText: res.statusText,
        body: errorText,
      });
      return null;
    }
    const data = (await res.json()) as DistanceMatrixResponse;
    console.log("[distance] Distance Matrix full response:", data);
    const topStatus = data.status;
    if (topStatus && topStatus !== "OK") {
      console.log("[distance] Distance Matrix API rejected request:", {
        status: topStatus,
        error_message: data.error_message ?? null,
      });
      return null;
    }
    const rawMetres = data.rows?.[0]?.elements?.[0]?.distance?.value;
    const status = data.rows?.[0]?.elements?.[0]?.status;
    if (status !== "OK" || typeof rawMetres !== "number") {
      console.log("[distance] Distance Matrix element not OK:", {
        elementStatus: status ?? null,
        rawMetres: typeof rawMetres === "number" ? rawMetres : null,
      });
      return null;
    }
    const miles = rawMetres / METRES_PER_MILE;
    const milesRounded = Math.round(miles * 10) / 10;
    console.log("[distance] raw metres:", rawMetres, "converted miles:", milesRounded);
    return milesRounded;
  } catch (error) {
    console.log("[distance] Distance Matrix error:", error);
    return null;
  }
}

