// chat.js
let currentUser = null;
let messageSubscription = null;
let userStatusSubscription = null;
let messagesContainer = document.getElementById('messagesContainer');
let messageInput = document.getElementById('messageInput');
let sendButton = document.getElementById('sendButton');
let typingTimeout = null;

// ========== CONSTANTS ==========
const PUBLIC_ROOM_ID = '00000000-0000-0000-0000-000000000000'; // ห้องสาธารณะกลาง

// ========== INITIALIZATION ==========
async function initChat() {
    try {
        console.log('🚀 Initializing chat...');
        
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

        // ตรวจสอบและสร้าง public room
        await initPublicRoom();
        
        // เข้าร่วม public room อัตโนมัติ
        await joinPublicRoom();
        
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

// ========== PUBLIC ROOM MANAGEMENT ==========
async function initPublicRoom() {
    try {
        // ตรวจสอบว่ามี public room หรือยัง
        const { data: existingRoom, error } = await supabaseClient
            .from('rooms')
            .select('id')
            .eq('id', PUBLIC_ROOM_ID)
            .maybeSingle();
            
        if (error) throw error;
        
        if (!existingRoom) {
            // สร้าง public room ถ้ายังไม่มี
            const { error: insertError } = await supabaseClient
                .from('rooms')
                .insert([
                    {
                        id: PUBLIC_ROOM_ID,
                        name: 'ห้องแชทสาธารณะ',
                        description: 'ห้องแชทหลักสำหรับทุกคน',
                        room_type: 'public',
                        created_at: new Date().toISOString()
                    }
                ]);
                
            if (insertError) throw insertError;
            console.log('✅ Created public room');
        } else {
            console.log('✅ Public room already exists');
        }
    } catch (error) {
        console.error('❌ Error initializing public room:', error);
    }
}

async function joinPublicRoom() {
    try {
        if (!currentUser) return;
        
        // ตรวจสอบว่าเป็นสมาชิกอยู่แล้วหรือไม่
        const { data: existingMember, error: checkError } = await supabaseClient
            .from('room_members')
            .select('*')
            .eq('room_id', PUBLIC_ROOM_ID)
            .eq('user_id', currentUser.id)
            .maybeSingle();
            
        if (checkError) throw checkError;
        
        if (!existingMember) {
            // เข้าร่วม public room
            const { error: joinError } = await supabaseClient
                .from('room_members')
                .insert([
                    {
                        room_id: PUBLIC_ROOM_ID,
                        user_id: currentUser.id,
                        role: 'member',
                        joined_at: new Date().toISOString()
                    }
                ]);
                
            if (joinError) throw joinError;
            console.log('✅ Joined public room');
        }
    } catch (error) {
        console.error('❌ Error joining public room:', error);
    }
}

// ========== MESSAGES ==========
async function loadMessages() {
    try {
        console.log('📨 Loading messages from public room...');
        
        // โหลดเฉพาะข้อความจาก public room
        const { data: messages, error } = await supabaseClient
            .from('messages')
            .select(`
                id,
                message,
                created_at,
                user_id,
                room_id,
                profiles:user_id (
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .eq('room_id', PUBLIC_ROOM_ID)  // สำคัญ! โหลดเฉพาะ public room
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) throw error;
        
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            messages.forEach(msg => displayMessage(msg));
            scrollToBottom();
            console.log(`✅ Loaded ${messages.length} messages`);
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

async function sendMessageHandler() {
    try {
        const message = messageInput.value.trim();
        
        if (message) {
            console.log('📤 Sending message to public room...');
            
            // ส่งข้อความไปยัง public room
            const { data, error } = await supabaseClient
                .from('messages')
                .insert([
                    {
                        user_id: currentUser.id,
                        room_id: PUBLIC_ROOM_ID,  // สำคัญ! ส่งไป public room
                        message: message,
                        created_at: new Date().toISOString()
                    }
                ])
                .select();

            if (error) throw error;
            
            messageInput.value = '';
            
            const charCount = document.getElementById('charCount');
            if (charCount) {
                charCount.textContent = '0/500';
            }
            
            // หยุดสถานะกำลังพิมพ์
            emitTyping(false);
            clearTimeout(typingTimeout);
            
            console.log('✅ Message sent');
        }
    } catch (error) {
        console.error('❌ Error sending message:', error);
        alert('ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
}

// ========== REALTIME ==========
function setupRealtimeSubscriptions() {
    try {
        console.log('📡 Setting up realtime subscriptions...');
        
        // รับข้อความใหม่ - เฉพาะ public room
        if (messageSubscription) {
            messageSubscription.unsubscribe();
        }
        
        messageSubscription = supabaseClient
            .channel('public-room-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${PUBLIC_ROOM_ID}`  // สำคัญ! เฉพาะ public room
                },
                async (payload) => {
                    console.log('📨 New message received');
                    
                    // ดึงข้อมูล profile
                    const { data: profile } = await supabaseClient
                        .from('profiles')
                        .select('username, display_name, avatar_url')
                        .eq('id', payload.new.user_id)
                        .single();
                    
                    displayMessage({
                        ...payload.new,
                        profiles: profile
                    });
                }
            )
            .subscribe((status) => {
                console.log('📡 Realtime status:', status);
            });
        
        // รับสถานะผู้ใช้
        if (userStatusSubscription) {
            userStatusSubscription.unsubscribe();
        }
        
        userStatusSubscription = supabaseClient
            .channel('public-user-status')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles'
                },
                () => {
                    loadOnlineUsers();
                }
            )
            .subscribe();
        
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
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('is_online', true)
            .limit(20);
            
        if (error) throw error;
        
        // กรองไม่ให้ username ซ้ำ
        const uniqueUsers = [];
        const seen = new Set();
        
        data.forEach(user => {
            if (!seen.has(user.username)) {
                seen.add(user.username);
                uniqueUsers.push(user);
            }
        });
        
        const usersList = document.getElementById('onlineUsersList');
        const totalUsers = document.getElementById('totalUsers');
        
        if (usersList) {
            usersList.innerHTML = uniqueUsers.map(user => `
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
            totalUsers.textContent = uniqueUsers.length;
        }
    } catch (error) {
        console.error('❌ Error loading online users:', error);
    }
}

function updateUserStatusUI() {
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

// ========== MOBILE KEYBOARD HANDLER ==========
function initMobileKeyboardHandler() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    
    console.log('📱 Mobile device detected, initializing keyboard handler');
    
    let originalViewportHeight = window.innerHeight;
    let isKeyboardOpen = false;
    
    function handleResize() {
        const currentHeight = window.innerHeight;
        const heightDiff = originalViewportHeight - currentHeight;
        
        if (heightDiff > 150 && !isKeyboardOpen) {
            isKeyboardOpen = true;
            document.body.classList.add('keyboard-open');
            
            setTimeout(() => {
                if (messageInput) {
                    messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 300);
        } 
        else if (heightDiff < 50 && isKeyboardOpen) {
            isKeyboardOpen = false;
            document.body.classList.remove('keyboard-open');
        }
    }
    
    window.addEventListener('resize', handleResize);
    
    if (messageInput) {
        messageInput.addEventListener('focus', () => {
            setTimeout(() => {
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 300);
        });
    }
    
    document.addEventListener('touchstart', function(e) {
        if (e.target.nodeName === 'TEXTAREA' || e.target.nodeName === 'INPUT') {
            e.target.style.fontSize = '16px';
        }
    });
    
    addMobileMenuButton();
}

function addMobileMenuButton() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    
    const headerLeft = document.querySelector('.chat-header-left');
    if (!headerLeft) return;
    
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
        
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('th-TH', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        if (diff < 86400000 * 2) {
            return 'เมื่อวาน';
        }
        
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
document.addEventListener('DOMContentLoaded', () => {
    initChat();
});
