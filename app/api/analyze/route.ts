import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, Output, type LanguageModel } from "ai"
import { z } from "zod"

export const maxDuration = 60

const clipsSchema = z.object({
  clips: z
    .array(
      z.object({
        title: z.string().describe("A short, punchy clip title (max 60 chars)"),
        start: z.number().describe("Start time in seconds, >= 0"),
        end: z.number().describe("End time in seconds, > start"),
        reason: z.string().describe("One sentence explaining why this segment will go viral"),
        virality: z.number().min(0).max(100).describe("Estimated virality score 0-100"),
      }),
    )
    .length(3),
})

type AnalyzeRequest = {
  duration: number
  frames: { timestamp: number; base64: string }[]
}

/**
 * Resolve a Gemini model. Priority:
 *   1. GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) → direct Google API,
 *      bypasses the Vercel AI Gateway entirely.
 *   2. Fall back to the gateway model id, which routes through Vercel AI Gateway.
 *      The gateway requires a valid credit card on the team's Vercel account.
 */
function resolveModel(): { model: LanguageModel; via: "direct" | "gateway" } {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY ?? null

  if (apiKey) {
    const google = createGoogleGenerativeAI({ apiKey })
    return { model: google("gemini-1.5-flash"), via: "direct" }
  }
  return { model: "google/gemini-1.5-flash", via: "gateway" }
}

export async function POST(req: Request) {
  let body: AnalyzeRequest
  try {
    body = (await req.json()) as AnalyzeRequest
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { duration, frames } = body
  if (!duration || !Array.isArray(frames) || frames.length === 0) {
    return Response.json({ error: "duration and frames[] are required" }, { status: 400 })
  }

  const promptText =
    `You are a short-form video producer. The source video is ${duration.toFixed(1)} seconds long. ` +
    `The ${frames.length} attached frames were sampled at these timestamps (in seconds): ` +
    `${frames.map((f) => f.timestamp.toFixed(1)).join(", ")}. ` +
    `Identify exactly 3 non-overlapping segments that would perform best as vertical short-form clips ` +
    `(TikTok / Reels / Shorts). ` +
    (duration < 45
      ? `Since the video is short, each clip should be between 5 and 15 seconds long. `
      : `Each clip MUST be between 15 and 60 seconds long. `) +
    `Start and end timestamps MUST lie within [0, ${duration.toFixed(1)}]. ` +
    `Optimize for hooks, emotional peaks, surprise, and payoff. ` +
    `Return a punchy title, the start and end timestamps, a one-sentence virality reason, and a ` +
    `virality score 0-100 for each.`

  const { model, via } = resolveModel()

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: clipsSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            ...frames.map((f) => ({
              type: "image" as const,
              image: f.base64,
            })),
          ],
        },
      ],
    })

    const clips = output.clips
      .map((c) => {
        const start = Math.max(0, Math.min(c.start, duration - 1))
        const end = Math.max(start + 1, Math.min(c.end, duration))
        return { ...c, start, end }
      })
      .sort((a, b) => a.start - b.start)

    return Response.json({ clips, via })
  } catch (err) {
    console.error("[analyze] error:", err)
    const raw = err instanceof Error ? err.message : "Unknown error"

    // Detect the well-known Vercel AI Gateway billing-verification error and
    // surface a concrete, actionable message to the UI.
    const isCardRequired =
      via === "gateway" &&
      /credit card|customer_verification_required|payment/i.test(raw)

    const message = isCardRequired
      ? "Vercel AI Gateway requires a credit card on file before it will route requests. " +
        "Add a card at https://vercel.com/dashboard/ai (free credits will then unlock), " +
        "or set GOOGLE_GENERATIVE_AI_API_KEY in your project's environment variables to call " +
        "Gemini directly and bypass the gateway."
      : `Gemini analysis failed: ${raw}`

    return Response.json(
      {
        error: message,
        code: isCardRequired ? "GATEWAY_CARD_REQUIRED" : "ANALYZE_FAILED",
        via,
      },
      { status: isCardRequired ? 402 : 500 },
    )
  }
}
