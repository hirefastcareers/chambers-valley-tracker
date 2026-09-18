/**
 * Validates that a URL is a Cloudinary HTTPS delivery URL for this cloud.
 * Used server-side to avoid accepting arbitrary URLs when persisting photo rows.
 */
export function isTrustedCloudinarySecureUrl(url: string, cloudName: string): boolean {
  const name = cloudName.trim();
  if (!name) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "res.cloudinary.com") return false;
    const segments = u.pathname.split("/").filter(Boolean);
    // /{cloud}/image/upload/...
    if (segments[0] !== name) return false;
    if (segments[1] !== "image" || segments[2] !== "upload") return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Insert a Cloudinary transformation after `/image/upload/` for smaller gallery thumbs.
 * Leaves non-Cloudinary URLs and already-transformed URLs unchanged.
 */
export function cloudinaryTransformedUrl(
  url: string,
  transform = "f_auto,q_auto,c_fill,w_480,h_480"
): string {
  if (!url || typeof url !== "string") return url;
  const marker = "/image/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const after = url.slice(idx + marker.length);
  const firstSeg = after.split("/")[0] ?? "";
  // Already has transforms (comma-separated) or leading transform tokens
  if (firstSeg.includes(",") || /^(f_|q_|w_|h_|c_|g_)/.test(firstSeg)) {
    return url;
  }
  return `${url.slice(0, idx + marker.length)}${transform}/${after}`;
}
