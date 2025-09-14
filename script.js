import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const speakBtn = document.getElementById('speak-btn');
    const levelSelect = document.getElementById('level-select');
    const apiKeyInput = document.getElementById('api-key');
    const saveKeyBtn = document.getElementById('save-key');
    const clearHistoryBtn = document.getElementById('clear-history');

    let isConversationActive = false;
    let conversationHistory = [];
    let genAI = null;
    let model = null;

    // Load saved API key and conversation history
    const savedApiKey = localStorage.getItem('gemini-api-key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        initializeGemini(savedApiKey);
    }

    // Load conversation history
    function loadConversationHistory() {
        const level = levelSelect.value;
        const saved = localStorage.getItem(`conversation-history-${level}`);
        if (saved) {
            try {
                conversationHistory = JSON.parse(saved);
                displayConversationHistory();
            } catch (e) {
                conversationHistory = [];
            }
        } else {
            conversationHistory = [];
        }
    }

    // Save conversation history
    function saveConversationHistory() {
        const level = levelSelect.value;
        localStorage.setItem(`conversation-history-${level}`, JSON.stringify(conversationHistory));
    }

    // Display saved conversation history
    function displayConversationHistory() {
        chatWindow.innerHTML = '';
        conversationHistory.forEach(msg => {
            if (msg.role === 'user') {
                addMessage(msg.parts[0].text, 'user');
            } else if (msg.role === 'model') {
                addMessage(msg.parts[0].text, 'ai');
            }
        });
        if (conversationHistory.length === 0 && model) {
            addMessage("レベルを選択して「会話を開始」ボタンを押すと、AIとの英会話練習が始まります。間違いがあれば日本語でヒントをくれます！", 'ai');
        }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
    } else {
        alert('お使いのブラウザは音声認識をサポートしていません。Chromeの使用をお勧めします。');
        speakBtn.disabled = true;
    }
    const synth = window.speechSynthesis;

    function initializeGemini(apiKey) {
        try {
            genAI = new GoogleGenerativeAI(apiKey);
            model = genAI.getGenerativeModel({ 
                model: 'gemini-1.5-flash',
                generationConfig: {
                    temperature: 0.8,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 2048,
                },
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                ]
            });
            console.log('Gemini AI initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Gemini AI:', error);
            addMessage('APIキーの初期化に失敗しました。正しいAPIキーを入力してください。', 'ai');
        }
    }

    function addMessage(text, sender) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `message ${sender}-message`;
        const messageBubble = document.createElement('p');
        const textSpan = document.createElement('span');
        textSpan.innerHTML = text;
        messageBubble.appendChild(textSpan);
        if (sender === 'ai') {
            const listenBtn = document.createElement('button');
            listenBtn.className = 'listen-btn-bubble';
            listenBtn.innerHTML = '🔊';
            listenBtn.dataset.textToSpeak = text;
            messageBubble.appendChild(listenBtn);
        }
        messageWrapper.appendChild(messageBubble);
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return messageWrapper;
    }

    function speak(text) {
        if (isConversationActive) recognition.stop();
        if (synth.speaking) synth.cancel();
        const strippedText = text.replace(/<[^>]*>/g, ' ');
        const mainPart = strippedText.split('💡')[0];
        const utterance = new SpeechSynthesisUtterance(mainPart);
        utterance.lang = 'en-US';
        utterance.onend = () => { if (isConversationActive) recognition.start(); };
        utterance.onerror = (event) => { console.error('SpeechSynthesis Error', event); if (isConversationActive) recognition.start(); };
        synth.speak(utterance);
    }

    async function fetchAIResponse(message) {
        if (!model) {
            addMessage('APIキーが設定されていません。まずAPIキーを入力してSaveボタンを押してください。', 'ai');
            return;
        }

        const level = levelSelect.value;
        const thinkingIndicator = addMessage("<i>Thinking...</i>", 'ai');
        speakBtn.disabled = true;

        try {
            const levelDetails = {
                'eiken3': 'basic everyday conversation, simple present/past, hobbies, family, school',
                'eiken-pre2': 'expressing opinions, future plans, comparing things, describing experiences', 
                'eiken2': 'complex discussions, abstract topics, giving advice, expressing emotions'
            };
            
            const systemPrompt = `You are a friendly English conversation tutor helping with ${level} level practice. 

CONVERSATION RULES:
1. Have natural, flowing conversations about ${levelDetails[level]}
2. Give 3-4 sentence responses to keep conversation rich and engaging
3. Always end with a follow-up question to continue the conversation

HINT SYSTEM:
When the student makes errors, provide Japanese hints in this EXACT format:
- First: Give your complete English response (3-4 sentences + follow-up question)
- Then: Add a NEW paragraph starting with "💡 ヒント:" 

TYPES OF HINTS TO PROVIDE:
- Grammar corrections (tense, articles, word order)
- Vocabulary improvements (better word choices, natural expressions)
- Response content suggestions ("You could also mention..." / "Try asking about...")
- Conversation flow tips ("Good! Next time you could add details about...")

EXAMPLE:
Student: "I like music very much. I listen everyday."
You: "That's wonderful! Music is such a great way to relax and enjoy life. What kind of music do you like the most? Do you have a favorite artist or band that you listen to regularly?

💡 ヒント: 「everyday」ではなく「every day」（2単語）が正しいです。また、「I listen to music every day」のように「to」を入れるとより自然になります。音楽について話すときは、具体的なジャンルやアーティストを聞くと会話が盛り上がりますよ！"

Be encouraging and make learning enjoyable!`;
            
            const recentHistory = conversationHistory.length > 10 ? conversationHistory.slice(-10) : conversationHistory;

            const contents = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: "Hello! I'm your English conversation tutor. I'm excited to help you practice English conversation! Let's start with something simple - how are you feeling today?" }] },
                ...recentHistory,
                { role: 'user', parts: [{ text: message }] }
            ];

            const result = await model.generateContent({
                contents: contents
            });

            thinkingIndicator.remove();

            const response = await result.response;
            const aiResponse = response.text();

            const formattedResponse = aiResponse.replace(/\\n/g, '<br>').replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
            addMessage(formattedResponse, 'ai');
            conversationHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
            saveConversationHistory(); // 会話履歴を保存
            speak(aiResponse);

        } catch (error) {
            thinkingIndicator?.remove();
            console.error('AI Response Error:', error);
            if (error.message.includes('API_KEY_INVALID')) {
                addMessage('APIキーが無効です。正しいGemini APIキーを設定してください。', 'ai');
            } else {
                addMessage(`エラーが発生しました: ${error.message}`, 'ai');
            }
        } finally {
            speakBtn.disabled = false;
            if (isConversationActive) recognition.start();
        }
    }

    function resetConversation() {
        isConversationActive = false;
        if (recognition) recognition.stop();
        if (synth.speaking) synth.cancel();
        
        // レベル別の会話履歴を読み込み
        loadConversationHistory();
        
        speakBtn.innerHTML = '会話を開始 <span class="icon">🎤</span>';
        speakBtn.classList.remove('is-speaking');
        speakBtn.disabled = !model;
    }

    if (recognition) {
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) { finalTranscript += event.results[i][0].transcript; }
            }
            if (finalTranscript) {
                recognition.stop();
                addMessage(finalTranscript, 'user');
                conversationHistory.push({ role: 'user', parts: [{ text: finalTranscript }] });
                saveConversationHistory(); // ユーザーメッセージも保存
                fetchAIResponse(finalTranscript);
            }
        };
        recognition.onend = () => {};
        recognition.onerror = (event) => { console.error('Speech recognition error:', event.error); if (event.error !== 'aborted') { resetConversation(); } };
    }

    speakBtn.addEventListener('click', () => {
        if (!model) {
            addMessage('APIキーを設定してください。', 'ai');
            return;
        }

        if (isConversationActive) {
            isConversationActive = false;
            recognition.stop();
            speakBtn.innerHTML = '会話を再開 <span class="icon">🎤</span>';
            speakBtn.classList.remove('is-speaking');
        } else {
            isConversationActive = true;
            speakBtn.innerHTML = '会話を一時停止 <span class="icon">⏸️</span>';
            speakBtn.classList.add('is-speaking');
            
            // 会話開始時にAIから挨拶を始める
            if (conversationHistory.length === 0) {
                fetchAIResponse("Let's start our conversation practice!");
            } else {
                recognition.start();
            }
        }
    });

    saveKeyBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('APIキーを入力してください。');
            return;
        }
        
        localStorage.setItem('gemini-api-key', apiKey);
        initializeGemini(apiKey);
        addMessage('APIキーが保存されました。会話を開始できます。', 'ai');
        resetConversation();
    });

    chatWindow.addEventListener('click', (event) => {
        const listenBtn = event.target.closest('.listen-btn-bubble');
        if (listenBtn) { speak(listenBtn.dataset.textToSpeak); }
    });

    levelSelect.addEventListener('change', resetConversation);

    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('現在のレベルの会話履歴をすべて削除しますか？')) {
            const level = levelSelect.value;
            localStorage.removeItem(`conversation-history-${level}`);
            conversationHistory = [];
            chatWindow.innerHTML = '';
            if (model) {
                addMessage("会話履歴がクリアされました。新しい会話を開始できます。", 'ai');
            }
        }
    });

    resetConversation();
});
