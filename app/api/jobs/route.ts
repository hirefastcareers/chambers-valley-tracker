import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { getCloudinary } from "@/lib/cloudinary";
import { requiredEnv } from "@/lib/env";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function isAllowedStatus(value: string): value is "quoted" | "booked" | "completed" | "needs_follow_up" {
  return ["quoted", "booked", "completed", "needs_follow_up"].includes(value);
}

export async function POST(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const formData = await req.formData();

  const customerId = Number(formData.get("customerId"));
  const jobType = String(formData.get("jobType") ?? "");
  const description = String(formData.get("description") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const quoteAmountRaw = String(formData.get("quoteAmount") ?? "");
  const paid = String(formData.get("paid") ?? "false") === "true";
  const dateDone = String(formData.get("dateDone") ?? "");

  if (!Number.isFinite(customerId) || !jobType || !dateDone || !isAllowedStatus(statusRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const quoteAmount =
    quoteAmountRaw.trim().length === 0 ? null : Number(quoteAmountRaw);

  if (quoteAmount !== null && !Number.isFinite(quoteAmount)) {
    return NextResponse.json({ ok: false, error: "Invalid quote amount" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    INSERT INTO jobs (customer_id, job_type, description, status, quote_amount, paid, date_done)
    VALUES (
      ${customerId},
      ${jobType},
      ${description || null},
      ${statusRaw},
      ${quoteAmount},
      ${paid},
      ${dateDone}::date
    )
    RETURNING id;
  `;

  type InsertRow = { id: number | string };
  const rowsTyped = rows as InsertRow[];
  const jobId = Number(rowsTyped[0].id);

  const photoFiles = formData.getAll("photos");
  const photoTypes = formData.getAll("photoTypes").map((x) => String(x));
  const count = Math.min(photoFiles.length, photoTypes.length);

  if (count > 0) {
    const cloudinary = getCloudinary();
    const preset = requiredEnv("CLOUDINARY_UPLOAD_PRESET");

    // Upload sequentially to keep memory usage reasonable on mobile-sized photos.
    for (let i = 0; i < count; i++) {
      const file = photoFiles[i] as unknown as File;
      const tag = photoTypes[i];
      if (!file || typeof file.arrayBuffer !== "function") continue;
      if (tag !== "before" && tag !== "after") continue;

      const buffer = Buffer.from(await file.arrayBuffer());

      const uploadResult = await new Promise<{ secure_url?: string }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            upload_preset: preset,
            folder: "garden-tracker",
            resource_type: "image",
          },
          (err, result) => {
            if (err) return reject(err);
            resolve({ secure_url: result?.secure_url });
          }
        );
        uploadStream.end(buffer);
      });

      if (!uploadResult.secure_url) continue;

      await sql`
        INSERT INTO photos (job_id, cloudinary_url, type)
        VALUES (${jobId}, ${uploadResult.secure_url}, ${tag}::photo_type);
      `;
    }
  }

  return NextResponse.json({ ok: true, jobId });
}

