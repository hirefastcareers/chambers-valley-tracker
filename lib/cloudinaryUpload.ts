/**
 * Unsigned browser upload to Cloudinary (requires an unsigned upload preset in Cloudinary).
 * NEXT_PUBLIC_* env vars are inlined into the client bundle by Next.js.
 */
export async function uploadImageToCloudinaryUnsigned(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !preset) {
    throw new Error(
      "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", preset);
  body.append("folder", "garden-tracker");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });

  const data = (await res.json().catch(() => null)) as {
    secure_url?: string;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    const msg =
      typeof data?.error?.message === "string"
        ? data.error.message
        : `Cloudinary upload failed (${res.status})`;
    throw new Error(msg);
  }

  const url = data?.secure_url;
  if (!url || typeof url !== "string") {
    throw new Error("Cloudinary did not return a secure URL.");
  }

  return url;
}
