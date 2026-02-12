// chat.js
let currentUser = null;
let messageSubscription = null;
let userStatusSubscription = null;
let messagesContainer = document.getElementById('messagesContainer');
let messageInput = document.getElementById('messageInput');
let sendButton = document.getElementById('sendButton');
let typingTimeout = null;

// ========== INITIALIZATION ==========
async function initChat() {
    try {
        // ตรวจสอบการล็อกอิน
        currentUser = await checkUser();
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        // เก็บ reference ของ elements
        messagesContainer = document.getElementById('messagesContainer');
        messageInput = document.getElementById('messageInput');
        sendButton = document.getElementById('sendButton');

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
        
        // ตั้งค่า Mobile Keyboard Handler
        initMobileKeyboardHandler();
        
        console.log('✅ Chat initialized successfully');
    } catch (error) {
        console.error('❌ Chat initialization error:', error);
    }
}

// ========== MESSAGES ==========
async function loadMessages() {
    try {
        const messages = await getMessages(50);
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            messages.forEach(msg => displayMessage(msg));
            scrollToBottom();
        }
    } catch (error) {
        console.error('❌ Error loading messages:', error);
    }
}

function displayMessage(message) {
    try {
        if (!messagesContainer) return;
        
        const author = message.profiles?.display_name || message.profiles?.username || 'ผู้ใช้';
        const avatarUrl = message.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=667eea&color=fff`;
        const isOwnMessage = message.user_id === currentUser?.id;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwnMessage ? 'own-message' : ''}`;
        messageDiv.innerHTML = `
            <img src="${avatarUrl}" alt="${author}" class="message-avatar" 
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=667eea&color=fff'">
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
    } catch (error) {
        console.error('❌ Error displaying message:', error);
    }
}

// ========== REALTIME ==========
function setupRealtimeSubscriptions() {
    try {
        // รับข้อความใหม่
        if (messageSubscription) {
            messageSubscription.unsubscribe();
        }
        
        messageSubscription = subscribeToMessages((newMessage) => {
            displayMessage(newMessage);
        });
        
        // รับสถานะผู้ใช้
        if (userStatusSubscription) {
            userStatusSubscription.unsubscribe();
        }
        
        userStatusSubscription = subscribeToUserStatus((updatedProfile) => {
            updateUserStatusUI(updatedProfile);
        });
        
        console.log('✅ Realtime subscriptions setup complete');
    } catch (error) {
        console.error('❌ Error setting up subscriptions:', error);
    }
}

// ========== USER INTERFACE ==========
function displayUserInfo() {
    try {
        const userProfile = document.getElementById('userProfile');
        if (!userProfile) return;
        
        const username = currentUser.user_metadata?.display_name || 
                        currentUser.user_metadata?.username || 
                        'ผู้ใช้';
        
        userProfile.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=667eea&color=fff" 
                 alt="${username}" 
                 class="avatar">
            <span class="username">${username}</span>
        `;
    } catch (error) {
        console.error('❌ Error displaying user info:', error);
    }
}

async function loadOnlineUsers() {
    try {
        const onlineUsers = await getOnlineUsers();
        const usersList = document.getElementById('onlineUsersList');
        const totalUsers = document.getElementById('totalUsers');
        
        if (usersList) {
            usersList.innerHTML = onlineUsers.map(user => `
                <div class="online-user">
                    <img src="${user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name || user.username)}&background=667eea&color=fff`}" 
                         alt="${user.display_name || user.username}" 
                         class="user-avatar">
                    <span class="user-name">${user.display_name || user.username}</span>
                    <span class="online-dot"></span>
                </div>
            `).join('');
        }
        
        if (totalUsers) {
            totalUsers.textContent = onlineUsers.length;
        }
    } catch (error) {
        console.error('❌ Error loading online users:', error);
    }
}

function updateUserStatusUI(profile) {
    // อัปเดตสถานะผู้ใช้แบบ realtime
    loadOnlineUsers();
}

// ========== MESSAGE INPUT ==========
function setupEventListeners() {
    try {
        // ส่งข้อความ
        if (sendButton) {
            sendButton.addEventListener('click', sendMessageHandler);
        }
        
        // กด Enter เพื่อส่ง
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessageHandler();
                }
            });
            
            // นับจำนวนตัวอักษร
            messageInput.addEventListener('input', handleMessageInput);
        }
        
        console.log('✅ Event listeners setup complete');
    } catch (error) {
        console.error('❌ Error setting up event listeners:', error);
    }
}

function handleMessageInput() {
    try {
        const count = messageInput.value.length;
        const charCount = document.getElementById('charCount');
        if (charCount) {
            charCount.textContent = `${count}/500`;
        }
        
        if (count > 500) {
            messageInput.value = messageInput.value.slice(0, 500);
        }
        
        // แสดงสถานะกำลังพิมพ์
        if (count > 0) {
            emitTyping(true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => emitTyping(false), 1000);
        }
    } catch (error) {
        console.error('❌ Error handling message input:', error);
    }
}

async function sendMessageHandler() {
    try {
        const message = messageInput.value.trim();
        
        if (message) {
            await sendMessage(message);
            messageInput.value = '';
            
            const charCount = document.getElementById('charCount');
            if (charCount) {
                charCount.textContent = '0/500';
            }
            
            // หยุดสถานะกำลังพิมพ์
            emitTyping(false);
            clearTimeout(typingTimeout);
        }
    } catch (error) {
        console.error('❌ Error sending message:', error);
    }
}

// ========== MOBILE KEYBOARD HANDLER ==========
function initMobileKeyboardHandler() {
    // ตรวจสอบว่าเป็นมือถือหรือไม่
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    
    console.log('📱 Mobile device detected, initializing keyboard handler');
    
    let originalViewportHeight = window.innerHeight;
    let isKeyboardOpen = false;
    
    function handleResize() {
        const currentHeight = window.innerHeight;
        const heightDiff = originalViewportHeight - currentHeight;
        
        // ถ้า height ลดลงมากกว่า 150px แสดงว่า keyboard เปิด
        if (heightDiff > 150 && !isKeyboardOpen) {
            isKeyboardOpen = true;
            document.body.classList.add('keyboard-open');
            
            // เลื่อน input ให้เห็น
            setTimeout(() => {
                if (messageInput) {
                    messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                // เลื่อนข้อความล่าสุดให้เห็น
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 300);
        } 
        // ถ้า height กลับมาใกล้เคียงเดิม แสดงว่า keyboard ปิด
        else if (heightDiff < 50 && isKeyboardOpen) {
            isKeyboardOpen = false;
            document.body.classList.remove('keyboard-open');
        }
    }
    
    window.addEventListener('resize', handleResize);
    
    // จัดการ focus บน input
    if (messageInput) {
        messageInput.addEventListener('focus', () => {
            setTimeout(() => {
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 300);
        });
    }
    
    // ป้องกันการ zoom เมื่อ focus input บน iOS
    document.addEventListener('touchstart', function(e) {
        if (e.target.nodeName === 'TEXTAREA' || e.target.nodeName === 'INPUT') {
            e.target.style.fontSize = '16px';
        }
    });
    
    // เพิ่มปุ่มปิด sidebar บนมือถือ
    addMobileMenuButton();
}

function addMobileMenuButton() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    
    const headerLeft = document.querySelector('.chat-header-left');
    if (!headerLeft) return;
    
    // เช็คว่ามีปุ่มเมนูอยู่แล้วหรือไม่
    if (document.querySelector('.mobile-menu-btn')) return;
    
    const menuBtn = document.createElement('span');
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.innerHTML = '☰';
    menuBtn.style.cssText = `
        font-size: 24px;
        margin-right: 12px;
        cursor: pointer;
        display: inline-block;
    `;
    
    menuBtn.onclick = toggleMobileSidebar;
    
    headerLeft.insertBefore(menuBtn, headerLeft.firstChild);
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.chat-sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!sidebar) return;
    
    sidebar.classList.toggle('active');
    
    if (!overlay) {
        // สร้าง overlay ถ้ายังไม่มี
        const newOverlay = document.createElement('div');
        newOverlay.id = 'sidebarOverlay';
        newOverlay.className = 'sidebar-overlay';
        newOverlay.onclick = closeMobileSidebar;
        document.body.appendChild(newOverlay);
        sidebar.classList.add('active');
    } else {
        overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
    }
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.chat-sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar) {
        sidebar.classList.remove('active');
    }
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ========== UTILITIES ==========
function formatTime(timestamp) {
    try {
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
    } catch (error) {
        return '';
    }
}

function linkify(text) {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, url => 
            `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`
        );
    } catch (error) {
        return text;
    }
}

function scrollToBottom() {
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// ========== CLEANUP ==========
window.addEventListener('beforeunload', async () => {
    try {
        if (messageSubscription) {
            messageSubscription.unsubscribe();
        }
        if (userStatusSubscription) {
            userStatusSubscription.unsubscribe();
        }
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
});

// ========== INITIALIZE ==========
// เรียกใช้เมื่อ DOM พร้อม
document.addEventListener('DOMContentLoaded', () => {
    initChat();
});
