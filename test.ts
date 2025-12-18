// test.ts
import { ObservAIClient } from "./sdk/src/index";

// Make sure this is set:
// export GEMINI_API_KEY="AIzaSy_... (from AI Studio)"

const apiKey = process.env.GEMINI_API_KEY;

// If no API key is provided, create a lightweight mock AI client so the test
// can run locally without requiring the Google generative client package.
const mockAIClient = {
  models: {
    async generateContent({ model, contents }: any) {
      const text = `MOCK RESPONSE for model=${model}: ${String(contents).slice(0, 120)}`;
      return { text };
    },
  },
};

const client = new ObservAIClient({
  apiKey: apiKey, // may be undefined; ObservAIClient accepts aiClient instead
  aiClient: apiKey ? undefined : mockAIClient,
  endpoint: "https://nztdwsnmttwwjticuphi.supabase.co/functions/v1/track-llm",
  userEmail: "safishafwan@gmail.com",
  userId: "061ffd2c-5bd2-4a29-a5f2-1a25657d8234",
  projectName: "sdk-test",
  debug: true,
});

const result = await client.generateContent(
  "gemini-2.5-flash",
  "What is the meaning of life?"
);

console.log("Response:", result.response.text());
console.log("Tracking:", result.tracking);

await client.dispose();
