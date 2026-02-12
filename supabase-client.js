// supabase-client.js

// ========== INITIALIZE SUPABASE ==========
// ตรวจสอบว่า Supabase Script โหลดมาก่อนแล้ว
if (typeof supabase === 'undefined') {
    console.error('⚠️ Supabase library not loaded! Make sure to include supabase-js script first');
}

// สร้าง Supabase client - แก้ตรงนี้!
const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// ใช้ supabaseClient แทน supabase ทั่วทั้งไฟล์
const supabase = supabaseClient; // หรือจะเปลี่ยนชื่อตัวแปรทั้งหมดก็ได้

console.log('✅ Supabase client initialized:', SUPABASE_CONFIG.url ? 'URL OK' : 'No URL');

// ========== AUTH FUNCTIONS ==========
async function registerUser(email, password, username, displayName) {
    console.log('📝 กำลังสมัครสมาชิก:', { email, username, displayName });
    
    try {
        // ตรวจสอบ Supabase client
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }

        // 1. สมัครสมาชิกด้วย Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
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

        if (authError) {
            console.error('❌ Auth error:', authError);
            throw authError;
        }

        console.log('✅ Auth success:', authData.user.id);

        // 2. เพิ่มข้อมูลใน profiles table
        const { error: profileError } = await supabase
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

async function loginUser(email, password) {
    console.log('🔐 กำลังเข้าสู่ระบบ:', email);
    
    try {
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }

        const { data, error } = await supabase.auth.signInWithPassword({
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
        
        const { error } = await supabase.auth.signOut();
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
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (error) {
        console.error('❌ Get current user error:', error);
        return null;
    }
}

// ... (ฟังก์ชันอื่นๆ เหมือนเดิม แต่เปลี่ยนเป็นใช้ try-catch ด้วย)

// ========== EXPORT FUNCTIONS TO GLOBAL ==========
// ทำให้ฟังก์ชันทั้งหมดเป็น global
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
console.log('📦 Available functions:', Object.keys(window).filter(key => 
    ['registerUser', 'loginUser', 'logout', 'sendMessage'].includes(key)
));
