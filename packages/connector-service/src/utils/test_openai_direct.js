const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testPrompt() {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: 'Return ONLY this JSON: {"tracking_plan": {"framework_detected": "nextjs", "files_to_create": [{"path": "src/test.ts", "content": "console.log(\\"test\\");"}]}, "implementation": "test"}'
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1
  });
  
  console.log(response.choices[0].message.content);
}

testPrompt().catch(console.error);
