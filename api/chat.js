const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API key is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const generationConfig = {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    maxOutputTokens: 1024,
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const systemPrompt = `English tutor for Eiken practice. Be friendly and encouraging. If student makes errors, respond naturally then add "💡 ヒント:" with Japanese correction. Ask follow-up questions.`;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { history = [], message, level } = req.body; // level is not used in this version, but kept for compatibility

        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }

        // ★★★ 修正点：互換性の高い形式でプロンプトと履歴を構築 ★★★
        const recentHistory = history.length > 6 ? history.slice(-6) : history;

        const contents = [
            // 常にシステムプロンプトを最初のuserメッセージとして含める
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: "Okay, I understand. I'm ready to start the conversation as a friendly English tutor." }] },
            ...recentHistory,
            { role: 'user', parts: [{ text: message }] }
        ];

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 25000)
        );

        const result = await Promise.race([
            model.generateContent({
                contents: contents,
                generationConfig,
                safetySettings,
            }),
            timeoutPromise
        ]);

        const response = await result.response;
        const text = response.text();
        
        res.status(200).json({ response: text });

    } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({ error: `Backend Error: ${error.message}` });
    }
}
