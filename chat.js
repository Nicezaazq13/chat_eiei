// ========== CONFIGURATION ==========
const SUPABASE_URL = 'https://xaugtjljfkjqfpmnsxko.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdWd0amxqZmtqcWZwbW5zeGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODE1MTEsImV4cCI6MjA4NjQ1NzUxMX0.br0Kmrk_ekJN_E8e7J_iARpaZFAAgyR3PVsuSfD72vw';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: localStorage
    }
});

const YOUTUBE_API_KEY = 'AIzaSyC1-oYQ-P2u7qvIVv9-Dssu64Y3JqyJ62k';

// ========== GLOBAL VARIABLES ==========
window.currentUser = null;
window.currentRoom = null;
window.currentRoomId = '00000000-0000-0000-0000-000000000000';
window.messageSubscription = null;
window.messagesContainer = document.getElementById('messagesContainer');
window.messageInput = document.getElementById('messageInput');
window.sendButton = document.getElementById('sendButton');
window.isAdmin = false;
window.isAdminMode = false;
window.selectedMessages = new Set();
window.selectedImageFile = null;
window.currentMusic = null;
window.audioPlayer = null;
window.kickMemberId = null;
window.selectedProfileImage = null;
window.currentAvatarUrl = null;

// YouTube Variables
window.youtubePlayer = null;
window.youtubePlayerReady = false;
window.youtubeApiReady = false;
window.youtubeActivityId = null;
window.youtubeLoadAttempts = 0;

// YouTube Playlist Variables
const savedRoomId = localStorage.getItem('chat_last_room_id');
if (savedRoomId) {
    try {
        const savedPlaylist = localStorage.getItem(`youtube_playlist_${savedRoomId}`);
        window.youtubePlaylist = savedPlaylist ? JSON.parse(savedPlaylist) : [];
    } catch (e) {
        window.youtubePlaylist = [];
    }
} else {
    window.youtubePlaylist = [];
}
window.searchTimeout = null;
let currentVideoId = null;
let currentVideoTitle = '';
let currentVideoChannel = '';
let autoPlayNext = true;

const PUBLIC_ROOM_ID = '00000000-0000-0000-0000-000000000000';
const STORAGE_KEY = 'chat_last_room_id';

const emojiList = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'];

// ========== UTILITY FUNCTIONS ==========
window.debug = function(msg) {
    console.log('🔍 DEBUG:', msg);
    const debugEl = document.getElementById('debugInfo');
    if (debugEl) {
        debugEl.innerHTML = msg + '<br>' + debugEl.innerHTML;
        debugEl.style.display = 'block';
        setTimeout(() => {
            debugEl.style.display = 'none';
        }, 3000);
    }
};

window.formatTime = function(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

window.linkify = function(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
};

window.scrollToBottom = function() { 
    if (window.messagesContainer) {
        window.messagesContainer.scrollTop = window.messagesContainer.scrollHeight; 
    }
};

// ========== IMAGE PREVIEW FUNCTIONS ==========
window.clearImagePreview = function() {
    console.log('Clearing image preview');
    window.selectedImageFile = null;
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    if (preview) {
        preview.style.display = 'none';
    }
    if (previewImg) {
        previewImg.src = '';
    }
};

window.uploadImage = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('❌ รูปภาพต้องมีขนาดไม่เกิน 5MB');
                return;
            }
            
            window.selectedImageFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('imagePreview');
                const img = document.getElementById('previewImg');
                if (preview && img) { 
                    img.src = e.target.result; 
                    preview.style.display = 'inline-block'; 
                }
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
};

window.openLightbox = function(imageUrl) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.onclick = function() { 
        document.body.removeChild(lightbox); 
    };
    
    const img = document.createElement('img');
    img.src = imageUrl;
    
    const closeBtn = document.createElement('span');
    closeBtn.className = 'lightbox-close';
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = function(e) { 
        e.stopPropagation(); 
        document.body.removeChild(lightbox); 
    };
    
    lightbox.appendChild(img);
    lightbox.appendChild(closeBtn);
    document.body.appendChild(lightbox);
};

// ========== CHECK USER ==========
window.checkUser = async function() {
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.error('Session error:', sessionError);
            return null;
        }
        
        if (!session) {
            console.log('No session found');
            return null;
        }
        
        return session.user;
        
    } catch (error) {
        console.error('Error checking user:', error);
        return null;
    }
};

// ========== SESSION MANAGER ==========
window.setupSessionManager = function() {
    setInterval(async () => {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            
            if (!session) {
                console.log('Session expired, redirecting...');
                window.location.href = 'login.html';
                return;
            }
            
            if (window.currentUser) {
                await supabaseClient
                    .from('profiles')
                    .update({ 
                        last_seen: new Date().toISOString(),
                        is_online: true 
                    })
                    .eq('id', window.currentUser.id);
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }, 60000);
};

// ========== REALTIME MESSAGES ==========
window.setupRealtimeSubscription = async function(roomId) {
    if (window.messageSubscription) {
        console.log('🔄 Unsubscribing from old subscription...');
        window.messageSubscription.unsubscribe();
        window.messageSubscription = null;
    }
    
    console.log('📡 Setting up realtime subscription for room:', roomId);
    
    window.messageSubscription = supabaseClient
        .channel(`room:${roomId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`
            },
            async (payload) => {
                console.log('📥 New message received:', payload);
                
                try {
                    const { data: profile, error } = await supabaseClient
                        .from('profiles')
                        .select('username, display_name, avatar_url')
                        .eq('id', payload.new.user_id)
                        .single();
                    
                    if (error && error.code !== 'PGRST116') {
                        console.error('Error fetching profile:', error);
                    }
                    
                    const newMessage = {
                        ...payload.new,
                        profiles: profile || { 
                            display_name: 'ผู้ใช้', 
                            username: 'user', 
                            avatar_url: null 
                        }
                    };
                    
                    window.displayMessage(newMessage);
                    window.scrollToBottom();
                    
                } catch (error) {
                    console.error('Error processing new message:', error);
                }
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`
            },
            (payload) => {
                console.log('📥 Message updated:', payload);
                window.updateMessageInUI(payload.new);
            }
        )
        .subscribe((status) => {
            console.log('📡 Subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Successfully subscribed to realtime updates');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Realtime subscription error');
            }
        });
};

window.updateMessageInUI = function(updatedMessage) {
    const messageDiv = document.querySelector(`.message[data-message-id="${updatedMessage.id}"]`);
    if (messageDiv) {
        if (updatedMessage.is_deleted) {
            messageDiv.classList.add('deleted-message');
            const contentDiv = messageDiv.querySelector('.message-content');
            if (contentDiv) {
                contentDiv.innerHTML = `
                    <div class="deleted-content">
                        <span>🗑️</span>
                        <span>${updatedMessage.message}</span>
                    </div>
                `;
            }
        }
    }
};

// ========== YOUTUBE API ==========
window.loadYouTubeAPI = function() {
    if (window.YT && window.YT.Player) {
        window.youtubeApiReady = true;
        console.log('✅ YouTube API already loaded');
        return;
    }
    
    console.log('📦 Loading YouTube API...');
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
};

window.onYouTubeIframeAPIReady = function() {
    window.youtubeApiReady = true;
    console.log('✅ YouTube API Ready');
    window.debug('YouTube API พร้อมใช้งาน');
};

window.openYoutubePlayer = function(videoId) {
    console.log('🎬 Opening YouTube player with videoId:', videoId);
    window.debug('เปิด YouTube Player: ' + videoId);
    
    if (!videoId) {
        alert('❌ ไม่มี Video ID');
        return;
    }
    
    const modal = document.getElementById('youtubePlayerModal');
    const container = document.getElementById('youtube-player');
    const titleEl = document.getElementById('youtubeActivityTitle');
    
    if (!modal || !container) {
        console.error('❌ Modal or container not found');
        return;
    }
    
    if (!window.youtubeApiReady) {
        window.loadYouTubeAPI();
        
        window.youtubeLoadAttempts++;
        if (window.youtubeLoadAttempts > 3) {
            alert('❌ ไม่สามารถโหลด YouTube Player ได้ กรุณาลองใหม่');
            window.youtubeLoadAttempts = 0;
            return;
        }
        
        alert('⏳ กำลังโหลด YouTube Player กรุณารอสักครู่...');
        
        setTimeout(() => {
            if (window.youtubeApiReady) {
                window.openYoutubePlayer(videoId);
            } else {
                window.openYoutubePlayer(videoId);
            }
        }, 2000);
        return;
    }
    
    window.youtubeLoadAttempts = 0;
    
    if (window.youtubePlayer) {
        try {
            window.youtubePlayer.destroy();
        } catch (e) {}
        window.youtubePlayer = null;
    }
    
    container.innerHTML = '';
    
    const playerContainer = document.createElement('div');
    playerContainer.id = 'youtube-player-container';
    playerContainer.style.width = '100%';
    playerContainer.style.height = '100%';
    container.appendChild(playerContainer);
    
    if (titleEl) {
        titleEl.textContent = 'YouTube Player';
    }
    
    modal.classList.add('active');
    
    try {
        window.youtubePlayer = new YT.Player('youtube-player-container', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'autoplay': 1,
                'controls': 1,
                'rel': 0,
                'modestbranding': 1,
                'enablejsapi': 1,
                'playsinline': 1
            },
            events: {
                'onReady': function() {
                    window.youtubePlayerReady = true;
                    const btn = document.getElementById('syncPlayPauseBtn');
                    if (btn) btn.innerHTML = '⏸️ หยุด';
                    window.debug('YouTube Player พร้อมใช้งาน');
                    
                    setTimeout(() => {
                        window.displayYoutubePlayerPlaylist();
                    }, 1000);
                },
                'onStateChange': function(event) {
                    const state = event.data;
                    const btn = document.getElementById('syncPlayPauseBtn');
                    const stateEl = document.getElementById('youtubePlayerState');
                    
                    if (btn) {
                        if (state === YT.PlayerState.PLAYING) {
                            btn.innerHTML = '⏸️ หยุด';
                            if (stateEl) stateEl.textContent = '▶️ กำลังเล่น';
                        } else if (state === YT.PlayerState.PAUSED) {
                            btn.innerHTML = '▶️ เล่น';
                            if (stateEl) stateEl.textContent = '⏸️ หยุด';
                        } else if (state === YT.PlayerState.ENDED) {
                            btn.innerHTML = '▶️ เล่นใหม่';
                            if (stateEl) stateEl.textContent = '⏹️ จบแล้ว';
                            
                            if (autoPlayNext) {
                                setTimeout(() => {
                                    window.playNextInPlaylist();
                                }, 1000);
                            }
                        }
                    }
                    
                    setTimeout(() => {
                        window.displayYoutubePlayerPlaylist();
                    }, 100);
                },
                'onError': function(event) {
                    console.error('❌ YouTube error:', event.data);
                    let msg = 'ไม่สามารถเล่นวิดีโอนี้ได้';
                    if (event.data === 2) msg = '❌ Video ID ไม่ถูกต้อง';
                    if (event.data === 5) msg = '❌ ไม่สามารถเล่น HTML5 player ได้';
                    if (event.data === 100) msg = '❌ วิดีโอไม่พบหรือถูกลบ';
                    if (event.data === 101 || event.data === 150) msg = '❌ ไม่ได้รับอนุญาตให้เล่น';
                    alert(msg);
                }
            }
        });
        
        console.log('✅ YouTube Player created successfully');
        
    } catch (e) {
        console.error('❌ Error creating YouTube player:', e);
        alert('ไม่สามารถสร้าง YouTube Player ได้: ' + e.message);
    }
    
    setTimeout(async () => {
        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`);
            const data = await response.json();
            if (data.items && data.items[0]) {
                currentVideoChannel = data.items[0].snippet.channelTitle;
            }
        } catch (error) {
            console.error('❌ Error fetching video details:', error);
        }
    }, 1000);
};

window.closeYoutubePlayer = function() {
    const modal = document.getElementById('youtubePlayerModal');
    if (modal) modal.classList.remove('active');
    
    if (window.youtubePlayer) {
        try {
            window.youtubePlayer.destroy();
        } catch (e) {}
        window.youtubePlayer = null;
    }
    
    const container = document.getElementById('youtube-player');
    if (container) container.innerHTML = '';
    
    window.youtubePlayerReady = false;
};

window.syncPlayPause = function() {
    if (!window.youtubePlayer || !window.youtubePlayerReady) {
        alert('Player ยังไม่พร้อม');
        return;
    }
    try {
        const state = window.youtubePlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            window.youtubePlayer.pauseVideo();
        } else {
            window.youtubePlayer.playVideo();
        }
    } catch (e) {}
};

window.syncSeek = function(seconds) {
    if (!window.youtubePlayer || !window.youtubePlayerReady) return;
    try {
        const time = window.youtubePlayer.getCurrentTime();
        window.youtubePlayer.seekTo(time + seconds, true);
    } catch (e) {}
};

window.syncRestart = function() {
    if (!window.youtubePlayer || !window.youtubePlayerReady) return;
    try {
        window.youtubePlayer.seekTo(0, true);
        window.youtubePlayer.playVideo();
    } catch (e) {}
};

window.openYoutubePlayerFromActivity = function(videoId, activityId) {
    console.log('🎬 Opening YouTube from activity:', videoId, activityId);
    window.debug('กำลังเปิด YouTube: ' + videoId);
    
    if (!videoId) {
        alert('❌ ไม่พบ Video ID');
        return;
    }
    
    window.openYoutubePlayer(videoId);
    
    if (activityId) {
        window.youtubeActivityId = activityId;
    }
};

window.playYoutubeVideo = function(videoId) {
    window.openYoutubePlayer(videoId);
};

// ========== YOUTUBE PLAYLIST FUNCTIONS ==========
window.openYoutubePlaylist = function() {
    const modal = document.getElementById('youtubePlaylistModal');
    if (modal) {
        modal.classList.add('active');
        window.loadYoutubePlaylist();
        
        const searchInput = document.getElementById('youtubeSearchInput');
        if (searchInput) searchInput.value = '';
        document.getElementById('searchResults').innerHTML = '<div style="text-align: center; padding: 40px; color: #718096;">🔍 พิมพ์คำค้นหาเพื่อหาคลิป YouTube</div>';
    }
};

window.closeYoutubePlaylist = function() {
    const modal = document.getElementById('youtubePlaylistModal');
    if (modal) {
        modal.classList.remove('active');
    }
};

window.showAddToPlaylistModal = function() {
    if (!window.youtubePlayer) {
        alert('❌ กรุณาเลือกวิดีโอก่อน');
        return;
    }
    
    try {
        const videoData = window.youtubePlayer.getVideoData();
        currentVideoId = videoData.video_id;
        currentVideoTitle = videoData.title;
        
        document.getElementById('currentVideoTitle').textContent = currentVideoTitle;
        document.getElementById('currentVideoChannel').textContent = currentVideoChannel || 'ไม่ทราบช่อง';
        
        window.loadPlaylistsForSelect();
        
        const modal = document.getElementById('addToPlaylistModal');
        modal.classList.add('active');
    } catch (e) {
        console.error('Error getting video data:', e);
        alert('ไม่สามารถดึงข้อมูลวิดีโอได้');
    }
};

window.closeAddToPlaylistModal = function() {
    const modal = document.getElementById('addToPlaylistModal');
    modal.classList.remove('active');
    document.getElementById('newPlaylistField').style.display = 'none';
    document.getElementById('newPlaylistName').value = '';
};

window.toggleNewPlaylistField = function() {
    const field = document.getElementById('newPlaylistField');
    field.style.display = field.style.display === 'none' ? 'block' : 'none';
};

window.loadPlaylistsForSelect = async function() {
    const select = document.getElementById('playlistSelect');
    
    try {
        const savedPlaylist = localStorage.getItem(`youtube_playlist_${window.currentRoomId}`);
        const playlist = savedPlaylist ? JSON.parse(savedPlaylist) : [];
        
        const playlistNames = [...new Set(playlist.map(item => item.playlist_name || 'เพลย์ลิสต์เริ่มต้น'))];
        
        if (playlistNames.length === 0) {
            select.innerHTML = '<option value="">ยังไม่มีเพลย์ลิสต์</option>';
        } else {
            select.innerHTML = playlistNames.map(name => 
                `<option value="${name}">${name}</option>`
            ).join('');
        }
        
    } catch (error) {
        console.error('❌ Error loading playlists:', error);
        select.innerHTML = '<option value="">เกิดข้อผิดพลาด</option>';
    }
};

window.confirmAddToPlaylist = async function() {
    const select = document.getElementById('playlistSelect');
    const newPlaylistName = document.getElementById('newPlaylistName').value.trim();
    
    let playlistName = newPlaylistName || select.value;
    
    if (!playlistName || playlistName === 'ยังไม่มีเพลย์ลิสต์' || playlistName === 'เกิดข้อผิดพลาด') {
        alert('❌ กรุณาเลือกหรือสร้างเพลย์ลิสต์');
        return;
    }
    
    if (!currentVideoId) {
        alert('❌ ไม่พบวิดีโอ');
        return;
    }
    
    const savedPlaylist = localStorage.getItem(`youtube_playlist_${window.currentRoomId}`);
    let playlist = savedPlaylist ? JSON.parse(savedPlaylist) : [];
    
    if (playlist.some(v => v.video_id === currentVideoId)) {
        alert('⚠️ คลิปนี้อยู่ในเพลย์ลิสต์แล้ว');
        window.closeAddToPlaylistModal();
        return;
    }
    
    const newItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        room_id: window.currentRoomId,
        user_id: window.currentUser.id,
        video_id: currentVideoId,
        title: currentVideoTitle,
        channel: currentVideoChannel || 'ไม่ทราบช่อง',
        thumbnail: `https://img.youtube.com/vi/${currentVideoId}/mqdefault.jpg`,
        added_at: new Date().toISOString(),
        added_by: window.currentUser.user_metadata?.display_name || window.currentUser.user_metadata?.username || 'ผู้ใช้',
        playlist_name: playlistName
    };
    
    playlist.unshift(newItem);
    localStorage.setItem(`youtube_playlist_${window.currentRoomId}`, JSON.stringify(playlist));
    window.youtubePlaylist = playlist;
    
    window.closeAddToPlaylistModal();
    window.displayYoutubePlaylist(playlist);
    window.displayYoutubePlayerPlaylist();
    
    alert('✅ เพิ่มลงเพลย์ลิสต์แล้ว');
};

window.displayYoutubePlayerPlaylist = function() {
    const container = document.getElementById('youtubePlayerPlaylist');
    const countEl = document.getElementById('youtubePlaylistCount');
    
    if (!container) return;
    
    const roomPlaylist = window.youtubePlaylist.filter(item => item.room_id === window.currentRoomId);
    
    if (countEl) countEl.textContent = roomPlaylist.length;
    
    if (roomPlaylist.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: #718096;">📋 ยังไม่มีคลิปในเพลย์ลิสต์<br><small>คลิก "เพิ่มลงเพลย์ลิสต์" เพื่อเพิ่มวิดีโอ</small></div>';
        return;
    }
    
    let currentVideoId = null;
    if (window.youtubePlayer) {
        try {
            currentVideoId = window.youtubePlayer.getVideoData().video_id;
        } catch (e) {}
    }
    
    container.innerHTML = roomPlaylist.map((item, index) => {
        const isCurrent = item.video_id === currentVideoId;
        const isOwner = item.user_id === window.currentUser?.id;
        
        return `
            <div class="playlist-item-in-player" 
                 style="display: flex; gap: 12px; padding: 12px; margin-bottom: 8px; 
                        border-radius: var(--radius-md); 
                        background: ${isCurrent ? 'var(--primary-color)' : 'white'};
                        color: ${isCurrent ? 'white' : 'var(--text-dark)'};
                        border: 1px solid ${isCurrent ? 'var(--primary-dark)' : 'var(--border-color)'};
                        cursor: pointer; transition: all 0.2s;"
                 onclick="window.playYoutubeVideo('${item.video_id}')"
                 onmouseover="this.style.background='${isCurrent ? 'var(--primary-dark)' : 'var(--bg-light)'}'"
                 onmouseout="this.style.background='${isCurrent ? 'var(--primary-color)' : 'white'}'">
                
                <div style="position: relative;">
                    <img src="${item.thumbnail}" alt="${item.title}" 
                         style="width: 80px; height: 45px; border-radius: 4px; object-fit: cover;">
                    <span style="position: absolute; top: -5px; left: -5px; 
                                 background: var(--primary-color); color: white; 
                                 width: 20px; height: 20px; border-radius: 50%; 
                                 display: flex; align-items: center; justify-content: center;
                                 font-size: 11px; font-weight: bold;">
                        ${index + 1}
                    </span>
                </div>
                
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; 
                                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" 
                         title="${item.title}">
                        ${item.title}
                    </div>
                    <div style="font-size: 11px; color: ${isCurrent ? 'rgba(255,255,255,0.8)' : 'var(--text-light)'};">
                        ${item.channel}
                    </div>
                    <div style="font-size: 10px; color: ${isCurrent ? 'rgba(255,255,255,0.6)' : 'var(--text-light)'};">
                        เพิ่มโดย ${item.added_by}
                    </div>
                </div>
                
                <div style="display: flex; gap: 4px; align-items: center;">
                    ${isCurrent ? '<span style="font-size: 11px; color: rgba(255,255,255,0.8);">▶️ กำลังเล่น</span>' : ''}
                    ${isOwner || window.isAdmin ? 
                        `<button onclick="event.stopPropagation(); window.removeFromYoutubePlaylist('${item.id}')" 
                                style="padding: 4px 8px; background: transparent; 
                                       color: ${isCurrent ? 'white' : 'var(--danger-color)'}; 
                                       border: 1px solid ${isCurrent ? 'rgba(255,255,255,0.3)' : 'var(--danger-color)'}; 
                                       border-radius: 4px; font-size: 11px; cursor: pointer;">
                            🗑️
                        </button>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML += `
        <div style="display: flex; gap: 8px; margin-top: 15px; padding: 10px; background: white; border-radius: var(--radius-md);">
            <button onclick="window.playAllPlaylist()" class="btn btn-outline" style="flex: 1; font-size: 12px; padding: 8px;">
                ▶️ เล่นทั้งหมด
            </button>
            <button onclick="window.shufflePlaylist()" class="btn btn-outline" style="flex: 1; font-size: 12px; padding: 8px;">
                🔀 สุ่มเล่น
            </button>
            <label style="display: flex; align-items: center; gap: 5px; font-size: 12px;">
                <input type="checkbox" id="autoPlayNextCheckbox" ${autoPlayNext ? 'checked' : ''} 
                       onchange="window.toggleAutoPlayNext()"> เล่นถัดไป
            </label>
        </div>
    `;
};

window.toggleAutoPlayNext = function() {
    autoPlayNext = document.getElementById('autoPlayNextCheckbox').checked;
    localStorage.setItem('autoPlayNext', autoPlayNext);
};

window.playAllPlaylist = function() {
    const roomPlaylist = window.youtubePlaylist.filter(item => item.room_id === window.currentRoomId);
    if (roomPlaylist.length === 0) {
        alert('❌ ไม่มีวิดีโอในเพลย์ลิสต์');
        return;
    }
    
    window.playYoutubeVideo(roomPlaylist[0].video_id);
};

window.shufflePlaylist = function() {
    const roomPlaylist = window.youtubePlaylist.filter(item => item.room_id === window.currentRoomId);
    if (roomPlaylist.length === 0) {
        alert('❌ ไม่มีวิดีโอในเพลย์ลิสต์');
        return;
    }
    
    const randomIndex = Math.floor(Math.random() * roomPlaylist.length);
    window.playYoutubeVideo(roomPlaylist[randomIndex].video_id);
};

window.playNextInPlaylist = function() {
    const roomPlaylist = window.youtubePlaylist.filter(item => item.room_id === window.currentRoomId);
    if (roomPlaylist.length === 0) {
        alert('❌ ไม่มีวิดีโอในเพลย์ลิสต์');
        return;
    }
    
    let currentIndex = -1;
    if (window.youtubePlayer) {
        try {
            const currentId = window.youtubePlayer.getVideoData().video_id;
            currentIndex = roomPlaylist.findIndex(item => item.video_id === currentId);
        } catch (e) {
            console.error('Error getting current video:', e);
        }
    }
    
    const nextIndex = (currentIndex + 1) % roomPlaylist.length;
    const nextVideo = roomPlaylist[nextIndex];
    
    window.playYoutubeVideo(nextVideo.video_id);
};

window.formatDuration = function(duration) {
    if (!duration) return '00:00';
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');
    
    if (hours) {
        return `${hours.padStart(2, '0')}:${(minutes || '0').padStart(2, '0')}:${(seconds || '0').padStart(2, '0')}`;
    } else {
        return `${(minutes || '0').padStart(2, '0')}:${(seconds || '0').padStart(2, '0')}`;
    }
};

window.searchYoutube = async function() {
    const query = document.getElementById('youtubeSearchInput').value.trim();
    if (!query) {
        alert('❌ กรุณาพิมพ์คำค้นหา');
        return;
    }
    
    const searchBtn = document.getElementById('youtubeSearchBtn');
    searchBtn.disabled = true;
    searchBtn.textContent = '⏳ กำลังค้นหา...';
    
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);
        
        const results = document.getElementById('searchResults');
        
        if (!data.items || data.items.length === 0) {
            results.innerHTML = '<div style="text-align: center; padding: 40px; color: #718096;">❌ ไม่พบคลิปที่ค้นหา</div>';
            return;
        }
        
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        const detailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
        const detailsData = await detailsResponse.json();
        
        const durationMap = {};
        if (detailsData.items) {
            detailsData.items.forEach(item => {
                durationMap[item.id] = item.contentDetails.duration;
            });
        }
        
        results.innerHTML = data.items.map(item => {
            const videoId = item.id.videoId;
            const title = item.snippet.title;
            const channel = item.snippet.channelTitle;
            const thumbnail = item.snippet.thumbnails.medium.url;
            const duration = window.formatDuration(durationMap[videoId]);
            const isInPlaylist = window.youtubePlaylist.some(v => v.video_id === videoId);
            
            return `
                <div class="search-result-item">
                    <img src="${thumbnail}" alt="${title}" class="search-result-thumbnail" onclick="window.playYoutubeVideo('${videoId}')">
                    <div class="search-result-info">
                        <div class="search-result-title" title="${title}">${title}</div>
                        <div class="search-result-channel">${channel}</div>
                        <div class="search-result-duration">⏱️ ${duration}</div>
                    </div>
                    <button class="search-result-add ${isInPlaylist ? 'added' : ''}" onclick="window.addToYoutubePlaylist('${videoId}', '${title.replace(/'/g, "\\'")}', '${channel.replace(/'/g, "\\'")}', '${thumbnail}')">
                        ${isInPlaylist ? '✓ เพิ่มแล้ว' : '➕ เพิ่ม'}
                    </button>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('❌ Error searching YouTube:', error);
        document.getElementById('searchResults').innerHTML = `<div style="text-align: center; padding: 40px; color: #f56565;">❌ เกิดข้อผิดพลาด: ${error.message}</div>`;
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'ค้นหา';
    }
};

window.loadYoutubePlaylist = async function() {
    if (!window.currentRoomId) {
        console.log('No room selected');
        return;
    }
    
    try {
        console.log('Loading playlist for room:', window.currentRoomId);
        
        const savedPlaylist = localStorage.getItem(`youtube_playlist_${window.currentRoomId}`);
        window.youtubePlaylist = savedPlaylist ? JSON.parse(savedPlaylist) : [];
        
        console.log(`✅ Loaded ${window.youtubePlaylist.length} items from localStorage`);
        
        window.displayYoutubePlaylist(window.youtubePlaylist);
        
        if (document.getElementById('youtubePlayerModal') && 
            document.getElementById('youtubePlayerModal').classList.contains('active')) {
            window.displayYoutubePlayerPlaylist();
        }
        
    } catch (error) {
        console.error('❌ Error loading playlist:', error);
        window.youtubePlaylist = [];
    }
};

window.addToYoutubePlaylist = async function(videoId, title, channel, thumbnail) {
    if (!window.currentRoomId) {
        alert('❌ กรุณาเลือกห้องก่อน');
        return;
    }
    
    if (window.youtubePlaylist.some(v => v.video_id === videoId)) {
        alert('⚠️ คลิปนี้อยู่ในเพลย์ลิสต์แล้ว');
        return;
    }
    
    const newItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        room_id: window.currentRoomId,
        user_id: window.currentUser.id,
        video_id: videoId,
        title: title,
        channel: channel,
        thumbnail: thumbnail,
        added_at: new Date().toISOString(),
        added_by: window.currentUser.user_metadata?.display_name || window.currentUser.user_metadata?.username || 'ผู้ใช้',
        playlist_name: 'เพลย์ลิสต์เริ่มต้น'
    };
    
    window.youtubePlaylist.unshift(newItem);
    localStorage.setItem(`youtube_playlist_${window.currentRoomId}`, JSON.stringify(window.youtubePlaylist));
    console.log('✅ Saved to localStorage, total:', window.youtubePlaylist.length);
    
    window.displayYoutubePlaylist(window.youtubePlaylist);
    
    if (document.getElementById('youtubePlayerModal') && 
        document.getElementById('youtubePlayerModal').classList.contains('active')) {
        window.displayYoutubePlayerPlaylist();
    }
    
    const addBtn = document.querySelector(`.search-result-add[onclick*="${videoId}"]`);
    if (addBtn) {
        addBtn.classList.add('added');
        addBtn.textContent = '✓ เพิ่มแล้ว';
        addBtn.style.background = 'var(--secondary-color)';
    }
    
    alert('✅ เพิ่มคลิปลงเพลย์ลิสต์แล้ว');
};

window.displayYoutubePlaylist = function(playlist) {
    const container = document.getElementById('playlistItems');
    const countEl = document.getElementById('playlistCount');
    
    if (!container) return;
    
    const roomPlaylist = playlist.filter(item => item.room_id === window.currentRoomId);
    
    if (countEl) countEl.textContent = roomPlaylist.length;
    
    if (roomPlaylist.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #718096;">📋 ยังไม่มีคลิปในเพลย์ลิสต์<br><small>ค้นหาและเพิ่มคลิปจากฝั่งซ้าย</small></div>';
        return;
    }
    
    container.innerHTML = roomPlaylist.map(item => {
        const isOwner = item.user_id === window.currentUser?.id;
        
        return `
            <div class="playlist-item">
                <img src="${item.thumbnail || `https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg`}" 
                     alt="${item.title}" 
                     class="playlist-item-thumbnail" 
                     onclick="window.playYoutubeVideo('${item.video_id}')">
                <div class="playlist-item-info">
                    <div class="playlist-item-title" title="${item.title}">${item.title}</div>
                    <div class="playlist-item-channel">${item.channel}</div>
                    <div class="playlist-item-added-by">เพิ่มโดย ${item.added_by}</div>
                </div>
                <div class="playlist-item-controls">
                    <button class="playlist-item-play" onclick="window.playYoutubeVideo('${item.video_id}')">▶️ เล่น</button>
                    ${isOwner || window.isAdmin ? 
                        `<button class="playlist-item-remove" onclick="window.removeFromYoutubePlaylist('${item.id}')">🗑️ ลบ</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
};

window.removeFromYoutubePlaylist = async function(playlistId) {
    if (!confirm('🗑️ ลบคลิปนี้ออกจากเพลย์ลิสต์?')) return;
    
    const itemToRemove = window.youtubePlaylist.find(item => item.id === playlistId);
    
    window.youtubePlaylist = window.youtubePlaylist.filter(item => item.id !== playlistId);
    localStorage.setItem(`youtube_playlist_${window.currentRoomId}`, JSON.stringify(window.youtubePlaylist));
    
    window.displayYoutubePlaylist(window.youtubePlaylist);
    window.displayYoutubePlayerPlaylist();
    
    const addBtn = document.querySelector(`.search-result-add[onclick*="${itemToRemove.video_id}"]`);
    if (addBtn) {
        addBtn.classList.remove('added');
        addBtn.textContent = '➕ เพิ่ม';
        addBtn.style.background = 'var(--primary-color)';
    }
    
    alert('✅ ลบคลิปออกจากเพลย์ลิสต์แล้ว');
};

// ========== ACTIVITIES FUNCTIONS ==========
window.loadActivities = async function() {
    if (!window.currentRoomId) {
        console.log('No room selected');
        return;
    }
    
    const container = document.getElementById('activitiesList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #718096;">⏳ กำลังโหลดกิจกรรม...</div>';
    
    try {
        console.log('📥 Loading activities for room:', window.currentRoomId);
        
        const { data: activities, error } = await supabaseClient
            .from('activities')
            .select('*')
            .eq('room_id', window.currentRoomId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error loading activities:', error);
            container.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #f56565;">❌ ${error.message}</div>`;
            return;
        }
        
        console.log(`📊 Loaded ${activities?.length || 0} activities`);
        
        if (!activities || activities.length === 0) {
            container.innerHTML = 
                '<div style="text-align: center; padding: 40px 20px; color: #718096;">' +
                '🎮 ยังไม่มีกิจกรรมในห้องนี้<br>' +
                '<small>คลิก "สร้างกิจกรรม" เพื่อเริ่มต้น</small>' +
                '</div>';
            return;
        }
        
        const activitiesWithDetails = await Promise.all(activities.map(async (activity) => {
            const { data: creator } = await supabaseClient
                .from('profiles')
                .select('username, display_name, avatar_url')
                .eq('id', activity.user_id)
                .maybeSingle();
            
            const { data: participants } = await supabaseClient
                .from('activity_participants')
                .select('user_id, joined_at')
                .eq('activity_id', activity.id);
            
            const participantsWithProfiles = await Promise.all((participants || []).map(async (p) => {
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('username, display_name, avatar_url')
                    .eq('id', p.user_id)
                    .maybeSingle();
                
                return {
                    ...p,
                    profiles: profile
                };
            }));
            
            return {
                ...activity,
                creator: creator || { display_name: 'ผู้ใช้', username: 'user', avatar_url: null },
                participants: participantsWithProfiles || []
            };
        }));
        
        window.displayActivities(activitiesWithDetails);
        
    } catch (error) { 
        console.error('❌ Error loading activities:', error); 
        container.innerHTML = 
            '<div style="text-align: center; padding: 40px 20px; color: #f56565;">' +
            '❌ เกิดข้อผิดพลาด: ' + error.message + '</div>';
    }
};

window.displayActivities = function(activities) {
    const container = document.getElementById('activitiesList');
    if (!container) return;
    
    console.log('🎯 Displaying activities:', activities.length);
    
    if (activities.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #718096;">🎮 ยังไม่มีกิจกรรม<br><small>คลิก "สร้างกิจกรรม" เพื่อเริ่มต้น</small></div>';
        return;
    }
    
    container.innerHTML = activities.map(activity => {
        const isCreator = activity.user_id === window.currentUser?.id;
        const isJoined = activity.participants?.some(p => p.user_id === window.currentUser?.id);
        const participantsCount = activity.participants?.length || 1;
        
        let activityIcon = '✨';
        if (activity.activity_type === 'youtube') activityIcon = '📺';
        else if (activity.activity_type === 'game') activityIcon = '🎮';
        else if (activity.activity_type === 'poll') activityIcon = '📊';
        
        const videoId = activity.content || '';
        
        return `<div class="activity-item" id="activity-${activity.id}" data-activity-id="${activity.id}">
            <div class="activity-header">
                <div class="activity-title"><span>${activityIcon}</span> ${activity.title}</div>
                <span class="activity-type-badge">${activity.activity_type}</span>
            </div>
            <div class="activity-creator">
                <img src="${activity.creator?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activity.creator?.display_name || activity.creator?.username)}&background=667eea&color=fff`}" alt="creator" class="activity-creator-avatar">
                <span>${activity.creator?.display_name || activity.creator?.username}</span>
                ${isCreator ? '<span style="color: #48bb78;">👑</span>' : ''}
            </div>
            ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
            <div class="activity-meta">
                <span>👥 ${participantsCount}/${activity.max_participants || '∞'}</span>
                <span>🕐 ${window.formatTime(activity.created_at)}</span>
            </div>
            <div class="activity-actions" onclick="event.stopPropagation()">
                ${activity.activity_type === 'youtube' && videoId ? `
                    <button type="button" 
                            class="view-activity-btn" 
                            data-video-id="${videoId}"
                            data-activity-id="${activity.id}"
                            onclick="event.stopPropagation(); window.openYoutubePlayerFromActivity('${videoId}', '${activity.id}'); return false;">
                        📺 ดู
                    </button>
                ` : ''}
                <button type="button"
                        class="join-activity-btn ${isJoined ? 'joined' : ''}"
                        data-activity-id="${activity.id}"
                        onclick="event.stopPropagation(); window.toggleJoinActivity('${activity.id}'); return false;">
                    ${isJoined ? '❌ ออก' : '✅ เข้าร่วม'}
                </button>
                ${isCreator || window.isAdmin ? `
                    <button type="button"
                            class="btn" 
                            style="background: #f56565; color: white; padding: 8px; border-radius: 6px;"
                            data-activity-id="${activity.id}"
                            onclick="event.stopPropagation(); window.endActivity('${activity.id}'); return false;">
                        ✕ จบ
                    </button>
                ` : ''}
            </div>
        </div>`;
    }).join('');
    
    console.log('✅ Activities displayed');
};

window.createActivity = async function(event) {
    event.preventDefault();
    
    try {
        const title = document.getElementById('activityTitle').value;
        const description = document.getElementById('activityDescription').value;
        const activityType = document.getElementById('activityType').value;
        const maxParticipants = parseInt(document.getElementById('maxParticipants').value) || 0;
        
        if (!title) {
            alert('❌ กรุณากรอกชื่อกิจกรรม');
            return;
        }
        
        let content = '';
        let videoId = '';
        
        if (activityType === 'youtube') {
            let url = document.getElementById('youtubeUrl').value;
            if (!url) {
                alert('❌ กรุณาใส่ URL YouTube');
                return;
            }
            
            if (url.includes('youtube.com/watch?v=')) {
                videoId = url.split('v=')[1]?.split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1];
            } else if (url.includes('youtube.com/embed/')) {
                videoId = url.split('/embed/')[1].split('?')[0];
            }
            
            if (!videoId) {
                alert('❌ ไม่พบ Video ID กรุณาตรวจสอบ URL');
                return;
            }
            content = videoId;
            
        } else if (activityType === 'game') {
            content = document.getElementById('gameName').value;
            if (!content) {
                alert('❌ กรุณากรอกชื่อเกม');
                return;
            }
            
        } else if (activityType === 'poll') {
            content = document.getElementById('pollOptions').value;
            if (!content) {
                alert('❌ กรุณากรอกตัวเลือกโหวต');
                return;
            }
        }
        
        console.log('Creating activity:', {
            room_id: window.currentRoomId,
            user_id: window.currentUser.id,
            title,
            description,
            activity_type: activityType,
            content,
            max_participants: maxParticipants
        });
        
        const { data, error } = await supabaseClient.from('activities').insert([{
            room_id: window.currentRoomId,
            user_id: window.currentUser.id,
            title: title,
            description: description,
            activity_type: activityType,
            content: content,
            max_participants: maxParticipants,
            participants_count: 1,
            status: 'active',
            created_at: new Date().toISOString()
        }]).select().single();
        
        if (error) throw error;
        
        console.log('Activity created:', data);
        
        await supabaseClient.from('activity_participants').insert([{
            activity_id: data.id,
            user_id: window.currentUser.id,
            joined_at: new Date().toISOString()
        }]);
        
        if (activityType === 'youtube' && videoId) {
            await supabaseClient.from('activity_sync').insert([{
                activity_id: data.id,
                user_id: window.currentUser.id,
                player_state: 2,
                playback_time: 0,
                video_id: videoId,
                updated_at: new Date().toISOString()
            }]);
        }
        
        alert('✅ สร้างกิจกรรมสำเร็จ!');
        window.closeCreateActivityModal();
        await window.loadActivities();
        
    } catch (error) { 
        console.error('❌ Error creating activity:', error); 
        alert('ไม่สามารถสร้างกิจกรรมได้: ' + error.message); 
    }
};

window.toggleJoinActivity = async function(activityId) {
    try {
        console.log('Toggling join for activity:', activityId);
        
        const { data: existing, error: checkError } = await supabaseClient
            .from('activity_participants')
            .select('*')
            .eq('activity_id', activityId)
            .eq('user_id', window.currentUser.id)
            .maybeSingle();
        
        if (checkError) throw checkError;
        
        if (existing) {
            await supabaseClient
                .from('activity_participants')
                .delete()
                .eq('activity_id', activityId)
                .eq('user_id', window.currentUser.id);
            
        } else {
            await supabaseClient
                .from('activity_participants')
                .insert([{
                    activity_id: activityId,
                    user_id: window.currentUser.id,
                    joined_at: new Date().toISOString()
                }]);
        }
        
        const { data: participants } = await supabaseClient
            .from('activity_participants')
            .select('*')
            .eq('activity_id', activityId);
        
        await supabaseClient
            .from('activities')
            .update({ participants_count: participants.length })
            .eq('id', activityId);
        
        await window.loadActivities();
        
    } catch (error) { 
        console.error('❌ Error joining activity:', error); 
        alert('ไม่สามารถเข้าร่วมกิจกรรมได้: ' + error.message); 
    }
};

window.endActivity = async function(activityId) {
    if (!confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการจบกิจกรรมนี้?')) return;
    
    try {
        await supabaseClient
            .from('activities')
            .update({ 
                status: 'ended', 
                ended_at: new Date().toISOString() 
            })
            .eq('id', activityId);
        
        alert('✅ จบกิจกรรมแล้ว');
        await window.loadActivities();
        
    } catch (error) { 
        console.error('❌ Error ending activity:', error); 
        alert('ไม่สามารถจบกิจกรรมได้: ' + error.message); 
    }
};

window.toggleActivityTypeFields = function() {
    const type = document.getElementById('activityType').value;
    document.getElementById('youtubeField').style.display = type === 'youtube' ? 'block' : 'none';
    document.getElementById('gameField').style.display = type === 'game' ? 'block' : 'none';
    document.getElementById('pollField').style.display = type === 'poll' ? 'block' : 'none';
};

window.showCreateActivityModal = function() {
    const modal = document.getElementById('createActivityModal');
    if (modal) {
        modal.classList.add('active');
        window.toggleActivityTypeFields();
    }
};

window.closeCreateActivityModal = function() {
    const modal = document.getElementById('createActivityModal');
    const form = document.getElementById('createActivityForm');
    if (modal) {
        modal.classList.remove('active');
        if (form) form.reset();
    }
};

// ========== MUSIC PLAYER FUNCTIONS ==========
window.openMusicPlayer = function() {
    document.getElementById('musicPlayerModal')?.classList.add('active');
    window.loadMusicPlaylist();
};

window.closeMusicPlayer = function() {
    document.getElementById('musicPlayerModal')?.classList.remove('active');
};

window.loadMusicPlaylist = async function() {
    if (!window.currentRoomId) return;
    
    try {
        const { data: playlist, error } = await supabaseClient
            .from('room_music')
            .select('*, profiles:user_id(username, display_name)')
            .eq('room_id', window.currentRoomId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('musicPlaylistItems');
        if (!container) return;
        
        if (playlist.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #718096;">🎵 ยังไม่มีเพลงในเพลย์ลิสต์</div>';
            return;
        }
        
        container.innerHTML = playlist.map(song => `
            <div class="playlist-item">
                <div class="playlist-info">
                    <div class="playlist-title">${song.music_title}</div>
                    <div class="playlist-artist">เพิ่มโดย ${song.profiles?.display_name || song.profiles?.username}</div>
                </div>
                <div class="playlist-controls">
                    <button onclick="window.playMusic('${song.id}', '${song.music_url}')" class="playlist-btn">▶️</button>
                    ${song.user_id === window.currentUser.id || window.isAdmin ? 
                        `<button onclick="window.removeMusic('${song.id}')" class="playlist-btn">🗑️</button>` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('❌ Error loading music playlist:', error);
    }
};

window.addMusicToRoom = async function() {
    const urlInput = document.getElementById('musicUrlInput');
    if (!urlInput) return;
    
    const url = urlInput.value.trim();
    if (!url) {
        alert('❌ กรุณาใส่ URL เพลง');
        return;
    }
    
    if (!url.toLowerCase().endsWith('.mp3')) {
        alert('❌ รองรับเฉพาะไฟล์ .mp3 เท่านั้น');
        return;
    }
    
    try {
        const musicInfo = { 
            title: url.split('/').pop() || 'เพลงไม่มีชื่อ', 
            artist: window.currentUser.user_metadata?.username || 'ผู้ใช้' 
        };
        
        const { error } = await supabaseClient.from('room_music').insert([{
            room_id: window.currentRoomId,
            user_id: window.currentUser.id,
            music_url: url,
            music_title: musicInfo.title,
            music_artist: musicInfo.artist,
            is_playing: false
        }]);
        
        if (error) throw error;
        
        urlInput.value = '';
        alert('✅ เพิ่มเพลงสำเร็จ');
        window.loadMusicPlaylist();
        
    } catch (error) { 
        console.error('❌ Error adding music:', error); 
        alert('ไม่สามารถเพิ่มเพลงได้: ' + error.message); 
    }
};

window.playMusic = async function(musicId, url) {
    try {
        if (window.audioPlayer) { 
            window.audioPlayer.pause(); 
            window.audioPlayer = null; 
        }
        
        window.audioPlayer = new Audio(url);
        await window.audioPlayer.play();
        
        window.currentMusic = { id: musicId, url };
        
        const musicBar = document.getElementById('currentMusicBar');
        const musicTitle = document.getElementById('currentMusicTitle');
        const playPauseBtn = document.getElementById('playPauseBtn');
        
        if (musicBar) musicBar.style.display = 'flex';
        if (musicTitle) musicTitle.textContent = document.querySelector(`[onclick*="${musicId}"]`)?.closest('.playlist-item')?.querySelector('.playlist-title')?.textContent || 'กำลังเล่นเพลง...';
        if (playPauseBtn) playPauseBtn.innerHTML = '⏸️';
        
        await supabaseClient.from('room_music').update({ is_playing: true }).eq('id', musicId);
        
    } catch (error) { 
        console.error('❌ Error playing music:', error); 
        alert('ไม่สามารถเล่นเพลงได้: ' + error.message); 
    }
};

window.togglePlayPause = function() {
    if (!window.audioPlayer) return;
    
    const playPauseBtn = document.getElementById('playPauseBtn');
    if (!playPauseBtn) return;
    
    if (window.audioPlayer.paused) { 
        window.audioPlayer.play(); 
        playPauseBtn.innerHTML = '⏸️'; 
    } else { 
        window.audioPlayer.pause(); 
        playPauseBtn.innerHTML = '▶️'; 
    }
};

window.stopMusic = function() {
    if (window.audioPlayer) { 
        window.audioPlayer.pause(); 
        window.audioPlayer.currentTime = 0; 
        window.audioPlayer = null; 
    }
    window.currentMusic = null;
    document.getElementById('currentMusicBar').style.display = 'none';
};

window.hideMusicBar = function() { 
    document.getElementById('currentMusicBar').style.display = 'none'; 
    if (window.audioPlayer) window.audioPlayer.pause();
};

window.removeMusic = async function(musicId) {
    if (!confirm('🗑️ ลบเพลงนี้ออกจากเพลย์ลิสต์?')) return;
    
    try {
        const { error } = await supabaseClient.from('room_music').delete().eq('id', musicId);
        if (error) throw error;
        
        if (window.currentMusic?.id === musicId) window.stopMusic();
        
        alert('✅ ลบเพลงสำเร็จ');
        window.loadMusicPlaylist();
        
    } catch (error) { 
        console.error('❌ Error removing music:', error); 
        alert('ไม่สามารถลบเพลงได้: ' + error.message); 
    }
};

// ========== ROOM MEMBERS FUNCTIONS ==========
window.loadRoomMembers = async function(roomId) {
    if (!roomId) {
        console.log('❌ No room ID provided');
        return;
    }
    
    const container = document.getElementById('membersList');
    if (!container) {
        console.error('❌ Members list container not found');
        return;
    }
    
    container.innerHTML = '<div style="text-align: center; padding: 30px; color: #718096;">⏳ กำลังโหลดสมาชิก...</div>';
    
    try {
        console.log('📥 Loading members for room:', roomId);
        
        const { data: roomData, error: roomError } = await supabaseClient
            .from('rooms')
            .select('owner_id')
            .eq('id', roomId)
            .single();
        
        if (roomError) {
            console.error('❌ Error loading room owner:', roomError);
        }
        
        const roomOwnerId = roomData?.owner_id;
        
        const { data: members, error } = await supabaseClient
            .from('room_members')
            .select(`
                user_id,
                role,
                joined_at
            `)
            .eq('room_id', roomId);
            
        if (error) {
            console.error('❌ Error loading members:', error);
            container.innerHTML = `<div style="text-align: center; padding: 30px; color: #f56565;">❌ ${error.message}</div>`;
            return;
        }
        
        console.log(`📊 Loaded ${members?.length || 0} members`);
        
        if (!members || members.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; color: #718096;">👥 ยังไม่มีสมาชิกในห้องนี้</div>';
            return;
        }
        
        const userIds = members.map(m => m.user_id);
        const { data: profiles, error: profileError } = await supabaseClient
            .from('profiles')
            .select('id, username, display_name, avatar_url, is_admin')
            .in('id', userIds);
        
        if (profileError) {
            console.error('❌ Error loading profiles:', profileError);
        }
        
        const profileMap = {};
        if (profiles) {
            profiles.forEach(profile => {
                profileMap[profile.id] = profile;
            });
        }
        
        const membersWithProfiles = members.map(member => {
            const profile = profileMap[member.user_id] || {};
            return {
                user_id: member.user_id,
                role: member.role,
                joined_at: member.joined_at,
                profile: profile
            };
        });
        
        window.displayRoomMembers(membersWithProfiles, roomOwnerId);
        
    } catch (error) {
        console.error('❌ Error loading members:', error);
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: #f56565;">❌ เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
    }
};

window.displayRoomMembers = function(members, roomOwnerId) {
    const container = document.getElementById('membersList');
    if (!container) return;
    
    const isOwner = window.currentUser?.id === roomOwnerId;
    const isAdmin = window.isAdmin || false;
    
    console.log('🎯 Displaying members:', members);
    
    if (!members || members.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: #718096;">👥 ยังไม่มีสมาชิก</div>';
        return;
    }
    
    const sortedMembers = [...members].sort((a, b) => {
        if (a.user_id === roomOwnerId) return -1;
        if (b.user_id === roomOwnerId) return 1;
        
        if (a.profile?.is_admin && !b.profile?.is_admin) return -1;
        if (!a.profile?.is_admin && b.profile?.is_admin) return 1;
        
        return new Date(b.joined_at) - new Date(a.joined_at);
    });
    
    let html = '';
    
    sortedMembers.forEach(member => {
        const profile = member.profile || {};
        const isCurrentUser = member.user_id === window.currentUser?.id;
        const isOwnerUser = member.user_id === roomOwnerId;
        const canKick = (isOwner || isAdmin) && !isCurrentUser && !isOwnerUser;
        
        const displayName = profile.display_name || profile.username || 'ผู้ใช้';
        
        const joinedDate = member.joined_at ? new Date(member.joined_at).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }) : '';
        
        const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=100`;
        
        let roleBadge = '';
        if (isOwnerUser) {
            roleBadge = '👑 เจ้าของห้อง';
        } else if (profile.is_admin) {
            roleBadge = '👑 แอดมิน';
        } else {
            roleBadge = '👤 สมาชิก';
        }
        
        html += `
            <div class="member-item" data-user-id="${member.user_id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid #e2e8f0;">
                <img src="${avatarUrl}" 
                     alt="${displayName}" 
                     style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=100'">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        ${displayName}
                        ${isCurrentUser ? '<span style="color: #48bb78; font-size: 11px;">(คุณ)</span>' : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #718096; flex-wrap: wrap;">
                        <span>${roleBadge}</span>
                        <span>📅 ${joinedDate}</span>
                    </div>
                </div>
                ${canKick ? `
                    <button class="kick-btn" 
                            onclick="window.showKickModal('${member.user_id}', '${displayName}')"
                            style="padding: 6px 12px; background: #f56565; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                        เตะออก
                    </button>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log('✅ Members displayed:', sortedMembers.length);
};

// ========== DELETE MESSAGES ==========
window.deleteSelectedMessages = async function() {
    if (window.selectedMessages.size === 0) return;
    
    if (!window.isAdminMode) {
        const messageIds = Array.from(window.selectedMessages);
        const { data: messages } = await supabaseClient.from('messages').select('user_id').in('id', messageIds);
        const hasOtherMessages = messages.some(msg => msg.user_id !== window.currentUser.id);
        
        if (hasOtherMessages) {
            alert('❌ คุณสามารถลบได้เฉพาะข้อความของตัวเองเท่านั้น');
            return;
        }
    }
    
    const confirmMsg = window.isAdminMode 
        ? `⚠️ คุณกำลังจะลบ ${window.selectedMessages.size} ข้อความ (ในฐานะแอดมิน)` 
        : `⚠️ คุณกำลังจะลบ ${window.selectedMessages.size} ข้อความของตัวเอง`;
        
    if (!confirm(confirmMsg + '\n\nดำเนินการต่อ?')) return;
    
    try {
        const messageIds = Array.from(window.selectedMessages);
        const { data: userData } = await supabaseClient.from('profiles').select('username, display_name').eq('id', window.currentUser.id).single();
        const deletedByName = userData?.display_name || userData?.username || (window.isAdminMode ? 'แอดมิน' : 'ผู้ใช้');
        
        const { error } = await supabaseClient.from('messages').update({
            is_deleted: true,
            deleted_by: window.currentUser.id,
            deleted_at: new Date().toISOString(),
            message: `[ข้อความถูกลบโดย ${deletedByName}]`
        }).in('id', messageIds);
        
        if (error) throw error;
        
        alert(`✅ ลบ ${messageIds.length} ข้อความสำเร็จ`);
        window.clearSelectedMessages();
        
    } catch (error) {
        console.error('❌ Error deleting messages:', error);
        alert('ไม่สามารถลบข้อความได้: ' + error.message);
    }
};

window.toggleSelectMessage = function(messageId, element) {
    if (window.selectedMessages.has(messageId)) { 
        window.selectedMessages.delete(messageId); 
        element.classList.remove('selected'); 
    } else { 
        window.selectedMessages.add(messageId); 
        element.classList.add('selected'); 
    }
    
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.style.display = window.selectedMessages.size > 0 ? 'flex' : 'none';
        deleteSelectedBtn.innerHTML = `🗑️ ลบ ${window.selectedMessages.size} ข้อความ`;
    }
};

window.clearSelectedMessages = function() {
    window.selectedMessages.clear();
    document.querySelectorAll('.message.selected').forEach(el => el.classList.remove('selected'));
    document.getElementById('deleteSelectedBtn').style.display = 'none';
};

// ========== KICK MODAL ==========
window.showKickModal = function(userId, username) {
    window.kickMemberId = userId;
    document.getElementById('kickMemberName').textContent = `ต้องการเตะ "${username}" ออกจากห้อง?`;
    document.getElementById('kickMemberModal').classList.add('active');
};

window.closeKickModal = function() {
    window.kickMemberId = null;
    document.getElementById('kickMemberModal').classList.remove('active');
};

// ========== JOIN PRIVATE MODAL ==========
window.showJoinPrivateModal = function(room) {
    document.getElementById('joinRoomName').textContent = `ห้อง: ${room.name}`;
    const modal = document.getElementById('joinPrivateRoomModal');
    modal.dataset.roomId = room.id;
    modal.classList.add('active');
};

window.closeJoinPrivateModal = function() {
    document.getElementById('joinPrivateRoomModal').classList.remove('active');
    document.getElementById('joinRoomPassword').value = '';
};

// ========== DELETE ROOM MODAL ==========
window.showDeleteRoomModal = function() {
    if (!window.currentRoom) return;
    document.getElementById('deleteRoomName').innerHTML = `ต้องการลบห้อง: <strong>${window.currentRoom.name}</strong>?`;
    document.getElementById('deleteRoomModal').classList.add('active');
};

window.closeDeleteRoomModal = function() { 
    document.getElementById('deleteRoomModal').classList.remove('active'); 
};

// ========== ADMIN MODE FUNCTIONS ==========
window.toggleAdminMode = function() {
    if (!window.isAdmin) {
        alert('❌ คุณไม่มีสิทธิ์ใช้งานโหมดแอดมิน');
        return;
    }
    
    window.isAdminMode = !window.isAdminMode;
    
    const adminBtn = document.getElementById('adminModeBtn');
    if (adminBtn) {
        adminBtn.innerHTML = window.isAdminMode ? '👑 แอดมิน (เปิด)' : '👑 แอดมิน (ปิด)';
        adminBtn.style.background = window.isAdminMode ? '#f56565' : '';
    }
    
    console.log(`Admin mode: ${window.isAdminMode ? 'ON' : 'OFF'}`);
    window.debug(`โหมดแอดมิน: ${window.isAdminMode ? 'เปิด' : 'ปิด'}`);
    
    if (!window.isAdminMode) {
        window.clearSelectedMessages();
    }
};

// ========== CREATE ROOM FUNCTIONS ==========
window.createRoom = async function(event) {
    event.preventDefault();
    
    try {
        const name = document.getElementById('roomName').value.trim();
        const description = document.getElementById('roomDescription').value.trim();
        const roomType = document.getElementById('roomType').value;
        const password = document.getElementById('roomPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!name) {
            alert('❌ กรุณากรอกชื่อห้อง');
            return;
        }
        
        if (roomType === 'private') {
            if (!password) {
                alert('❌ กรุณากรอกรหัสผ่านสำหรับห้องส่วนตัว');
                return;
            }
            if (password !== confirmPassword) {
                alert('❌ รหัสผ่านไม่ตรงกัน');
                return;
            }
        }
        
        const { data, error } = await supabaseClient.from('rooms').insert([{
            name: name,
            description: description,
            room_type: roomType,
            password: roomType === 'private' ? password : null,
            owner_id: window.currentUser.id,
            created_at: new Date().toISOString()
        }]).select().single();
        
        if (error) throw error;
        
        await supabaseClient.from('room_members').insert([{
            room_id: data.id,
            user_id: window.currentUser.id,
            role: 'owner',
            joined_at: new Date().toISOString()
        }]);
        
        alert('✅ สร้างห้องสำเร็จ');
        window.closeCreateRoomModal();
        window.loadRooms();
        window.selectRoom(data.id);
        
    } catch (error) {
        console.error('❌ Error creating room:', error);
        alert('ไม่สามารถสร้างห้องได้: ' + error.message);
    }
};

// ========== JOIN PRIVATE ROOM ==========
window.confirmJoinPrivateRoom = async function() {
    const modal = document.getElementById('joinPrivateRoomModal');
    const roomId = modal.dataset.roomId;
    const password = document.getElementById('joinRoomPassword').value;
    
    if (!password) {
        alert('❌ กรุณากรอกรหัสผ่าน');
        return;
    }
    
    try {
        const { data: room, error } = await supabaseClient
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();
        
        if (error) throw error;
        
        if (room.password !== password) {
            alert('❌ รหัสผ่านไม่ถูกต้อง');
            return;
        }
        
        await supabaseClient.from('room_members').insert([{
            room_id: roomId,
            user_id: window.currentUser.id,
            role: 'member',
            joined_at: new Date().toISOString()
        }]);
        
        alert('✅ เข้าร่วมห้องสำเร็จ');
        window.closeJoinPrivateModal();
        window.selectRoom(roomId);
        
    } catch (error) {
        console.error('❌ Error joining room:', error);
        alert('ไม่สามารถเข้าร่วมห้องได้: ' + error.message);
    }
};

// ========== DELETE ROOM ==========
window.confirmDeleteRoom = async function() {
    if (!window.currentRoom) return;
    
    try {
        const { error } = await supabaseClient
            .from('rooms')
            .delete()
            .eq('id', window.currentRoom.id);
        
        if (error) throw error;
        
        alert('✅ ลบห้องสำเร็จ');
        window.closeDeleteRoomModal();
        await window.selectRoom(PUBLIC_ROOM_ID);
        window.loadRooms();
        
    } catch (error) {
        console.error('❌ Error deleting room:', error);
        alert('ไม่สามารถลบห้องได้: ' + error.message);
    }
};

// ========== KICK MEMBER ==========
window.confirmKickMember = async function() {
    if (!window.kickMemberId || !window.currentRoomId) return;
    
    try {
        const { error } = await supabaseClient
            .from('room_members')
            .delete()
            .eq('room_id', window.currentRoomId)
            .eq('user_id', window.kickMemberId);
        
        if (error) throw error;
        
        alert('✅ เตะสมาชิกออกจากห้องแล้ว');
        window.closeKickModal();
        await window.loadRoomMembers(window.currentRoomId);
        
    } catch (error) {
        console.error('❌ Error kicking member:', error);
        alert('ไม่สามารถเตะสมาชิกได้: ' + error.message);
    }
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.messagesContainer = document.getElementById('messagesContainer');
        window.messageInput = document.getElementById('messageInput');
        window.sendButton = document.getElementById('sendButton');

        window.currentUser = await window.checkUser();
        if (!window.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        console.log('✅ User logged in:', window.currentUser.email);
        
        window.setupSessionManager();
        await window.checkAdminStatus();
        window.displayUserInfo();
        await window.loadRooms();
        
        const lastRoomId = localStorage.getItem(STORAGE_KEY);
        const initialRoomId = lastRoomId || PUBLIC_ROOM_ID;
        
        await window.selectRoom(initialRoomId);
        
        setTimeout(() => {
            window.loadActivities();
        }, 500);
        
        window.setupEventListeners();
        
        setTimeout(() => {
            window.loadYouTubeAPI();
        }, 1000);

        console.log('✅ Chat initialized');
        
    } catch (error) {
        console.error('❌ Init error:', error);
        window.location.href = 'login.html';
    }
});

// ========== LOAD ROOMS ==========
window.loadRooms = async function(filter = 'all') {
    try {
        let query = supabaseClient.from('rooms')
            .select('*, owner:owner_id(username, display_name), room_members(user_id, role)')
            .order('created_at', { ascending: false });
        
        if (filter === 'public') query = query.eq('room_type', 'public');
        else if (filter === 'private') query = query.eq('room_type', 'private');
        
        const { data: rooms, error } = await query;
        if (error) throw error;
        window.displayRooms(rooms);
    } catch (error) {
        console.error('❌ Error loading rooms:', error);
    }
};

window.displayRooms = function(rooms) {
    const roomList = document.getElementById('roomList');
    if (!roomList) return;
    if (rooms.length === 0) {
        roomList.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #a0aec0;">📭 ยังไม่มีห้องแชท<br><small>คลิก "สร้างห้องใหม่" เพื่อเริ่มต้น</small></div>';
        return;
    }
    roomList.innerHTML = rooms.map(room => {
        const isOwner = room.owner_id === window.currentUser?.id;
        const memberCount = room.room_members?.length || 0;
        const isActive = window.currentRoomId === room.id;
        return `<div class="room-item ${isActive ? 'active' : ''}" onclick="window.selectRoom('${room.id}')">
            <div class="room-header">
                <span class="room-name">${room.room_type === 'private' ? '🔒' : '🌍'} ${room.name}</span>
                <span class="room-type-badge">${room.room_type === 'private' ? 'ส่วนตัว' : 'สาธารณะ'}</span>
            </div>
            <div class="room-meta">
                <span>👤 ${room.owner?.display_name || 'ไม่มีเจ้าของ'}</span>
                <span>👥 ${memberCount} คน</span>
                ${isOwner ? '<span style="color: #48bb78;">👑 เจ้าของ</span>' : ''}
            </div>
            ${room.description ? `<small style="color: #718096;">${room.description}</small>` : ''}
        </div>`;
    }).join('');
};

// ========== PANEL MANAGEMENT ==========
window.hideAllPanels = function() {
    console.log('🔍 Hiding all panels...');
    
    const membersPanel = document.getElementById('membersPanel');
    if (membersPanel) {
        membersPanel.classList.remove('active');
        console.log('✅ Members panel hidden');
    }
    
    const activitiesPanel = document.getElementById('activitiesPanel');
    if (activitiesPanel) {
        activitiesPanel.classList.remove('active');
        console.log('✅ Activities panel hidden');
    }
    
    const roomsPanel = document.querySelector('.rooms-panel');
    if (roomsPanel) {
        roomsPanel.classList.remove('mobile-active');
        console.log('✅ Rooms panel mobile hidden');
    }
    
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        console.log('✅ Overlay hidden');
    }
    
    document.body.classList.remove('sidebar-open');
};

// ========== TOGGLE FUNCTIONS ==========
window.toggleMembersPanel = function() {
    const panel = document.getElementById('membersPanel');
    const activitiesPanel = document.getElementById('activitiesPanel');
    const roomsPanel = document.querySelector('.rooms-panel');
    
    if (!panel) return;
    
    console.log('Toggling members panel, current active:', panel.classList.contains('active'));
    
    if (panel.classList.contains('active')) {
        panel.classList.remove('active');
        console.log('👥 Members panel closed');
    } else {
        if (activitiesPanel) {
            activitiesPanel.classList.remove('active');
        }
        if (roomsPanel) {
            roomsPanel.classList.remove('mobile-active');
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) overlay.classList.remove('active');
        }
        panel.classList.add('active');
        console.log('👥 Members panel opened');
        
        if (window.currentRoomId) {
            window.loadRoomMembers(window.currentRoomId);
        } else {
            document.getElementById('membersList').innerHTML = 
                '<div style="text-align: center; padding: 20px; color: #718096;">❌ ไม่ได้เลือกห้อง</div>';
        }
    }
};

window.toggleActivitiesPanel = function() {
    const panel = document.getElementById('activitiesPanel');
    const membersPanel = document.getElementById('membersPanel');
    const roomsPanel = document.querySelector('.rooms-panel');
    
    if (!panel) return;
    
    console.log('Toggling activities panel, current active:', panel.classList.contains('active'));
    
    if (panel.classList.contains('active')) {
        panel.classList.remove('active');
        console.log('🎮 Activities panel closed');
    } else {
        if (membersPanel) {
            membersPanel.classList.remove('active');
        }
        if (roomsPanel) {
            roomsPanel.classList.remove('mobile-active');
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) overlay.classList.remove('active');
        }
        panel.classList.add('active');
        console.log('🎮 Activities panel opened');
        
        if (window.currentRoomId) {
            window.loadActivities();
        }
    }
};

window.toggleMobileSidebar = function() {
    const sidebar = document.querySelector('.rooms-panel');
    const overlay = document.getElementById('sidebarOverlay');
    const membersPanel = document.getElementById('membersPanel');
    const activitiesPanel = document.getElementById('activitiesPanel');
    
    if (!sidebar) return;
    
    console.log('Toggling mobile sidebar, current active:', sidebar.classList.contains('mobile-active'));
    
    if (sidebar.classList.contains('mobile-active')) {
        sidebar.classList.remove('mobile-active');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        console.log('✅ Mobile sidebar closed');
    } else {
        if (membersPanel) membersPanel.classList.remove('active');
        if (activitiesPanel) activitiesPanel.classList.remove('active');
        
        sidebar.classList.add('mobile-active');
        if (overlay) overlay.classList.add('active');
        document.body.classList.add('sidebar-open');
        console.log('✅ Mobile sidebar opened');
    }
};

// ========== SELECT ROOM (พร้อม Realtime) ==========
window.selectRoom = async function(roomId) {
    try {
        console.log('Selecting room:', roomId);
        
        const { data: room, error } = await supabaseClient
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();
            
        if (error) throw error;
        
        if (room.room_type === 'private' && room.owner_id !== window.currentUser?.id) {
            const { data: existingMember } = await supabaseClient
                .from('room_members')
                .select('*')
                .eq('room_id', roomId)
                .eq('user_id', window.currentUser.id)
                .maybeSingle();
            
            if (!existingMember) {
                window.showJoinPrivateModal(room);
                return;
            }
        }
        
        window.currentRoom = room;
        window.currentRoomId = room.id;
        
        localStorage.setItem(STORAGE_KEY, room.id);
        
        const titleEl = document.getElementById('currentRoomTitle');
        const badgeEl = document.getElementById('currentRoomTypeBadge');
        const inputArea = document.getElementById('messageInputArea');
        const roomActions = document.getElementById('roomActions');
        
        if (titleEl) {
            titleEl.innerHTML = `${room.room_type === 'private' ? '🔒' : '💬'} ${room.name}`;
        }
        if (badgeEl) {
            badgeEl.textContent = room.room_type === 'private' ? 'ส่วนตัว' : 'สาธารณะ';
        }
        if (inputArea) {
            inputArea.style.display = 'block';
        }
        
        if (roomActions) {
            if (room.owner_id === window.currentUser?.id || window.isAdmin) {
                roomActions.innerHTML = `
                    <button class="delete-room-btn" onclick="window.showDeleteRoomModal()">
                        🗑️ ลบห้อง
                    </button>
                `;
            } else {
                roomActions.innerHTML = '';
            }
        }
        
        // โหลดข้อความเก่า
        await window.loadMessages(room.id);
        
        // ตั้งค่า Realtime subscription สำหรับห้องนี้
        await window.setupRealtimeSubscription(room.id);
        
        // โหลดข้อมูลอื่นๆ
        await window.loadYoutubePlaylist();
        await window.loadActivities();
        await window.loadRoomMembers(room.id);
        await window.loadRooms();
        
        window.hideAllPanels();
        
        console.log('✅ Room selected:', room.name);
        
    } catch (error) {
        console.error('❌ Error selecting room:', error);
        alert('ไม่สามารถเลือกห้องได้: ' + error.message);
    }
};

window.loadMessages = async function(roomId) {
    try {
        if (!window.messagesContainer) return;
        
        const { data: messages, error } = await supabaseClient.from('messages')
            .select('*, profiles:user_id(username, display_name, avatar_url)')
            .eq('room_id', roomId).order('created_at', { ascending: true }).limit(50);
        
        if (error) throw error;
        
        window.messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            window.messagesContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #a0aec0;">💬 ยังไม่มีข้อความ<br><small>เริ่มต้นแชทกันเลย!</small></div>';
        } else {
            messages.forEach(msg => window.displayMessage(msg));
        }
        
        window.scrollToBottom();
    } catch (error) {
        console.error('❌ Error loading messages:', error);
    }
};

window.displayMessage = function(message) {
    if (!window.messagesContainer) return;
    
    const isOwnMessage = message.user_id === window.currentUser?.id;
    const author = message.profiles?.display_name || message.profiles?.username || 'ผู้ใช้';
    const avatarUrl = message.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=667eea&color=fff`;
    
    let messageText = message.message || '';
    let imageHtml = '';
    const imageMatch = messageText.match(/\[IMAGE\](.*?)\[\/IMAGE\]/);
    if (imageMatch) {
        const imageUrl = imageMatch[1];
        imageHtml = `<img src="${imageUrl}" class="message-image" onclick="window.openLightbox('${imageUrl}')">`;
        messageText = messageText.replace(/\[IMAGE\].*?\[\/IMAGE\]/, '').trim();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'own-message' : ''}`;
    messageDiv.dataset.messageId = message.id;
    
    if (message.is_deleted) {
        messageDiv.classList.add('deleted-message');
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="deleted-content">
                    <span>🗑️</span>
                    <span>${message.message || '[ข้อความถูกลบ]'}</span>
                </div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <img src="${avatarUrl}" alt="${author}" class="message-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=667eea&color=fff'">
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${author}</span>
                    <span class="message-time">${window.formatTime(message.created_at)}</span>
                </div>
                ${messageText ? `<div class="message-body">${window.linkify(messageText)}</div>` : ''}
                ${imageHtml}
            </div>
        `;
    }
    
    window.messagesContainer.appendChild(messageDiv);
    window.scrollToBottom();
};

// ========== SEND MESSAGE ==========
window.sendMessage = async function() {
    const message = window.messageInput.value.trim();
    const hasImage = window.selectedImageFile !== null;
    if (!message && !hasImage) return;
    if (!window.currentRoomId) { 
        alert('❌ กรุณาเลือกห้องก่อนส่งข้อความ'); 
        return; 
    }
    
    try {
        let imageUrl = null;
        if (hasImage) {
            const fileExt = window.selectedImageFile.name.split('.').pop();
            const fileName = `${window.currentUser.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabaseClient.storage.from('chat_files').upload(fileName, window.selectedImageFile);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabaseClient.storage.from('chat_files').getPublicUrl(fileName);
            imageUrl = publicUrl;
        }
        
        const messageText = imageUrl ? `${message} [IMAGE]${imageUrl}[/IMAGE]` : message;
        
        // ส่งข้อความ
        const { error } = await supabaseClient.from('messages').insert([{
            user_id: window.currentUser.id,
            room_id: window.currentRoomId,
            message: messageText,
            created_at: new Date().toISOString()
        }]);
        
        if (error) throw error;
        
        // เคลียร์ input
        window.messageInput.value = '';
        window.clearImagePreview(); // ตอนนี้ฟังก์ชันนี้ถูกประกาศไว้ก่อนแล้ว
        
    } catch (error) {
        console.error('❌ Error sending message:', error);
        alert('ไม่สามารถส่งข้อความได้: ' + error.message);
    }
};

// ========== CHECK ADMIN STATUS ==========
window.checkAdminStatus = async function() {
    try {
        if (!window.currentUser) return false;
        const { data, error } = await supabaseClient.from('profiles').select('is_admin').eq('id', window.currentUser.id).single();
        if (error) throw error;
        window.isAdmin = data?.is_admin || false;
        const adminBtn = document.getElementById('adminModeBtn');
        if (adminBtn) {
            adminBtn.style.display = window.isAdmin ? 'inline-block' : 'none';
            if (window.isAdmin) {
                adminBtn.innerHTML = '👑 แอดมิน (ปิด)';
                adminBtn.style.background = '';
            }
        }
        return window.isAdmin;
    } catch (error) { 
        console.error('Error checking admin status:', error);
        return false; 
    }
};

// ========== PROFILE MANAGEMENT ==========
window.showProfileModal = async function() {
    console.log('Opening profile modal');
    
    if (!window.currentUser) {
        alert('❌ ไม่พบข้อมูลผู้ใช้');
        return;
    }
    
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', window.currentUser.id)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        const displayNameInput = document.getElementById('profileDisplayName');
        const usernameInput = document.getElementById('profileUsername');
        const emailInput = document.getElementById('profileEmail');
        const avatarPreview = document.getElementById('profileAvatarPreview');
        
        if (displayNameInput) {
            displayNameInput.value = profile?.display_name || window.currentUser.user_metadata?.display_name || '';
        }
        
        if (usernameInput) {
            usernameInput.value = profile?.username || window.currentUser.user_metadata?.username || '';
        }
        
        if (emailInput) {
            emailInput.value = window.currentUser.email || '';
        }
        
        const avatarUrl = profile?.avatar_url || 
                         window.currentUser.user_metadata?.avatar_url || 
                         `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || profile?.username || window.currentUser.email?.split('@')[0] || 'User')}&background=667eea&color=fff&size=200`;
        
        if (avatarPreview) {
            avatarPreview.src = avatarUrl;
        }
        
        window.currentAvatarUrl = avatarUrl;
        
        const modal = document.getElementById('profileEditModal');
        if (modal) {
            modal.classList.add('active');
        }
        
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        alert('ไม่สามารถโหลดข้อมูลโปรไฟล์ได้: ' + error.message);
    }
};

window.closeProfileModal = function() {
    const modal = document.getElementById('profileEditModal');
    if (modal) {
        modal.classList.remove('active');
    }
    window.selectedProfileImage = null;
};

window.uploadProfileImage = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('❌ รูปภาพต้องมีขนาดไม่เกิน 2MB');
                return;
            }
            
            window.selectedProfileImage = file;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('profileAvatarPreview');
                if (preview) {
                    preview.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
};

window.updateProfile = async function(event) {
    event.preventDefault();
    
    const displayName = document.getElementById('profileDisplayName')?.value.trim();
    const username = document.getElementById('profileUsername')?.value.trim();
    
    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
        alert('❌ ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข และ _ เท่านั้น');
        return;
    }
    
    try {
        let avatarUrl = window.currentAvatarUrl;
        
        if (window.selectedProfileImage) {
            const fileExt = window.selectedProfileImage.name.split('.').pop();
            const fileName = `avatars/${window.currentUser.id}/${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('chat_files')
                .upload(fileName, window.selectedProfileImage);
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabaseClient.storage
                .from('chat_files')
                .getPublicUrl(fileName);
            
            avatarUrl = publicUrl;
        }
        
        // อัปเดตโปรไฟล์ในตาราง profiles
        const updates = {
            id: window.currentUser.id,
            display_name: displayName || null,
            username: username || null,
            avatar_url: avatarUrl
        };
        
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .upsert(updates);
        
        if (updateError) throw updateError;
        
        const { error: metadataError } = await supabaseClient.auth.updateUser({
            data: {
                display_name: displayName,
                username: username,
                avatar_url: avatarUrl
            }
        });
        
        if (metadataError) throw metadataError;
        
        window.currentUser.user_metadata = {
            ...window.currentUser.user_metadata,
            display_name: displayName,
            username: username,
            avatar_url: avatarUrl
        };
        
        window.displayUserInfo();
        
        alert('✅ อัปเดตโปรไฟล์สำเร็จ');
        window.closeProfileModal();
        
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        alert('ไม่สามารถอัปเดตโปรไฟล์ได้: ' + error.message);
    }
};

// ========== PASSWORD MANAGEMENT ==========
window.showPasswordModal = function() {
    const profileModal = document.getElementById('profileEditModal');
    const passwordModal = document.getElementById('passwordChangeModal');
    
    if (profileModal) {
        profileModal.classList.remove('active');
    }
    
    if (passwordModal) {
        passwordModal.classList.add('active');
    }
};

window.closePasswordModal = function() {
    const modal = document.getElementById('passwordChangeModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.getElementById('passwordChangeForm')?.reset();
};

window.changePassword = async function(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword')?.value;
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmNewPassword = document.getElementById('confirmNewPassword')?.value;
    
    if (newPassword !== confirmNewPassword) {
        alert('❌ รหัสผ่านใหม่ไม่ตรงกัน');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('❌ รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
        return;
    }
    
    try {
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
            email: window.currentUser.email,
            password: currentPassword
        });
        
        if (signInError) {
            alert('❌ รหัสผ่านปัจจุบันไม่ถูกต้อง');
            return;
        }
        
        const { error: updateError } = await supabaseClient.auth.updateUser({
            password: newPassword
        });
        
        if (updateError) throw updateError;
        
        alert('✅ เปลี่ยนรหัสผ่านสำเร็จ');
        window.closePasswordModal();
        
    } catch (error) {
        console.error('❌ Error changing password:', error);
        alert('ไม่สามารถเปลี่ยนรหัสผ่านได้: ' + error.message);
    }
};

// ========== DISPLAY USER INFO ==========
window.displayUserInfo = function() {
    const userProfile = document.getElementById('userProfile');
    if (!userProfile || !window.currentUser) return;
    
    const username = window.currentUser.user_metadata?.display_name || 
                     window.currentUser.user_metadata?.username || 
                     window.currentUser.email?.split('@')[0] || 'ผู้ใช้';
    
    const avatarUrl = window.currentUser.user_metadata?.avatar_url || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=667eea&color=fff&size=100`;
    
    userProfile.innerHTML = `
        <div class="profile-clickable" onclick="window.showProfileModal()" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 12px; border-radius: var(--radius-xl); transition: all 0.2s; border: 1px solid transparent;">
            <img src="${avatarUrl}" alt="${username}" class="avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=667eea&color=fff&size=100'">
            <span class="username">${username} ${window.isAdmin ? '👑' : ''}</span>
        </div>
    `;
    
    const profileDiv = userProfile.querySelector('.profile-clickable');
    if (profileDiv) {
        profileDiv.addEventListener('mouseenter', function() {
            this.style.background = 'var(--bg-light)';
        });
        profileDiv.addEventListener('mouseleave', function() {
            this.style.background = 'transparent';
        });
    }
};

// ========== EVENT LISTENERS ==========
window.setupEventListeners = function() {
    if (window.sendButton) { 
        window.sendButton.addEventListener('click', window.sendMessage); 
    }
    if (window.messageInput) {
        window.messageInput.addEventListener('keydown', function(e) { 
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                window.sendMessage(); 
            } 
        });
        window.messageInput.addEventListener('input', function() {
            const count = this.value.length;
            const charCount = document.getElementById('charCount');
            if (charCount) charCount.textContent = `${count}/500`;
            if (count > 500) this.value = this.value.slice(0, 500);
        });
    }
    
    const createRoomForm = document.getElementById('createRoomForm');
    if (createRoomForm) { 
        createRoomForm.addEventListener('submit', window.createRoom); 
    }
    
    const createActivityForm = document.getElementById('createActivityForm');
    if (createActivityForm) {
        createActivityForm.addEventListener('submit', window.createActivity);
    }
    
    const searchInput = document.getElementById('youtubeSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            if (window.searchTimeout) clearTimeout(window.searchTimeout);
            window.searchTimeout = setTimeout(() => {
                if (this.value.trim().length >= 3) window.searchYoutube();
            }, 500);
        });
    }
    
    const adminBtn = document.getElementById('adminModeBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', window.toggleAdminMode);
    }
};

// ========== EMOJI FUNCTIONS ==========
window.openEmojiPicker = function() {
    const modal = document.getElementById('emojiPickerModal');
    const grid = document.getElementById('emojiGrid');
    if (!modal || !grid) return;
    grid.innerHTML = emojiList.map(emoji => `<div class="emoji-item" onclick="window.insertEmoji('${emoji}')">${emoji}</div>`).join('');
    modal.classList.add('active');
};

window.closeEmojiPicker = function() { 
    document.getElementById('emojiPickerModal')?.classList.remove('active'); 
};

window.insertEmoji = function(emoji) { 
    if (window.messageInput) { 
        window.messageInput.value += emoji; 
        window.messageInput.focus(); 
        window.closeEmojiPicker(); 
    } 
};

// ========== MODAL FUNCTIONS ==========
window.showCreateRoomModal = function() { 
    document.getElementById('createRoomModal')?.classList.add('active'); 
};

window.closeCreateRoomModal = function() {
    const modal = document.getElementById('createRoomModal');
    const form = document.getElementById('createRoomForm');
    const passwordField = document.getElementById('passwordField');
    if (modal) modal.classList.remove('active');
    if (form) form.reset();
    if (passwordField) passwordField.classList.remove('show');
};

window.togglePasswordField = function() {
    const roomType = document.getElementById('roomType');
    const passwordField = document.getElementById('passwordField');
    if (roomType && passwordField) passwordField.classList.toggle('show', roomType.value === 'private');
};

// ========== MODAL EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', function() {
    const savedAutoPlay = localStorage.getItem('autoPlayNext');
    if (savedAutoPlay !== null) {
        autoPlayNext = savedAutoPlay === 'true';
    }
    
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
    
    document.getElementById('addToPlaylistModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            window.closeAddToPlaylistModal();
        }
    });
    
    document.getElementById('youtubePlaylistModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            window.closeYoutubePlaylist();
        }
    });
    
    document.getElementById('youtubePlayerModal')?.addEventListener('click', function(e) {
        // ไม่ปิด YouTube Player เมื่อคลิกพื้นหลัง
    });
    
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', function() {
            const sidebar = document.querySelector('.rooms-panel');
            if (sidebar) {
                sidebar.classList.remove('mobile-active');
            }
            overlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        });
    }
    
    const membersPanel = document.getElementById('membersPanel');
    const activitiesPanel = document.getElementById('activitiesPanel');
    
    if (membersPanel) {
        membersPanel.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    if (activitiesPanel) {
        activitiesPanel.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    const chatContent = document.querySelector('.chat-content');
    if (chatContent) {
        chatContent.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                const membersPanel = document.getElementById('membersPanel');
                const activitiesPanel = document.getElementById('activitiesPanel');
                const roomsPanel = document.querySelector('.rooms-panel');
                const overlay = document.getElementById('sidebarOverlay');
                
                if (membersPanel && membersPanel.classList.contains('active')) {
                    membersPanel.classList.remove('active');
                }
                if (activitiesPanel && activitiesPanel.classList.contains('active')) {
                    activitiesPanel.classList.remove('active');
                }
                if (roomsPanel && roomsPanel.classList.contains('mobile-active')) {
                    roomsPanel.classList.remove('mobile-active');
                }
                if (overlay && overlay.classList.contains('active')) {
                    overlay.classList.remove('active');
                }
                document.body.classList.remove('sidebar-open');
            }
        });
    }
});
