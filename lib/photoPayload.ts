import { isTrustedCloudinarySecureUrl } from "@/lib/cloudinaryUrl";

export type PhotoPayloadItem = {
  url: string;
  type: "before" | "after";
  tags: string[];
  cloudinaryPublicId: string | null;
};

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
    const tagsRaw = (entry as { tags?: unknown }).tags;
    const cloudinaryPublicId = (entry as { cloudinaryPublicId?: unknown }).cloudinaryPublicId;
    if (typeof url !== "string" || !url.trim()) {
      return { ok: false, error: "Invalid photo payload (missing url)." };
    }
    if (type !== "before" && type !== "after") {
      return { ok: false, error: "Invalid photo payload (bad type)." };
    }
    if (!isTrustedCloudinarySecureUrl(url, cloudName)) {
      return { ok: false, error: "Invalid photo URL (not from this Cloudinary account)." };
    }
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
      : [];
    if (tags.length > 0 && tags.some((tag) => tag.length > 100)) {
      return { ok: false, error: "Invalid photo payload (tag too long)." };
    }
    if (cloudinaryPublicId !== undefined && (typeof cloudinaryPublicId !== "string" || !cloudinaryPublicId.trim())) {
      return { ok: false, error: "Invalid photo payload (bad cloudinaryPublicId)." };
    }
    items.push({ url: url.trim(), type, tags, cloudinaryPublicId: typeof cloudinaryPublicId === "string" ? cloudinaryPublicId.trim() : null });
  }

  return { ok: true, items };
}
