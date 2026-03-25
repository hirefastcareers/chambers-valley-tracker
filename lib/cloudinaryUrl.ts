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
