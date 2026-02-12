// supabase-client.js

// ========== INITIALIZE SUPABASE ==========
if (typeof supabase === 'undefined') {
    console.error('⚠️ Supabase library not loaded!');
}

const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
console.log('✅ Supabase client initialized');

// ========== AUTH FUNCTIONS ==========
async function registerUser(username, password, displayName) {
    console.log('📝 กำลังสมัครสมาชิก:', { username, displayName });
    
    try {
        // 1. ตรวจสอบ username ซ้ำใน profiles
        const { data: existingUser, error: checkError } = await supabaseClient
            .from('profiles')
            .select('username')
            .eq('username', username)
            .maybeSingle();
            
        if (existingUser) {
            throw new Error('ชื่อผู้ใช้นี้มีคนใช้แล้ว');
        }

        // 2. สร้างอีเมลปลอมที่ไม่ซ้ำแน่นอน (สำคัญมาก!)
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const fakeEmail = `${username}_${timestamp}_${random}@chat.local`;
        
        console.log('📧 ใช้อีเมล:', fakeEmail);
        
        // 3. สมัครสมาชิกด้วย Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: fakeEmail,
            password: password,
            options: {
                data: {
                    username: username,
                    display_name: displayName,
                    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff`
                }
            }
        });

        if (authError) {
            console.error('❌ Auth error:', authError);
            throw authError;
        }
        
        console.log('✅ Auth success:', authData.user.id);

        // 4. เพิ่มข้อมูลใน profiles table
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert([
                {
                    id: authData.user.id,
                    username: username,
                    display_name: displayName,
                    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff`,
                    email: fakeEmail,
                    created_at: new Date().toISOString(),
                    is_online: false
                }
            ]);

        if (profileError) {
            console.error('❌ Profile error:', profileError);
            throw profileError;
        }
        
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

async function loginUser(username, password) {
    console.log('🔐 กำลังเข้าสู่ระบบ:', username);
    
    try {
        // 1. ค้นหาอีเมลจาก username ใน profiles
        console.log('📡 ค้นหาผู้ใช้:', username);
        
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('email, username, display_name')
            .eq('username', username)
            .maybeSingle();

        if (profileError) {
            console.error('❌ Profile query error:', profileError);
            throw profileError;
        }
        
        if (!profile) {
            console.error('❌ ไม่พบ username:', username);
            throw new Error('ไม่พบชื่อผู้ใช้นี้');
        }

        console.log('📄 พบข้อมูลผู้ใช้:', profile.email);

        // 2. เข้าสู่ระบบด้วยอีเมลที่ค้นพบ
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: profile.email,
            password: password
        });

        if (error) {
            console.error('❌ Auth error:', error);
            throw error;
        }
        
        // 3. อัปเดตสถานะออนไลน์
        await updateUserStatus(data.user.id, true);
        
        console.log('✅ Login success:', username);
        return { success: true, data };
        
    } catch (error) {
        console.error('❌ Login error:', error);
        return { 
            success: false, 
            error: error.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
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
console.log('🎯 ระบบ Login ด้วย username พร้อมใช้งาน');
console.log('📧 ใช้อีเมลแบบสุ่ม: username_timestamp_random@chat.local');
