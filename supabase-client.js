// supabase-client.js

// ========== INITIALIZE SUPABASE ==========
// ตรวจสอบว่า Supabase Script โหลดมาแล้ว
if (typeof supabase === 'undefined') {
    console.error('⚠️ Supabase library not loaded! Make sure to include supabase-js script first');
}

// สร้าง Supabase client - ใช้ชื่ออื่นเพื่อไม่ให้ซ้ำ
const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

console.log('✅ Supabase client initialized:', SUPABASE_CONFIG.url ? 'URL OK' : 'No URL');

// ========== AUTH FUNCTIONS ==========
async function registerUser(email, password, username, displayName) {
    console.log('📝 กำลังสมัครสมาชิก:', { email, username, displayName });
    
    try {
        // 1. สมัครสมาชิกด้วย Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    display_name: displayName,
                    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff`
                }
            }
        });

        if (authError) throw authError;
        console.log('✅ Auth success:', authData.user.id);

        // 2. เพิ่มข้อมูลใน profiles table
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert([
                {
                    id: authData.user.id,
                    username: username,
                    display_name: displayName,
                    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff`,
                    email: email,
                    created_at: new Date().toISOString(),
                    is_online: false
                }
            ]);

        if (profileError) throw profileError;
        console.log('✅ Profile created');
        
        return { success: true, data: authData };
        
    } catch (error) {
        console.error('❌ Register error:', error);
        return { 
            success: false, 
            error: error.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก'
        };
    }
}

async function loginUser(email, password) {
    console.log('🔐 กำลังเข้าสู่ระบบ:', email);
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        
        // อัปเดตสถานะออนไลน์
        await updateUserStatus(data.user.id, true);
        
        console.log('✅ Login success:', data.user.id);
        return { success: true, data };
        
    } catch (error) {
        console.error('❌ Login error:', error);
        return { 
            success: false, 
            error: error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        };
    }
}

async function logout() {
    console.log('🚪 กำลังออกจากระบบ');
    try {
        const user = await getCurrentUser();
        if (user) {
            await updateUserStatus(user.id, false);
        }
        
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        window.location.href = 'index.html';
        return { success: true };
    } catch (error) {
        console.error('❌ Logout error:', error);
        return { success: false, error: error.message };
    }
}

async function getCurrentUser() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        return user;
    } catch (error) {
        console.error('❌ Get current user error:', error);
        return null;
    }
}

async function checkUser() {
    const user = await getCurrentUser();
    return user;
}

// ========== DATABASE FUNCTIONS ==========
async function getMessages(limit = 50) {
    try {
        const { data, error } = await supabaseClient
            .from('messages')
            .select(`
                id,
                message,
                created_at,
                user_id,
                profiles:user_id (
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error loading messages:', error);
        return [];
    }
}

async function sendMessage(message) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error('ไม่พบผู้ใช้');

        const { data, error } = await supabaseClient
            .from('messages')
            .insert([
                {
                    user_id: user.id,
                    message: message,
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error sending message:', error);
        return null;
    }
}

// ========== USER FUNCTIONS ==========
async function getUserProfile(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('username, display_name, avatar_url, is_online, last_seen')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting user profile:', error);
        return null;
    }
}

async function updateUserStatus(userId, isOnline) {
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({
                is_online: isOnline,
                last_seen: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('❌ Error updating status:', error);
    }
}

async function getOnlineUsers() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('is_online', true)
            .limit(20);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error getting online users:', error);
        return [];
    }
}

// ========== REALTIME FUNCTIONS ==========
function subscribeToMessages(callback) {
    return supabaseClient
        .channel('public:messages')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            },
            async (payload) => {
                const profile = await getUserProfile(payload.new.user_id);
                callback({
                    ...payload.new,
                    profiles: profile
                });
            }
        )
        .subscribe();
}

function subscribeToUserStatus(callback) {
    return supabaseClient
        .channel('public:profiles')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles'
            },
            (payload) => callback(payload.new)
        )
        .subscribe();
}

// ========== TYPING INDICATOR ==========
let typingTimeout;
async function emitTyping(isTyping) {
    const user = await getCurrentUser();
    if (!user) return;

    supabaseClient.channel('typing').send({
        type: 'broadcast',
        event: 'typing',
        payload: { 
            user_id: user.id, 
            is_typing: isTyping,
            username: user.user_metadata?.username
        }
    });
}

// ========== EXPORT FUNCTIONS TO GLOBAL ==========
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.checkUser = checkUser;
window.getMessages = getMessages;
window.sendMessage = sendMessage;
window.subscribeToMessages = subscribeToMessages;
window.subscribeToUserStatus = subscribeToUserStatus;
window.getUserProfile = getUserProfile;
window.updateUserStatus = updateUserStatus;
window.getOnlineUsers = getOnlineUsers;
window.emitTyping = emitTyping;

console.log('✅ supabase-client.js loaded successfully!');
console.log('📦 Functions available:', Object.keys(window).filter(k => 
    ['registerUser', 'loginUser', 'logout', 'sendMessage', 'getMessages'].includes(k)
));
