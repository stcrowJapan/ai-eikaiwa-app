document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const speakBtn = document.getElementById('speak-btn');
    const levelSelect = document.getElementById('level-select');

    let isConversationActive = false;
    let conversationHistory = [];

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
            listenBtn.dataset.textToSpeak = text; // Store original text with markdown/HTML
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
        utterance.onstart = () => {};
        utterance.onend = () => {
            if (isConversationActive) recognition.start();
        };
        utterance.onerror = (event) => {
            console.error('SpeechSynthesis Error', event);
            if (isConversationActive) recognition.start();
        };
        synth.speak(utterance);
    }

    async function fetchAIResponse(message) {
        const level = levelSelect.value;
        const thinkingIndicator = addMessage("<i>Thinking...</i>", 'ai');
        speakBtn.disabled = true;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: conversationHistory, message, level }),
            });

            thinkingIndicator.remove();

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'An unknown server error occurred.');
            }

            const data = await res.json();
            const aiResponse = data.response;

            const formattedResponse = aiResponse.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            addMessage(formattedResponse, 'ai');
            conversationHistory.push({ role: 'model', parts: [{ text: aiResponse }] });

        } catch (error) {
            thinkingIndicator?.remove();
            addMessage(`Sorry, an error occurred: ${error.message}`, 'ai');
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
        addMessage("Please select a level and click 'Start Conversation' to begin.", 'ai');
        speakBtn.innerHTML = '会話を開始 <span class=
