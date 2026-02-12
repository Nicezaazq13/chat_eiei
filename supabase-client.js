// supabase-client.js
const supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// ========== AUTH FUNCTIONS ==========
async function registerUser(email, password, username, displayName) {
    try {
        // สมัครสมาชิกด้วย Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    display_name: displayName,
                    avatar: `https://ui-avatars.com/api/?name=${displayName}&background=667eea&color=fff`
                }
            }
        });

        if (authError) throw authError;

        // เพิ่มข้อมูลผู้ใช้ในตาราง profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([
                {
                    id: authData.user.id,
                    username: username,
                    display_name: displayName,
                    avatar_url: `https://ui-avatars.com/api/?name=${displayName}&background=667eea&color=fff`,
                    email: email,
                    created_at: new Date()
                }
            ]);

        if (profileError) throw profileError;

        return { success: true, data: authData };
    } catch (error) {
        console.error('Register error:', error);
        return { success: false, error: error.message };
    }
}

async function loginUser(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        
        // อัปเดตสถานะออนไลน์
        await updateUserStatus(data.user.id, true);
        
        return { success: true, data };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

async function logout() {
    const user = await getCurrentUser();
    if (user) {
        await updateUserStatus(user.id, false);
    }
    
    const { error } = await supabase.auth.signOut();
    if (!error) {
        window.location.href = 'index.html';
    }
}

async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

async function checkUser() {
    const user = await getCurrentUser();
    return user;
}

// ========== DATABASE FUNCTIONS ==========
async function getMessages(limit = 50) {
    const { data, error } = await supabase
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

    if (error) {
        console.error('Error loading messages:', error);
        return [];
    }
    return data;
}

async function sendMessage(message) {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('messages')
        .insert([
            {
                user_id: user.id,
                message: message,
                created_at: new Date()
            }
        ])
        .select();

    if (error) {
        console.error('Error sending message:', error);
        return null;
    }
    return data;
}

// ========== REALTIME FUNCTIONS ==========
function subscribeToMessages(callback) {
    return supabase
        .channel('public:messages')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            },
            (payload) => {
                // ดึงข้อมูล profile เพิ่มเติม
                getUserProfile(payload.new.user_id).then(profile => {
                    callback({
                        ...payload.new,
                        profiles: profile
                    });
                });
            }
        )
        .subscribe();
}

function subscribeToUserStatus(callback) {
    return supabase
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

// ========== USER FUNCTIONS ==========
async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, is_online, last_seen')
        .eq('id', userId)
        .single();

    if (error) return null;
    return data;
}

async function updateUserStatus(userId, isOnline) {
    const { error } = await supabase
        .from('profiles')
        .update({
            is_online: isOnline,
            last_seen: new Date()
        })
        .eq('id', userId);

    if (error) console.error('Error updating status:', error);
}

async function getOnlineUsers() {
    const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('is_online', true)
        .limit(20);

    if (error) return [];
    return data;
}

// ========== TYPING INDICATOR ==========
let typingTimeout;
async function emitTyping(isTyping) {
    const user = await getCurrentUser();
    if (!user) return;

    // ส่งสถานะกำลังพิมพ์ผ่าน Supabase Realtime
    supabase.channel('typing').send({
        type: 'broadcast',
        event: 'typing',
        payload: { 
            user_id: user.id, 
            is_typing: isTyping,
            username: user.user_metadata.username
        }
    });
}

// ========== INITIALIZE ==========
// สร้าง profiles table ถ้ายังไม่มี (ต้องรัน SQL ใน Supabase Dashboard)
async function initDatabase() {
    // SQL ที่ต้องรันใน Supabase SQL Editor:
    /*
    -- สร้างตาราง profiles
    CREATE TABLE IF NOT EXISTS profiles (
        id UUID REFERENCES auth.users(id) PRIMARY KEY,
        username TEXT UNIQUE,
        display_name TEXT,
        avatar_url TEXT,
        email TEXT,
        is_online BOOLEAN DEFAULT false,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- สร้างตาราง messages
    CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID REFERENCES profiles(id),
        message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- สร้าง index สำหรับค้นหา
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_profiles_online ON profiles(is_online);
    
    -- ตั้งค่า Realtime
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
    */
}

// เรียกใช้ initDatabase() เมื่อโหลดแอพ
initDatabase();