
import { GoogleGenerativeAI } from '@google/generative-ai';

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // 1. Parse Input
    // API Gateway / Lambda Function URL often wraps body in a string
    const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : event;
    const { digest, apiKey } = body;

    if (!digest || !Array.isArray(digest)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid input. Expected "digest" array.' }),
      };
    }

    if (!apiKey) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'API Key is required.' }),
      };
    }

    // 2. Prepare Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // 3. Construct Prompt
    const digestText = digest
      .map(
        (pattern, index) =>
          `${index + 1}. Component '${pattern.component}' had ${pattern.frequency} '${pattern.level}' logs. Sample: "${pattern.sampleContent.substring(0, 100)}..."`
      )
      .join('\n\n');

    const prompt = `Analyze these log patterns. For each, provide a "Human Meaning" (1 sentence for non-techies) and a "Severity Score" (1-10).
    RETURN ONLY JSON ARRAY:
    [{"index":1,"humanMeaning":"...","severityScore":8}]
    
    PATTERNS:
    ${digestText}`;

    // 4. Call AI
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 5. Clean JSON
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    return {
      statusCode: 200,
      body: jsonText,
    };

  } catch (error) {
    console.error('Lambda Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
