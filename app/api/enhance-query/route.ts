import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Check if API key is configured
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      // If no API key, just return the original query
      return NextResponse.json({ enhancedQuery: query });
    }

    // Use Gemini to answer the query and convert to search term
    const { text } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      prompt: `You are a helpful assistant that answers questions and converts them into Wikipedia search terms.

If the user asks a question (like "CEO of Google" or "who invented the telephone"), answer it briefly with the specific person, thing, or concept, then return ONLY that answer as the search term.

If the user provides a search term (like "Elon Musk" or "Bitcoin"), optimize it for Wikipedia search.

Rules:
1. Return ONLY the final search term, nothing else (no explanations)
2. For questions, answer with the specific entity (person, place, thing, concept)
3. Fix typos and spelling errors
4. Use proper capitalization for proper nouns
5. Keep it concise (1-5 words maximum)
6. Expand abbreviations when needed

Examples:
- "CEO of Google" → "Sundar Pichai"
- "who invented telephone" → "Alexander Graham Bell"
- "capital of france" → "Paris"
- "e on musk" → "Elon Musk"
- "ww2" → "World War II"
- "einstein" → "Albert Einstein"
- "Bitcoin" → "Bitcoin"

User query: "${query}"

Search term:`,
    });

    const enhancedQuery = text.trim();

    return NextResponse.json({ enhancedQuery });
  } catch (error: unknown) {
    console.error("AI Enhancement Error:", error);

    // If AI fails, return the original query
    const body = await request.json();
    return NextResponse.json({ enhancedQuery: body.query });
  }
}
