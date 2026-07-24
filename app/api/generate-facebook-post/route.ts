import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { customerAreaFromAddress } from "@/lib/customerArea";
import { formatDateDDMMYYYY } from "@/lib/format";

export const runtime = "nodejs";

// Requires ANTHROPIC_API_KEY in Vercel environment variables
// Get your API key from console.anthropic.com

const SYSTEM_PROMPT = `You are a social media assistant for a gardening business. Generate TWO versions of a social media post about a completed job - one for Facebook and one for Instagram.

Use hyphens - not em dashes — — em dashes sound too formal.

FACEBOOK POST rules:
- Maximum 3 lines - short and punchy
- Line 1: One eye-catching sentence about the result with an emoji at the start. Vary the opening every time.
- Line 2: One friendly call to action e.g. "Free quotes - just send me a message 👇"
- Line 3: 📞 07438436390
- NO hashtags on Facebook
- Never mention street names or specific addresses
- Never use the word "transformation"
- Sound like a real local tradesperson

INSTAGRAM POST rules:
- Same opening line as Facebook
- Same call to action
- Then a blank line
- Then 6-8 hashtags - mix of Sheffield-specific and job-specific, always include #SheffieldGardener #BeforeAndAfter #Sheffield
- Then 📞 07438436390
- NO hashtags in the main caption - only after the blank line

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

function parseDualPostResponse(text: string): { facebookPost: string | null; instagramPost: string | null } {
  const facebookMatch = text.match(/FACEBOOK:\s*([\s\S]*?)(?=INSTAGRAM:|$)/);
  const instagramMatch = text.match(/INSTAGRAM:\s*([\s\S]*?)$/);
  const facebookPost = facebookMatch ? facebookMatch[1].trim() : null;
  const instagramPost = instagramMatch ? instagramMatch[1].trim() : null;

  console.log("[social-post] Claude raw response:", text);
  console.log("[social-post] Parsed facebook:", facebookPost);
  console.log("[social-post] Parsed instagram:", instagramPost);

  return { facebookPost, instagramPost };
}

type ClaudeResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

async function callClaude(userMessage: string): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error("[social-post] ANTHROPIC_API_KEY is not set");
    return { ok: false, error: "Anthropic API key is not configured" };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error("[social-post] Claude API error:", res.status, errorBody);
      return { ok: false, error: `Claude API request failed (${res.status})` };
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const block = data.content?.find((c) => c.type === "text");
    const text = typeof block?.text === "string" ? block.text.trim() : "";
    if (text.length === 0) {
      console.error("[social-post] Claude returned empty response");
      return { ok: false, error: "Claude returned an empty response" };
    }

    return { ok: true, text };
  } catch (error) {
    console.error("[social-post] Claude request failed:", error);
    return { ok: false, error: "Claude request failed" };
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
    return NextResponse.json(
      { ok: false, error: "This job has no photos — add before/after photos first" },
      { status: 400 }
    );
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

  const claudeResult = await callClaude(userMessage);
  if (!claudeResult.ok) {
    return NextResponse.json(
      {
        facebook_post: null,
        instagram_post: null,
        error: claudeResult.error,
      },
      { status: 502 }
    );
  }

  const { facebookPost, instagramPost } = parseDualPostResponse(claudeResult.text);

  if (!facebookPost || !instagramPost) {
    return NextResponse.json(
      {
        facebook_post: null,
        instagram_post: null,
        error: "Failed to parse Claude response",
      },
      { status: 502 }
    );
  }

  const facebook_post = withPhoneSuffix(facebookPost);
  const instagram_post = withPhoneSuffix(instagramPost);

  return NextResponse.json({ facebook_post, instagram_post });
}
