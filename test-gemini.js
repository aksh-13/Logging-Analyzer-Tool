
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API KEY found in .env.local");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    console.log("Checking available models for key ending in...", apiKey.slice(-4));

    try {
        // For some versions of the SDK, listModels isn't directly on client, 
        // but let's try a direct model call first or just print what we can.
        // Actually, let's just try to generate content with a very simple request to test connection.
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hello?");
        console.log("Success! Response:", result.response.text());
    } catch (error) {
        console.error("Error details:", error.message);
        if (error.response) {
            console.error("Response:", await error.response.json());
        }
    }
}

listModels();
