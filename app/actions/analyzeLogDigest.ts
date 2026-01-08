'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { LogDigest, AISummary } from '@/types/logs';

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('GEMINI_API_KEY is not set in environment variables');
}

/**
 * Server Action to analyze log digest using Gemini AI
 * Takes pre-aggregated patterns (not raw logs) to minimize API calls
 */
export async function analyzeLogDigest(digest: LogDigest[]): Promise<AISummary[]> {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  // Verify we're receiving a digest (not raw logs)
  console.log(`[Digest] Processing ${digest.length} unique patterns (not raw logs)`);
  console.log(`[Digest] Sample pattern:`, digest[0]);

  const genAI = new GoogleGenerativeAI(API_KEY);
  // Use gemini-2.5-flash (gemini-1.5-flash was retired in 2025)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Create a minimal, human-readable digest for Gemini
  // Format: "Component 'X' had Y 'Level' logs about..." (exactly as specified)
  // This is the "money-saving" approach - only unique patterns, not 10k+ raw logs
  const digestText = digest
    .map(
      (pattern, index) =>
        `${index + 1}. The Component '${pattern.component}' had ${pattern.frequency} '${pattern.level}' logs. Sample: "${pattern.sampleContent.substring(0, 100)}${pattern.sampleContent.length > 100 ? '...' : ''}"`
    )
    .join('\n\n');
  
  console.log(`[Digest] Sending ${digest.length} patterns to AI (digest size: ${digestText.length} chars)`);

  const prompt = `I am providing a summarized digest of system logs. Each entry represents a log pattern that occurred multiple times.

For each pattern, provide:
1. A 1-sentence "Human Meaning" explanation for non-technical users (explain it like I'm 5)
2. A "Severity Score" from 1-10 (where 10 is critical and 1 is informational)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "index": 1,
    "humanMeaning": "Brief explanation in plain English",
    "severityScore": 8
  },
  ...
]

Here are the log patterns:
${digestText}

Return ONLY the JSON array, no additional text or markdown formatting.`;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Extract JSON from response
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const aiResponses = JSON.parse(jsonText) as Array<{
        index: number;
        humanMeaning: string;
        severityScore: number;
      }>;

      // Map AI responses back to digest patterns
      const summaries: AISummary[] = digest.map((_, idx) => {
        const aiResponse = aiResponses.find((r) => r.index === idx + 1) || {
          index: idx + 1,
          humanMeaning: 'Analysis pending...',
          severityScore: 5,
        };

        return {
          humanMeaning: aiResponse.humanMeaning,
          severityScore: Math.max(1, Math.min(10, aiResponse.severityScore)), // Clamp 1-10
        };
      });

      return summaries;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      // Handle 404 errors (model not found) - provide helpful guidance
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        throw new Error(
          `Gemini model not available with your API key. Please:\n` +
          `1. Check your API key at https://makersuite.google.com/app/apikey\n` +
          `2. Ensure your project is correctly linked in Google AI Studio\n` +
          `3. Verify billing is set up (even for free tier)\n` +
          `4. Ensure your API key has access to gemini-2.5-flash\n` +
          `5. Try creating a new API key if needed\n` +
          `Error details: ${errorMessage}`
        );
      }

      // Handle rate limits
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        if (attempt < maxRetries - 1) {
          const retryDelayMatch = errorMessage.match(/retry in (\d+(?:\.\d+)?)s/i);
          const retryDelay = retryDelayMatch
            ? Math.ceil(parseFloat(retryDelayMatch[1])) * 1000
            : Math.pow(2, attempt) * 1000;

          console.log(`Rate limit hit, retrying in ${retryDelay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }
      }

      if (attempt === maxRetries - 1) {
        console.error('Error analyzing log digest with Gemini:', error);
        throw new Error(
          `Failed to analyze log digest after ${maxRetries} attempts: ${errorMessage}`
        );
      }
    }
  }

  throw lastError || new Error('Unknown error occurred');
}

