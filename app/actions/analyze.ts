'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { LogGroup, AnalyzedInsight } from '@/types/log';

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('GEMINI_API_KEY is not set in environment variables');
}

/**
 * Server Action to analyze log groups using Gemini AI
 */
export async function analyzeLogsWithAI(logGroups: LogGroup[]): Promise<AnalyzedInsight[]> {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  // Use gemini-2.5-flash (gemini-1.5-flash was retired in 2025)
  const models = ['gemini-2.5-flash', 'gemini-1.5-pro'];
  let currentModelIndex = 0;
  let model = genAI.getGenerativeModel({ model: models[currentModelIndex] });

  // Prepare the prompt with log patterns
  const logPatternsText = logGroups
    .map(
      (group, index) =>
        `${index + 1}. Component: ${group.component}\n   Level: ${group.level}\n   Frequency: ${group.count} occurrences\n   Content: ${group.content}\n   Sample Time: ${group.sampleTime}`
    )
    .join('\n\n');

  const prompt = `You are a technical log analysis expert. I will provide you with Windows system log patterns that have been grouped by frequency and severity.

Translate each technical log pattern into a structured analysis with 3 components:
1. **Plain English Summary**: A clear, non-technical explanation of what this log means for a business user or non-technical stakeholder.
2. **Business/System Impact**: Explain the potential impact on business operations, system performance, or user experience.
3. **Recommended Fix**: Provide actionable steps to resolve or mitigate this issue.

Return the response as a valid JSON array where each object has the following structure:
{
  "index": <number from 1 to N>,
  "plainEnglish": "<plain English summary>",
  "businessImpact": "<impact description>",
  "recommendedFix": "<fix recommendation>"
}

Here are the log patterns to analyze:

${logPatternsText}

Return ONLY the JSON array, no additional text or markdown formatting.`;

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Extract JSON from response (handle markdown code blocks if present)
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const aiResponses = JSON.parse(jsonText) as Array<{
        index: number;
        plainEnglish: string;
        businessImpact: string;
        recommendedFix: string;
      }>;

      // Map AI responses back to log groups
      const insights: AnalyzedInsight[] = logGroups.map((group, idx) => {
        const aiResponse = aiResponses.find((r) => r.index === idx + 1) || {
          index: idx + 1,
          plainEnglish: 'Analysis pending...',
          businessImpact: 'Impact assessment pending...',
          recommendedFix: 'Fix recommendation pending...',
        };

        return {
          contentFingerprint: group.contentFingerprint,
          component: group.component,
          level: group.level,
          count: group.count,
          plainEnglish: aiResponse.plainEnglish,
          businessImpact: aiResponse.businessImpact,
          recommendedFix: aiResponse.recommendedFix,
          originalContent: group.content,
          sampleTime: group.sampleTime,
        };
      });

      return insights;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;
      
      // Check if it's a rate limit error
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        if (attempt < maxRetries - 1) {
          // Extract retry delay from error if available, otherwise use exponential backoff
          const retryDelayMatch = errorMessage.match(/retry in (\d+(?:\.\d+)?)s/i);
          const retryDelay = retryDelayMatch 
            ? Math.ceil(parseFloat(retryDelayMatch[1])) * 1000 
            : Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          
          console.log(`Rate limit hit, retrying in ${retryDelay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          // If all retries failed due to rate limit, try a different model
          if (currentModelIndex < models.length - 1) {
            currentModelIndex++;
            console.log(`Switching to ${models[currentModelIndex]} due to rate limits...`);
            model = genAI.getGenerativeModel({ model: models[currentModelIndex] });
            // Reset attempt counter for new model
            attempt = -1;
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before trying new model
            continue;
          }
        }
      }
      
      // If not a rate limit error or max retries reached, throw
      if (attempt === maxRetries - 1) {
        console.error('Error analyzing logs with Gemini:', error);
        throw new Error(
          `Failed to analyze logs with AI after ${maxRetries} attempts: ${errorMessage}`
        );
      }
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Unknown error occurred');
}

