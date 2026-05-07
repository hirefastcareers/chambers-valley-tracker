import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { customerAreaFromAddress } from "@/lib/customerArea";
import { formatDateDDMMYYYY } from "@/lib/format";

export const runtime = "nodejs";

// Requires ANTHROPIC_API_KEY in Vercel environment variables
// Get your API key from console.anthropic.com

const FALLBACK_POST = "Could not generate post — please write your own";

const SYSTEM_PROMPT = `You are a social media assistant for Chambers Valley Garden Care, a professional gardening business based in Chapeltown, Sheffield run by Tom. Generate a friendly, conversational Facebook post for Tom's business page about a recently completed job. 

The post should:
- Be warm and conversational — written as Tom speaking directly
- Mention the type of work done and the general area (never mention the customer's name)
- Include a clear call to action at the end encouraging people to get in touch for a free quote
- End with 4-6 relevant hashtags for Sheffield/gardening
- Be 3-5 sentences maximum — concise but engaging
- Never mention specific prices
- Sound like a real person, not a marketing robot

Return only the post text, nothing else.`;

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function callClaude(userMessage: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const block = data.content?.find((c) => c.type === "text");
    const text = typeof block?.text === "string" ? block.text.trim() : "";
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const json = (await req.json().catch(() => null)) as { job_id?: unknown } | null;
  const jobId = Number(json?.job_id);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid job_id" }, { status: 400 });
  }

  const sql = getSql();

  const photoRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM photos
    WHERE job_id = ${jobId};
  `;
  const photoCount = Number((photoRows as Array<{ count: number | string }>)[0]?.count ?? 0);
  if (photoCount <= 0) {
    return NextResponse.json({ ok: false, error: "Job has no photos" }, { status: 400 });
  }

  const jobRows = await sql`
    SELECT
      j.job_type,
      j.description,
      j.date_done,
      c.address
    FROM jobs j
    INNER JOIN customers c ON c.id = j.customer_id
    WHERE j.id = ${jobId}
    LIMIT 1;
  `;

  type JobJoin = {
    job_type: string;
    description: string | null;
    date_done: string | null;
    address: string | null;
  };

  const job = (jobRows as JobJoin[])[0];
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const area = customerAreaFromAddress(job.address);
  const dateStr = formatDateDDMMYYYY(job.date_done);
  const description = job.description?.trim() || "—";

  const userMessage = `Job type: ${job.job_type}
Description: ${description}  
Area: ${area}
Date: ${dateStr}

Generate a Facebook post for this completed job.`;

  const generated = await callClaude(userMessage);
  const post_text = generated ?? FALLBACK_POST;

  return NextResponse.json({ post_text });
}
