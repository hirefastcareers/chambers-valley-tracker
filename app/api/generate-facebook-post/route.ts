import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { customerAreaFromAddress } from "@/lib/customerArea";
import { formatDateDDMMYYYY } from "@/lib/format";

export const runtime = "nodejs";

// Requires ANTHROPIC_API_KEY in Vercel environment variables
// Get your API key from console.anthropic.com

const FALLBACK_POST = "Could not generate post — please write your own";

const SYSTEM_PROMPT = `You are a social media assistant for a gardening business. Generate TWO versions of a social media post about a completed job — one for Facebook and one for Instagram.

FACEBOOK POST rules:
- Maximum 3 lines — short and punchy
- Line 1: One eye-catching sentence about the result with an emoji at the start. Vary the opening every time.
- Line 2: One friendly call to action e.g. "Free quotes — just send us a message 👇"
- Line 3: 📞 07438436390
- NO hashtags on Facebook
- Never mention street names or specific addresses
- Never use the word "transformation"
- Sound like a real local tradesperson

INSTAGRAM POST rules:
- Same opening line as Facebook
- Same call to action
- Then a blank line
- Then 6-8 hashtags — mix of Sheffield-specific and job-specific, always include #SheffieldGardener #BeforeAndAfter #Sheffield
- Then 📞 07438436390
- NO hashtags in the main caption — only after the blank line

Return your response in this exact format:
FACEBOOK:
[facebook post here]

INSTAGRAM:
[instagram post here]`;

const PHONE_SUFFIX = "\n📞 07438436390";

function withPhoneSuffix(text: string): string {
  const t = text.trimEnd();
  if (/\n📞\s*07438436390\s*$/m.test(t)) return t;
  return `${t}${PHONE_SUFFIX}`;
}

function parseDualPostResponse(text: string): { facebook: string; instagram: string } {
  const fbMatch = text.match(/FACEBOOK:\s*([\s\S]*?)(?=INSTAGRAM:|$)/i);
  const igMatch = text.match(/INSTAGRAM:\s*([\s\S]*?)$/i);

  const facebook = fbMatch?.[1]?.trim() ?? "";
  const instagram = igMatch?.[1]?.trim() ?? "";

  if (facebook.length > 0 && instagram.length > 0) {
    return { facebook, instagram };
  }

  return { facebook: FALLBACK_POST, instagram: FALLBACK_POST };
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
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const json = (await req.json().catch(() => null)) as { job_id?: unknown } | null;
  const jobId = Number(json?.job_id);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid job_id" }, { status: 400 });
  }

  const sql = getSql();

  const photoRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM photos
    WHERE job_id = ${jobId}
      AND user_id = ${userId};
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
      AND j.user_id = ${userId}
      AND c.user_id = ${userId}
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

Generate both Facebook and Instagram posts for this completed job.`;

  const generated = await callClaude(userMessage);
  const parsed = parseDualPostResponse(generated ?? FALLBACK_POST);

  const facebook_post = withPhoneSuffix(parsed.facebook);
  const instagram_post = withPhoneSuffix(parsed.instagram);

  return NextResponse.json({ facebook_post, instagram_post });
}
