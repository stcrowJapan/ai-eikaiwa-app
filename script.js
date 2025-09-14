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
            const systemPrompt = `English tutor for Eiken practice. Be friendly and encouraging. If student makes errors, respond naturally then add "💡 ヒント:" with Japanese correction. Ask follow-up questions.`;
            
            const recentHistory = conversationHistory.length > 6 ? conversationHistory.slice(-6) : conversationHistory;

            const contents = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: "Okay, I understand. I'm ready to start the conversation as a friendly English tutor." }] },
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
            addMessage("Please select a level and click 'Start Conversation' to begin.", 'ai');
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
            recognition.start();
            speakBtn.innerHTML = '会話を一時停止 <span class="icon">⏸️</span>';
            speakBtn.classList.add('is-speaking');
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