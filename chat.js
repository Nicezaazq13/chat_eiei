// ========== script.js ==========
// ========== CONFIGURATION ==========
const SUPABASE_URL = 'https://xaugtjljfkjqfpmnsxko.supabase.co';
// ✅ ใช้ API Key จริง (อันนี้คือ key จริงที่ได้จาก Dashboard)
const SUPABASE_ANON_KEY = 'sb_publishable_bBVN1rHJyBJN_KswV_skAQ_XYwPsvsy';

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

// YouTube Variables
window.youtubePlayer = null;
window.youtubePlayerReady = false;
window.youtubeApiReady = false;
window.youtubeActivityId = null;
window.youtubeLoadAttempts = 0;

// YouTube Playlist Variables - โหลดจาก localStorage ทันที
window.youtubePlaylist = [];
window.searchTimeout = null;
let currentVideoId = null;
let currentVideoTitle = '';
let currentVideoChannel = '';
let autoPlayNext = true;

const PUBLIC_ROOM_ID = '00000000-0000-0000-0000-000000000000';
const STORAGE_KEY = 'chat_last_room_id';

const emojiList = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'];

// ========== DEBUG FUNCTION ==========
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
        
        const expiresAt = session.expires_at;
        if (expiresAt && Date.now() / 1000 > expiresAt) {
            console.log('Session expired, refreshing...');
            const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
            if (refreshError || !refreshData.session) {
                console.error('Refresh failed:', refreshError);
                return null;
            }
            return refreshData.user;
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
            
            const expiresAt = session.expires_at;
            const timeUntilExpiry = expiresAt - (Date.now() / 1000);
            
            if (timeUntilExpiry < 600) {
                console.log('Refreshing session...');
                await supabaseClient.auth.refreshSession();
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
    
    // โหลด playlist ปัจจุบัน
    const savedPlaylist = localStorage.getItem(`youtube_playlist_${window.currentRoomId}`);
    let playlist = savedPlaylist ? JSON.parse(savedPlaylist) : [];
    
    // ตรวจสอบซ้ำ
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
    
    // เพิ่มเข้า array
    playlist.unshift(newItem);
    
    // บันทึกลง localStorage
    localStorage.setItem(`youtube_playlist_${window.currentRoomId}`, JSON.stringify(playlist));
    console.log('✅ Saved to localStorage, total:', playlist.length);
    
    // อัพเดทตัวแปร global
    window.youtubePlaylist = playlist;
    
    window.closeAddToPlaylistModal();
    
    // อัพเดท UI
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

// ฟังก์ชันสำหรับโหลด playlist จาก localStorage เท่านั้น (ไม่ต้องใช้ DB)
window.loadYoutubePlaylist = async function() {
    if (!window.currentRoomId) {
        console.log('No room selected');
        return;
    }
    
    try {
        console.log('Loading playlist for room:', window.currentRoomId);
        
        // ✅ โหลดจาก localStorage เท่านั้น
        const savedPlaylist = localStorage.getItem(`youtube_playlist_${window.currentRoomId}`);
        window.youtubePlaylist = savedPlaylist ? JSON.parse(savedPlaylist) : [];
        
        console.log(`✅ Loaded ${window.youtubePlaylist.length} items from localStorage`);
        
        // อัพเดท UI
        window.displayYoutubePlaylist(window.youtubePlaylist);
        
        // ถ้า YouTube Player เปิดอยู่ ให้อัพเดทเพลย์ลิสต์ด้วย
        if (document.getElementById('youtubePlayerModal').classList.contains('active')) {
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
    
    // ตรวจสอบซ้ำ
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
    
    // เพิ่มเข้า array
    window.youtubePlaylist.unshift(newItem);
    
    // ✅ บันทึกลง localStorage
    localStorage.setItem(`youtube_playlist_${window.currentRoomId}`, JSON.stringify(window.youtubePlaylist));
    console.log('✅ Saved to localStorage, total:', window.youtubePlaylist.length);
    
    // อัพเดท UI
    window.displayYoutubePlaylist(window.youtubePlaylist);
    
    // อัพเดท YouTube Player ถ้ากำลังเปิดอยู่
    if (document.getElementById('youtubePlayerModal').classList.contains('active')) {
        window.displayYoutubePlayerPlaylist();
    }
    
    // อัพเดทปุ่มในผลการค้นหา
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
    
    // ลบจาก array
    window.youtubePlaylist = window.youtubePlaylist.filter(item => item.id !== playlistId);
    
    // ✅ อัพเดท localStorage
    localStorage.setItem(`youtube_playlist_${window.currentRoomId}`, JSON.stringify(window.youtubePlaylist));
    
    // อัพเดท UI
    window.displayYoutubePlaylist(window.youtubePlaylist);
    window.displayYoutubePlayerPlaylist();
    
    // อัพเดทปุ่มในผลการค้นหา
    const addBtn = document.querySelector(`.search-result-add[onclick*="${itemToRemove.video_id}"]`);
    if (addBtn) {
        addBtn.classList.remove('added');
        addBtn.textContent = '➕ เพิ่ม';
        addBtn.style.background = 'var(--primary-color)';
    }
    
    alert('✅ ลบคลิปออกจากเพลย์ลิสต์แล้ว');
};

document.addEventListener('DOMContentLoaded', function() {
    const savedAutoPlay = localStorage.getItem('autoPlayNext');
    if (savedAutoPlay !== null) {
        autoPlayNext = savedAutoPlay === 'true';
    }
    
    // เพิ่ม event listener เพื่อป้องกันการคลิกทะลุ
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
    
    const addModal = document.getElementById('addToPlaylistModal');
    if (addModal) {
        addModal.addEventListener('click', function(e) {
            if (e.target === this) {
                window.closeAddToPlaylistModal();
            }
        });
    }
    
    const playlistModal = document.getElementById('youtubePlaylistModal');
    if (playlistModal) {
        playlistModal.addEventListener('click', function(e) {
            if (e.target === this) {
                window.closeYoutubePlaylist();
            }
        });
    }
});

// ========== ACTIVITIES FUNCTIONS (คงเดิม) ==========
// ... (โค้ดส่วน activities, music, rooms, ฯลฯ คงเดิมทั้งหมด)
