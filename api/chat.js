const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const API_KEY = process.env.API_KEY;

// APIキーが設定されていない場合は、早期にエラーを返す
if (!API_KEY) {
    // このエラーはサーバーの起動時に発生し、Vercelのログで確認できます
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

        const systemPrompt = `You are a friendly and helpful English tutor...`; // Assuming prompt is correct

        // ★★★ タイムアウト対策：AIに渡す履歴を直近10ターンに制限 ★★★
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
