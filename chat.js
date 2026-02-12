// chat.js
let currentUser = null;
let messageSubscription = null;
let userStatusSubscription = null;
let messagesContainer = document.getElementById('messagesContainer');
let messageInput = document.getElementById('messageInput');
let sendButton = document.getElementById('sendButton');

// ========== INITIALIZATION ==========
async function initChat() {
    // ตรวจสอบการล็อกอิน
    currentUser = await checkUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // โหลดประวัติข้อความ
    await loadMessages();
    
    // แสดงข้อมูลผู้ใช้
    displayUserInfo();
    
    // ตั้งค่า Realtime subscriptions
    setupRealtimeSubscriptions();
    
    // ตั้งค่า Event Listeners
    setupEventListeners();
    
    // โหลดรายชื่อผู้ใช้ออนไลน์
    await loadOnlineUsers();
}

// ========== MESSAGES ==========
async function loadMessages() {
    const messages = await getMessages(50);
    messagesContainer.innerHTML = '';
    
    messages.forEach(msg => {
        displayMessage(msg);
    });
    
    scrollToBottom();
}

function displayMessage(message) {
    const template = document.getElementById('messageTemplate');
    const messageElement = template.content.cloneNode(true);
    
    const author = message.profiles?.display_name || message.profiles?.username || 'ผู้ใช้';
    const avatarUrl = message.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${author}`;
    
    // สร้าง HTML สำหรับข้อความ
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.user_id === currentUser?.id ? 'own-message' : ''}`;
    messageDiv.innerHTML = `
        <img src="${avatarUrl}" alt="${author}" class="message-avatar">
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${author}</span>
                <span class="message-time">${formatTime(message.created_at)}</span>
            </div>
            <div class="message-body">${linkify(message.message)}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// ========== REALTIME ==========
function setupRealtimeSubscriptions() {
    // รับข้อความใหม่
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }
    
    messageSubscription = subscribeToMessages((newMessage) => {
        displayMessage(newMessage);
    });
    
    // รับสถานะผู้ใช้
    userStatusSubscription = subscribeToUserStatus((updatedProfile) => {
        updateUserStatusUI(updatedProfile);
    });
}

// ========== USER INTERFACE ==========
function displayUserInfo() {
    const userProfile = document.getElementById('userProfile');
    const username = currentUser.user_metadata?.display_name || 
                    currentUser.user_metadata?.username || 
                    'ผู้ใช้';
    
    userProfile.innerHTML = `
        <img src="https://ui-avatars.com/api/?name=${username}&background=667eea&color=fff" 
             alt="${username}" 
             class="avatar">
        <span class="username">${username}</span>
    `;
}

async function loadOnlineUsers() {
    const onlineUsers = await getOnlineUsers();
    const usersList = document.getElementById('onlineUsersList');
    const totalUsers = document.getElementById('totalUsers');
    
    usersList.innerHTML = onlineUsers.map(user => `
        <div class="online-user">
            <img src="${user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name || user.username}`}" 
                 alt="${user.display_name || user.username}" 
                 class="user-avatar">
            <span class="user-name">${user.display_name || user.username}</span>
            <span class="online-dot"></span>
        </div>
    `).join('');
    
    if (totalUsers) {
        totalUsers.textContent = onlineUsers.length;
    }
}

function updateUserStatusUI(profile) {
    const usersList = document.getElementById('onlineUsersList');
    // อัปเดตสถานะผู้ใช้แบบ realtime
    loadOnlineUsers();
}

// ========== MESSAGE INPUT ==========
function setupEventListeners() {
    // ส่งข้อความ
    sendButton.addEventListener('click', sendMessageHandler);
    
    // กด Enter เพื่อส่ง
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessageHandler();
        }
    });
    
    // นับจำนวนตัวอักษร
    messageInput.addEventListener('input', () => {
        const count = messageInput.value.length;
        document.getElementById('charCount').textContent = `${count}/500`;
        
        if (count > 500) {
            messageInput.value = messageInput.value.slice(0, 500);
        }
        
        // แสดงสถานะกำลังพิมพ์
        if (count > 0) {
            emitTyping(true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => emitTyping(false), 1000);
        }
    });
}

async function sendMessageHandler() {
    const message = messageInput.value.trim();
    
    if (message) {
        await sendMessage(message);
        messageInput.value = '';
        document.getElementById('charCount').textContent = '0/500';
        
        // หยุดสถานะกำลังพิมพ์
        emitTyping(false);
        clearTimeout(typingTimeout);
    }
}

// ========== UTILITIES ==========
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // ถ้าเป็นวันนี้ แสดงเวลา
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // ถ้าเป็นเมื่อวาน แสดง "เมื่อวาน"
    if (diff < 86400000 * 2) {
        return 'เมื่อวาน';
    }
    
    // ถ้าเกิน 2 วัน แสดงวันที่
    return date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => 
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ========== CLEANUP ==========
window.addEventListener('beforeunload', async () => {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }
    if (userStatusSubscription) {
        userStatusSubscription.unsubscribe();
    }
});

// เริ่มต้นแอพ
initChat();