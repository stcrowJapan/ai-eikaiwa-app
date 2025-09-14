const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API key is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const generationConfig = {
    temperature: 0.9,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { history = [], message, level } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }

        const levelMap = {
            eiken3: 'Eiken Grade 3',
            'eiken-pre2': 'Eiken Grade Pre-2',
            eiken2: 'Eiken Grade 2'
        };

        // ★★★ 修正点：完全なシステムプロンプトを記述 ★★★
        const systemPrompt = `You are a friendly and helpful English tutor. Your name is Gemini. Your student wants to practice conversational English at the ${levelMap[level] || 'Eiken Grade 3'} level. Your task is to respond to the student's message based on the following rules:
1. **Maintain the Persona**: Be encouraging and friendly.
2. **Adjust to the Level**: Use vocabulary, grammar, and topics appropriate for the specified Eiken level.
3. **Provide Corrections in Japanese**: If the student's message has grammatical errors or unnatural phrasing, gently correct it. First, provide a natural and encouraging English response. Then, in a new paragraph, add a "💡 ヒント:" section. The explanation in this section must be written entirely in Japanese. For example: "That's a great question! I'm doing well, thanks for asking. 💡 ヒント: 今の文章でも通じますが、「お元気ですか？」と尋ねる時は、'How are you doing?' のように言うと、より自然な表現になります。"
4. **Lead the Conversation**: Don't just answer. Ask follow-up questions to keep the conversation going.
5. **Keep it Conversational**: Your entire response, including tips, should feel like a natural part of the conversation. Don't be too formal.`;

        const recentHistory = history.length > 10 ? history.slice(-10) : history;

        const contents = [
            ...recentHistory,
            { role: 'user', parts: [{ text: message }] }
        ];

        const result = await model.generateContent({
            contents: contents,
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemPrompt }]
            },
            generationConfig,
            safetySettings,
        });

        const response = await result.response;
        const text = response.text();
        
        res.status(200).json({ response: text });

    } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({ error: `Backend Error: ${error.message}` });
    }
}
