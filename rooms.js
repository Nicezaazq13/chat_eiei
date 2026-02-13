// rooms.js
let currentUser = null;
let currentRoom = null;
let currentRoomId = null;
let messageSubscription = null;
let messagesContainer = document.getElementById('messagesContainer');
let messageInput = document.getElementById('messageInput');
let sendButton = document.getElementById('sendButton');
let typingTimeout = null;

const PUBLIC_ROOM_ID = '00000000-0000-0000-0000-000000000000';

// ========== INITIALIZATION ==========
async function initRooms() {
    try {
        console.log('🚀 Initializing rooms...');
        
        currentUser = await checkUser();
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        await initPublicRoom();
        await loadRooms();
        await loadOnlineUsers();
        
        setupEventListeners();
        initMobileHandler();
        
        console.log('✅ Rooms initialized');
    } catch (error) {
        console.error('❌ Init error:', error);
    }
}

// ========== ROOM MANAGEMENT ==========
async function initPublicRoom() {
    try {
        const { data: existingRoom } = await supabaseClient
            .from('rooms')
            .select('id')
            .eq('id', PUBLIC_ROOM_ID)
            .maybeSingle();
            
        if (!existingRoom) {
            await supabaseClient
                .from('rooms')
                .insert([{
                    id: PUBLIC_ROOM_ID,
                    name: 'ห้องแชทสาธารณะ',
                    description: 'ห้องแชทหลักสำหรับทุกคน',
                    room_type: 'public',
                    created_at: new Date().toISOString()
                }]);
            console.log('✅ Created public room');
        }
    } catch (error) {
        console.error('❌ Error init public room:', error);
    }
}

async function loadRooms(filter = 'all') {
    try {
        let query = supabaseClient
            .from('rooms')
            .select(`
                *,
                owner:owner_id (
                    username,
                    display_name
                ),
                room_members (
                    user_id,
                    role
                )
            `)
            .order('created_at', { ascending: false });
        
        if (filter === 'public') {
            query = query.eq('room_type', 'public');
        } else if (filter === 'private') {
            query = query.eq('room_type', 'private');
        }
        
        const { data: rooms, error } = await query;
        if (error) throw error;
        
        displayRooms(rooms);
    } catch (error) {
        console.error('❌ Error loading rooms:', error);
    }
}

function displayRooms(rooms) {
    const roomList = document.getElementById('roomList');
    if (!roomList) return;
    
    roomList.innerHTML = rooms.map(room => {
        const isOwner = room.owner_id === currentUser?.id;
        const memberCount = room.room_members?.length || 0;
        const isActive = currentRoomId === room.id;
        
        return `
            <div class="room-item ${isActive ? 'active' : ''}" onclick="selectRoom('${room.id}')">
                <div class="room-header">
                    <span class="room-name">
                        ${room.room_type === 'private' ? '🔒' : '🌍'} ${room.name}
                    </span>
                    <span class="room-type-badge">
                        ${room.room_type === 'private' ? 'ส่วนตัว' : 'สาธารณะ'}
                    </span>
                </div>
                <div class="room-meta">
                    <span>👤 ${room.owner?.display_name || 'ไม่มีเจ้าของ'}</span>
                    <span>👥 ${memberCount} คน</span>
                    ${isOwner ? '<span style="color: #48bb78;">👑 เจ้าของ</span>' : ''}
                </div>
                ${room.description ? `<small style="color: #718096;">${room.description}</small>` : ''}
            </div>
        `;
    }).join('');
}

async function selectRoom(roomId) {
    try {
        console.log('📁 Selecting room:', roomId);
        
        const { data: room, error } = await supabaseClient
            .from('rooms')
            .select(`
                *,
                owner:owner_id (
                    username,
                    display_name
                )
            `)
            .eq('id', roomId)
            .single();
            
        if (error) throw error;
        
        // ตรวจสอบสิทธิ์เข้าห้องส่วนตัว
        if (room.room_type === 'private') {
            const { data: member } = await supabaseClient
                .from('room_members')
                .select('*')
                .eq('room_id', roomId)
                .eq('user_id', currentUser.id)
                .maybeSingle();
                
            if (!member && room.owner_id !== currentUser.id) {
                showJoinPrivateModal(room);
                return;
            }
        }
        
        await joinRoom(roomId);
        
    } catch (error) {
        console.error('❌ Error selecting room:', error);
    }
}

async function joinRoom(roomId) {
    try {
        // ตรวจสอบว่าเป็นสมาชิกหรือยัง
        const { data: existingMember } = await supabaseClient
            .from('room_members')
            .select('*')
            .eq('room_id', roomId)
            .eq('user_id', currentUser.id)
            .maybeSingle();
            
        if (!existingMember) {
            await supabaseClient
                .from('room_members')
                .insert([{
                    room_id: roomId,
                    user_id: currentUser.id,
                    role: 'member',
                    joined_at: new Date().toISOString()
                }]);
        }
        
        // โหลดข้อมูลห้อง
        const { data: room } = await supabaseClient
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();
            
        currentRoom = room;
        currentRoomId = roomId;
        
        // อัปเดต UI
        document.getElementById('currentRoomIcon').textContent = room.room_type === 'private' ? '🔒' : '💬';
        document.getElementById('currentRoomName').textContent = room.name;
        document.getElementById('currentRoomDesc').textContent = room.description || 'ไม่มีคำอธิบาย';
        document.getElementById('messageInputArea').style.display = 'block';
        
        // โหลดข้อความ
        await loadRoomMessages(roomId);
        
        // ตั้งค่า Realtime
        setupRoomSubscription(roomId);
        
        // โหลดสมาชิก
        await loadRoomMembers(roomId);
        
        // อัปเดตรายการห้อง
        loadRooms();
        
        // ซ่อน sidebar มือถือ
        if (window.innerWidth <= 768) {
            document.getElementById('roomsSidebar').classList.remove('active');
        }
        
    } catch (error) {
        console.error('❌ Error joining room:', error);
    }
}

// ========== CREATE ROOM ==========
async function createRoom(event) {
    event.preventDefault();
    
    try {
        const name = document.getElementById('roomName').value;
        const description = document.getElementById('roomDescription').value;
        const roomType = document.getElementById('roomType').value;
        const password = document.getElementById('roomPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // ตรวจสอบรหัสผ่าน
        if (roomType === 'private') {
            if (!password) {
                alert('กรุณาตั้งรหัสผ่านสำหรับห้องส่วนตัว');
                return;
            }
            if (password !== confirmPassword) {
                alert('รหัสผ่านไม่ตรงกัน');
                return;
            }
            if (password.length < 4) {
                alert('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
                return;
            }
        }
        
        const { data: room, error } = await supabaseClient
            .from('rooms')
            .insert([{
                name: name,
                description: description,
                room_type: roomType,
                password: roomType === 'private' ? password : null,
                owner_id: currentUser.id,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
            
        if (error) throw error;
        
        // เพิ่มเจ้าของเป็นสมาชิก
        await supabaseClient
            .from('room_members')
            .insert([{
                room_id: room.id,
                user_id: currentUser.id,
                role: 'owner',
                joined_at: new Date().toISOString()
            }]);
        
        alert('✅ สร้างห้องสำเร็จ!');
        closeCreateRoomModal();
        await loadRooms();
        await selectRoom(room.id);
        
    } catch (error) {
        console.error('❌ Error creating room:', error);
        alert('เกิดข้อผิดพลาดในการสร้างห้อง');
    }
}

// ========== ROOM MEMBERS ==========
async function loadRoomMembers(roomId) {
    try {
        const { data: members, error } = await supabaseClient
            .from('room_members')
            .select(`
                user_id,
                role,
                joined_at,
                profiles:user_id (
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .eq('room_id', roomId);
            
        if (error) throw error;
        
        displayRoomMembers(members);
    } catch (error) {
        console.error('❌ Error loading members:', error);
    }
}

function displayRoomMembers(members) {
    const container = document.getElementById('membersContent');
    if (!container) return;
    
    const isOwner = currentRoom?.owner_id === currentUser.id;
    
    container.innerHTML = members.map(member => {
        const profile = member.profiles;
        const isCurrentUser = member.user_id === currentUser.id;
        const canKick = isOwner && !isCurrentUser && member.role !== 'owner';
        
        return `
            <div class="member-item">
                <img src="${profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.display_name || profile?.username}`}" 
                     alt="${profile?.display_name}" 
                     class="member-avatar">
                <div class="member-info">
                    <div class="member-name">
                        ${profile?.display_name || profile?.username}
                        ${isCurrentUser ? ' (คุณ)' : ''}
                    </div>
                    <div class="member-role">
                        ${member.role === 'owner' ? '👑 เจ้าของห้อง' : '👤 สมาชิก'}
                        • เข้าร่วม ${new Date(member.joined_at).toLocaleDateString('th-TH')}
                    </div>
                </div>
                ${canKick ? `
                    <button class="kick-btn" onclick="showKickModal('${member.user_id}', '${profile?.display_name || profile?.username}')">
                        เตะออก
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ========== KICK MEMBER ==========
let kickMemberId = null;

function showKickModal(userId, username) {
    kickMemberId = userId;
    document.getElementById('kickMemberName').textContent = `ต้องการเตะ "${username}" ออกจากห้อง?`;
    document.getElementById('kickMemberModal').classList.add('active');
}

function closeKickModal() {
    kickMemberId = null;
    document.getElementById('kickMemberModal').classList.remove('active');
}

async function confirmKickMember() {
    if (!kickMemberId || !currentRoomId) return;
    
    try {
        const { error } = await supabaseClient
            .from('room_members')
            .delete()
            .eq('room_id', currentRoomId)
            .eq('user_id', kickMemberId);
            
        if (error) throw error;
        
        alert('✅ เตะสมาชิกออกจากห้องแล้ว');
        closeKickModal();
        await loadRoomMembers(currentRoomId);
        
    } catch (error) {
        console.error('❌ Error kicking member:', error);
        alert('ไม่สามารถเตะสมาชิกได้');
    }
}

// ========== MESSAGES ==========
async function loadRoomMessages(roomId) {
    try {
        const { data: messages, error } = await supabaseClient
            .from('messages')
            .select(`
                *,
                profiles:user_id (
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(50);
            
        if (error) throw error;
        
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #a0aec0;">💬 ยังไม่มีข้อความ<br><small>เริ่มต้นแชทกันเลย!</small></div>';
        } else {
            messages.forEach(msg => displayMessage(msg));
        }
        
        scrollToBottom();
        
    } catch (error) {
        console.error('❌ Error loading messages:', error);
    }
}

function displayMessage(message) {
    if (!messagesContainer) return;
    
    const isOwnMessage = message.user_id === currentUser?.id;
    const author = message.profiles?.display_name || message.profiles?.username || 'ผู้ใช้';
    const avatarUrl = message.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=667eea&color=fff`;
    
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
}

async function sendMessageHandler() {
    const message = messageInput.value.trim();
    if (!message || !currentRoomId) return;
    
    try {
        const { error } = await supabaseClient
            .from('messages')
            .insert([{
                user_id: currentUser.id,
                room_id: currentRoomId,
                message: message,
                created_at: new Date().toISOString()
            }]);
            
        if (error) throw error;
        
        messageInput.value = '';
        document.getElementById('charCount').textContent = '0/500';
        
        emitTyping(false);
        clearTimeout(window.typingTimeout);
        
    } catch (error) {
        console.error('❌ Error sending message:', error);
    }
}

// ========== REALTIME ==========
function setupRoomSubscription(roomId) {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }
    
    messageSubscription = supabaseClient
        .channel(`room-${roomId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`
            },
            async (payload) => {
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
        .subscribe();
}

// ========== ONLINE USERS ==========
async function loadOnlineUsers() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('is_online', true)
            .limit(30);
            
        if (error) throw error;
        
        const userMap = new Map();
        data.forEach(user => {
            if (!userMap.has(user.username)) {
                userMap.set(user.username, user);
            }
        });
        
        const uniqueUsers = Array.from(userMap.values());
        
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

// ========== MODAL CONTROLS ==========
function showCreateRoomModal() {
    document.getElementById('createRoomModal').classList.add('active');
}

function closeCreateRoomModal() {
    document.getElementById('createRoomModal').classList.remove('active');
    document.getElementById('createRoomForm').reset();
    document.getElementById('passwordField').classList.remove('show');
}

function togglePasswordField() {
    const roomType = document.getElementById('roomType').value;
    const passwordField = document.getElementById('passwordField');
    passwordField.classList.toggle('show', roomType === 'private');
}

function showJoinPrivateModal(room) {
    document.getElementById('joinRoomName').textContent = `ห้อง: ${room.name}`;
    document.getElementById('joinPrivateRoomModal').dataset.roomId = room.id;
    document.getElementById('joinPrivateRoomModal').classList.add('active');
}

function closeJoinPrivateModal() {
    document.getElementById('joinPrivateRoomModal').classList.remove('active');
    document.getElementById('joinRoomPassword').value = '';
}

async function confirmJoinPrivateRoom() {
    const roomId = document.getElementById('joinPrivateRoomModal').dataset.roomId;
    const password = document.getElementById('joinRoomPassword').value;
    
    try {
        const { data: room, error } = await supabaseClient
            .from('rooms')
            .select('password')
            .eq('id', roomId)
            .single();
            
        if (error) throw error;
        
        if (room.password !== password) {
            alert('❌ รหัสผ่านไม่ถูกต้อง');
            return;
        }
        
        await joinRoom(roomId);
        closeJoinPrivateModal();
        
    } catch (error) {
        console.error('❌ Error joining private room:', error);
        alert('ไม่สามารถเข้าร่วมห้องได้');
    }
}

// ========== UI CONTROLS ==========
function toggleSidebar() {
    document.getElementById('roomsSidebar').classList.toggle('active');
}

function toggleMembersList() {
    document.getElementById('membersList').classList.toggle('active');
}

function filterRooms(filter) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadRooms(filter);
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    if (sendButton) {
        sendButton.addEventListener('click', sendMessageHandler);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessageHandler();
            }
        });
        
        messageInput.addEventListener('input', () => {
            const count = messageInput.value.length;
            const charCount = document.getElementById('charCount');
            if (charCount) {
                charCount.textContent = `${count}/500`;
            }
            
            if (count > 500) {
                messageInput.value = messageInput.value.slice(0, 500);
            }
            
            if (count > 0) {
                emitTyping(true);
                clearTimeout(window.typingTimeout);
                window.typingTimeout = setTimeout(() => emitTyping(false), 1000);
            }
        });
    }
    
    document.getElementById('createRoomForm').addEventListener('submit', createRoom);
}

// ========== MOBILE HANDLER ==========
function initMobileHandler() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    
    document.querySelector('.mobile-menu-btn').style.display = 'inline-block';
    
    let originalHeight = window.innerHeight;
    
    window.addEventListener('resize', () => {
        const newHeight = window.innerHeight;
        if (originalHeight - newHeight > 150) {
            document.body.classList.add('keyboard-open');
            setTimeout(() => {
                if (messageInput) {
                    messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        } else {
            document.body.classList.remove('keyboard-open');
        }
    });
}

// ========== UTILITIES ==========
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
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
}

function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => 
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
}

function scrollToBottom() {
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// ========== CLEANUP ==========
window.addEventListener('beforeunload', () => {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }
});

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', initRooms);
