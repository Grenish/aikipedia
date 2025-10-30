import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { title, summary, content } = await request.json();

    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: "Title and content are required" }),
        { status: 400 },
      );
    }

    // Check if API key is configured
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500 },
      );
    }

    // Generate AI overview using streaming
    const result = streamText({
      model: google("gemini-2.0-flash-exp"),
      prompt: `You are an expert editor specializing in concise, authoritative summaries of Wikipedia articles.

      Given the Wikipedia article titled "${title}", produce a single, professional paragraph (150–200 words) that:
      1. Highlights the most essential, noteworthy, and impactful facts with precision and clarity.
      2. Employs a clear, direct, and professional tone—conversational yet objective, like a senior analyst briefing a colleague.
      3. Opens immediately with the topic’s defining significance or breakthrough—no generic definitions.
      4. Clearly conveys the subject’s broader importance, influence, or contemporary relevance without exaggeration.
      5. Integrates critical details from the provided summary and first 2000 characters into a cohesive, logical flow.
      6. Eliminates redundancy, jargon, and filler—every sentence advances understanding.

      Article Title: ${title}

      Summary: ${summary}

      Full Content (first 2000 characters): ${content.substring(0, 2000)}

      Deliver one polished, information-dense paragraph that stands as the definitive executive overview:`,
    });
    return result.toTextStreamResponse();
  } catch (error: unknown) {
    console.error("AI Overview Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate overview" }),
      { status: 500 },
    );
  }
}
