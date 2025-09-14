import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const speakBtn = document.getElementById('speak-btn');
    const levelSelect = document.getElementById('level-select');
    const apiKeyInput = document.getElementById('api-key');
    const saveKeyBtn = document.getElementById('save-key');

    let isConversationActive = false;
    let conversationHistory = [];
    let genAI = null;
    let model = null;

    // Load saved API key
    const savedApiKey = localStorage.getItem('gemini-api-key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        initializeGemini(savedApiKey);
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
                    temperature: 0.7,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 1024,
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
            const levelPrompts = {
                'eiken3': 'Eiken Grade 3 (junior high school level)',
                'eiken-pre2': 'Eiken Pre-2nd Grade (high school intermediate level)', 
                'eiken2': 'Eiken 2nd Grade (high school advanced level)'
            };
            
            const systemPrompt = `You are a friendly and encouraging English conversation tutor. Your student is practicing for ${levelPrompts[level]}. 

IMPORTANT INSTRUCTIONS:
1. **Maintain Natural Conversation**: Have a flowing, natural conversation about everyday topics appropriate for ${levelPrompts[level]}. Don't just ask random questions - build on what the student says.

2. **Provide Japanese Hints**: When the student makes grammatical errors or uses unnatural expressions, ALWAYS provide corrections in this format:
   - First, give a natural English response to their message
   - Then add a new paragraph with: "💡 ヒント: [Japanese explanation of the error and correct usage]"
   
3. **Keep Conversation Flowing**: Always end with a follow-up question or comment to continue the conversation naturally. Topics should be age-appropriate and interesting.

4. **Be Encouraging**: Praise good usage and be supportive of mistakes. Learning English should be enjoyable.

5. **Use Appropriate Level**: 
   - Grade 3: Simple present/past tense, basic vocabulary, everyday situations
   - Pre-2: Present perfect, conditionals, hobbies, school life, travel
   - Grade 2: Complex grammar, abstract topics, opinions, future plans

Let's have a natural conversation! Start by greeting the student and asking about their day or interests.`;
            
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
        conversationHistory = [];
        chatWindow.innerHTML = '';
        
        if (model) {
            addMessage("レベルを選択して「会話を開始」ボタンを押すと、AIとの英会話練習が始まります。間違いがあれば日本語でヒントをくれます！", 'ai');
        } else {
            addMessage("APIキーを入力してSaveボタンを押してから会話を開始してください。", 'ai');
        }
        
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

    resetConversation();
});
