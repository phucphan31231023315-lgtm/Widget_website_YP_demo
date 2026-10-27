// ============================================
//   Chatbot Widget - N8N Integration
//   Webhook: https://phanphuc.app.n8n.cloud/webhook/6e2b9f1f-f157-4b20-8026-4a6bf0f47146/chat
// ============================================

// Gọi qua proxy local để tránh CORS (server.js sẽ forward đến N8N)
const WEBHOOK_URL = '/api/chat';

// Generate a unique session ID for this user session
const SESSION_ID = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// ===== DOM References =====
const toggleBtn   = document.getElementById('chat-toggle-btn');
const chatWindow  = document.getElementById('chat-window');
const closeBtn    = document.getElementById('close-chat');
const sendBtn     = document.getElementById('send-btn');
const chatInput   = document.getElementById('chat-input');
const messagesDiv = document.getElementById('chat-messages');
const notifBadge  = document.querySelector('.chat-notif');

let isOpen      = false;
let isWaiting   = false;
let hasGreeted  = false;

// ===== Toggle Chat Window =====
toggleBtn.addEventListener('click', () => {
  isOpen = !isOpen;
  chatWindow.classList.toggle('active', isOpen);
  toggleBtn.querySelector('.btn-icon').textContent = isOpen ? '✕' : '💬';

  if (isOpen) {
    notifBadge.style.display = 'none';
    if (!hasGreeted) {
      hasGreeted = true;
      setTimeout(() => addBotMessage(
        '👋 Xin chào! Tôi là trợ lý tư vấn bao bì của <strong>Yến Phát</strong>.\n\nTôi có thể giúp bạn tìm sản phẩm bao bì phù hợp, báo giá, hoặc giải đáp mọi thắc mắc. Bạn cần hỗ trợ gì? 😊'
      ), 600);
    }
    setTimeout(() => chatInput.focus(), 350);
  } else {
    toggleBtn.querySelector('.btn-icon').textContent = '💬';
  }
});

closeBtn.addEventListener('click', () => {
  isOpen = false;
  chatWindow.classList.remove('active');
  toggleBtn.querySelector('.btn-icon').textContent = '💬';
});

// ===== Quick Replies =====
document.querySelectorAll('.quick-reply').forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.dataset.msg;
    chatInput.value = text;
    sendMessage();
  });
});

// ===== Send Message =====
sendBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
});

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isWaiting) return;

  // Add user message
  addUserMessage(text);
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Show typing indicator
  const typingEl = showTyping();
  isWaiting = true;
  sendBtn.disabled = true;

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatInput: text,
        sessionId: SESSION_ID
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    typingEl.remove();

    // N8N chat webhook returns { output: "..." }
    const botReply = data.output || data.text || data.message || data.reply
      || (Array.isArray(data) && (data[0]?.output || data[0]?.text))
      || 'Cảm ơn bạn đã nhắn tin! Tôi sẽ phản hồi sớm nhất có thể.';

    addBotMessage(botReply);

  } catch (err) {
    typingEl.remove();
    console.error('Chatbot error:', err);
    addBotMessage('⚠️ Xin lỗi, hiện tại tôi đang gặp sự cố kết nối. Vui lòng thử lại sau hoặc liên hệ trực tiếp qua số điện thoại <strong>0909 123 456</strong>.');
  } finally {
    isWaiting = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// ===== Message Helpers =====
function addUserMessage(text) {
  const msg = createMsgEl('user', escapeHtml(text));
  messagesDiv.appendChild(msg);
  scrollToBottom();
}

function addBotMessage(html) {
  const msg = createMsgEl('bot', html);
  messagesDiv.appendChild(msg);
  scrollToBottom();
}

function createMsgEl(type, content) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${type}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  // Convert newlines to <br> for bot messages
  if (type === 'bot') {
    bubble.innerHTML = content.replace(/\n/g, '<br>');
  } else {
    bubble.textContent = content;
  }

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = getCurrentTime();

  wrap.appendChild(bubble);
  wrap.appendChild(time);
  return wrap;
}

function showTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'msg bot';
  wrap.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  messagesDiv.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function scrollToBottom() {
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== Scroll to Top Button =====
const scrollTopBtn = document.getElementById('scroll-top');
window.addEventListener('scroll', () => {
  scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
});
scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ===== Navbar shadow on scroll =====
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  navbar.style.boxShadow = window.scrollY > 20 ? '0 4px 20px rgba(0,0,0,0.10)' : '';
});
