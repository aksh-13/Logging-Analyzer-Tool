'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { LogDigest, AISummary } from '@/types/logs';

/**
 * Server Action to analyze log digest
 * Hybrid execution: Uses AWS Lambda if configured, otherwise runs locally
 */
export async function analyzeLogDigest(digest: LogDigest[]): Promise<AISummary[]> {
  const API_KEY = process.env.GEMINI_API_KEY;
  const LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME;
  const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  // OPTION 1: AWS Lambda Execution (Serverless)
  if (LAMBDA_FUNCTION_NAME && process.env.AWS_ACCESS_KEY_ID) {
    console.log(`[Analysis] Delegating to AWS Lambda: ${LAMBDA_FUNCTION_NAME}`);

    // Lazy initialize Lambda client
    const lambdaClient = new LambdaClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    try {
      const payload = {
        digest,
        apiKey: API_KEY, // Passing key secure server-to-server
      };

      const command = new InvokeCommand({
        FunctionName: LAMBDA_FUNCTION_NAME,
        Payload: JSON.stringify(payload),
      });

      const response = await lambdaClient.send(command);

      if (response.FunctionError) {
        throw new Error(`Lambda execution failed: ${response.FunctionError}`);
      }

      // Parse Lambda response
      const responsePayload = JSON.parse(new TextDecoder().decode(response.Payload));

      // Handle API Gateway style response (body might be stringified)
      const body = responsePayload.body ? (typeof responsePayload.body === 'string' ? JSON.parse(responsePayload.body) : responsePayload.body) : responsePayload;

      // Extract JSON array
      return body;

    } catch (error) {
      console.error('[Analysis] Lambda execution failed, falling back to local:', error);
      // Fallthrough to local execution on failure? Or just throw?
      // For this demo, let's fall through to ensure robustness
    }
  }

  // OPTION 2: Local Execution (Fallback / Dev Mode)
  console.log(`[Analysis] Running locally (Server Action)`);

  const genAI = new GoogleGenerativeAI(API_KEY);
  // Use gemini-1.5-flash (stable)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Create a minimal, human-readable digest for Gemini
  const digestText = digest
    .map(
      (pattern, index) =>
        `${index + 1}. The Component '${pattern.component}' had ${pattern.frequency} '${pattern.level}' logs. Sample: "${pattern.sampleContent.substring(0, 100)}${pattern.sampleContent.length > 100 ? '...' : ''}"`
    )
    .join('\n\n');

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

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
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
        severityScore: Math.max(1, Math.min(10, aiResponse.severityScore)),
      };
    });

    return summaries;
  } catch (error) {
    console.error('Error analyzing log digest with Gemini:', error);
    throw new Error('Failed to analyze log digest locally.');
  }
}

