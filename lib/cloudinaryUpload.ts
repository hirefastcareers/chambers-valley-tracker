/**
 * Unsigned browser upload to Cloudinary (requires an unsigned upload preset in Cloudinary).
 * NEXT_PUBLIC_* env vars are inlined into the client bundle by Next.js.
 */
export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

export async function uploadImageToCloudinaryUnsigned(
  file: File,
  options?: { tags?: string[] }
): Promise<CloudinaryUploadResult> {
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
  body.append("folder", "chambers-valley");
  if (Array.isArray(options?.tags) && options.tags.length > 0) {
    body.append("tags", options.tags.join(","));
  }

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });

  const data = (await res.json().catch(() => null)) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    const msg =
      typeof data?.error?.message === "string"
        ? data.error.message
        : `Cloudinary upload failed (${res.status})`;
    throw new Error(msg);
  }

  const secureUrl = data?.secure_url;
  if (!secureUrl || typeof secureUrl !== "string") {
    throw new Error("Cloudinary did not return a secure URL.");
  }
  const publicId = data?.public_id;
  if (!publicId || typeof publicId !== "string") {
    throw new Error("Cloudinary did not return a public ID.");
  }

  return { secureUrl, publicId };
}
