import { isTrustedCloudinarySecureUrl } from "@/lib/cloudinaryUrl";

export type PhotoPayloadItem = { url: string; type: "before" | "after" };

export function parseAndValidatePhotoPayload(
  rawJson: string,
  cloudName: string
): { ok: true; items: PhotoPayloadItem[] } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: "Invalid photo payload (not JSON)." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Invalid photo payload (expected an array)." };
  }

  const items: PhotoPayloadItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Invalid photo payload (bad entry)." };
    }
    const url = (entry as { url?: unknown }).url;
    const type = (entry as { type?: unknown }).type;
    if (typeof url !== "string" || !url.trim()) {
      return { ok: false, error: "Invalid photo payload (missing url)." };
    }
    if (type !== "before" && type !== "after") {
      return { ok: false, error: "Invalid photo payload (bad type)." };
    }
    if (!isTrustedCloudinarySecureUrl(url, cloudName)) {
      return { ok: false, error: "Invalid photo URL (not from this Cloudinary account)." };
    }
    items.push({ url: url.trim(), type });
  }

  return { ok: true, items };
}
