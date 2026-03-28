const CLOUD_NAME = 'dncftuhoo', UPLOAD_PRESET = 'cemabyss', SUPABASE_URL = 'https://xqvvwejwkmqdmsorqdzp.supabase.co', SUPABASE_KEY = 'sb_publishable_WLR6XzQijI3h1-oWa6T-mg_FeolGe9z';
const DEV_USERS = ["Zoro", "Redtree1222", "redtree"];
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = localStorage.getItem('cem_user'), allVideos = [], allProfiles = [], allRanks = [], allSettings = [], allAudit = [], currentCtx = 'home', authMode = 'login', activeVideo = null, editingId = null;

function toggleSidebar() {
    document.getElementById('side-bar').classList.toggle('open');
    document.getElementById('side-overlay').style.display = document.getElementById('side-bar').classList.contains('open') ? 'block' : 'none';
}
function closeSidebar() {
    document.getElementById('side-bar').classList.remove('open');
    document.getElementById('side-overlay').style.display = 'none';
}
function logout() { localStorage.removeItem('cem_user'); location.reload(); }

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('auth-title').innerText = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('auth-toggle').innerText = authMode === 'login' ? 'No account? Register' : 'Have an account? Login';
}

function getCol(n) { let h = 0; if (n) { for (let i = 0; i < n.length; i++)h = n.charCodeAt(i) + ((h << 5) - h); } return `hsl(${Math.abs(h) % 360}, 70%, 60%)`; }
function getAvatarStyle(u) { const p = allProfiles.find(x => x.username === u); if (p && p.avatar_url) return `background:url('${p.avatar_url}') center/cover;color:transparent;`; return `background:${getCol(u)};`; }

function formatName(u) {
    const p = allProfiles.find(x => x.username === u);
    const dName = (p && p.display_name) ? p.display_name : u;
    const isDev = DEV_USERS.includes(u);
    const badge = isDev ? `<span class="dev-badge">DEV</span>` : (p?.is_verified ? `<span class="badge">✓</span>` : '');
    if (p && p.rank && allRanks.find(r => r.id === p.rank)) {
        const rData = allRanks.find(r => r.id === p.rank).data;
        return `<div style="display:inline-flex; flex-direction:column; line-height:1.2;">
                    <div style="font-weight:800"><span class="rank-name-${p.rank}">${dName}</span> <span class="rank-badge-${p.rank}">${rData.badgeText}</span></div>
                    <div style="color:var(--text-dim); font-size:11px;">@${u}</div>
                </div>`;
    }
    return `<div style="display:inline-flex; flex-direction:column; line-height:1.2;">
                <div style="font-weight:800"><span class="${isDev ? 'glow-text' : ''}">${dName}</span> ${badge}</div>
                <div style="color:var(--text-dim); font-size:11px;">@${u}</div>
            </div>`;
}

async function handleAuth() {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    if (!u || !p) return alert("Username & Password required");

    if (authMode === 'register') {
        const { data: taken } = await supabaseClient.from('profiles').select('username').eq('username', u).maybeSingle();
        if (taken) return alert("Username already taken!");
        const { error } = await supabaseClient.from('profiles').insert([{ username: u, pass: p, coins: 100, subscribers: 0, is_banned: false }]);
        if (error) return alert("Error: " + error.message);
        loginSuccess(u);
    } else {
        const { data: user, error } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('pass', p).maybeSingle();
        if (error || !user) return alert("Invalid Username or Password");
        if (user.is_banned) return alert("This account is banned.");
        loginSuccess(u);
    }
}

function loginSuccess(u) { localStorage.setItem('cem_user', u); location.reload(); }

async function fetchData() {
    const { data: v } = await supabaseClient.from('videos').select('*').order('id', { ascending: false });
    const { data: p } = await supabaseClient.from('profiles').select('*');
    const { data: r } = await supabaseClient.from('ranks').select('*');
    const { data: s } = await supabaseClient.from('site_settings').select('*');
    const { data: a } = await (DEV_USERS.includes(currentUser) ? supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50) : { data: [] });
    allVideos = v || []; allProfiles = p || []; allRanks = r || []; allSettings = s || []; allAudit = a || [];

    checkDailyCoins();
    applyGlobalBanner();
    updateRankCSS();
    if (currentCtx === 'home') render('v-grid');
    if (currentCtx === 'announcements') renderAnnouncements();
    if (currentCtx === 'marketplace') renderMarketplace();
    if (currentCtx === 'admin') renderAdmin();
    updateNav();
}

function updateNav() {
    if(!currentUser) return;
    document.getElementById('u-name-display').innerHTML = formatName(currentUser);
    const av = document.getElementById('nav-avatar'); 
    av.setAttribute('style', getAvatarStyle(currentUser)); 
    av.innerText = currentUser[0].toUpperCase();
    const p = allProfiles.find(x => x.username === currentUser);
    if(p) document.getElementById('u-coins').innerText = `🪙 ${p.coins || 0}`;
}

function setContext(ctx, el) {
    currentCtx = ctx;
    document.querySelectorAll('.side-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active'); closeSidebar();
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.getElementById('view-' + ctx).classList.add('active');
    fetchData();
}

function render(target = 'v-grid', list = null) {
    const grid = document.getElementById(target); let d = list || allVideos;
    if (currentCtx === 'home') d = d.filter(v => v.url && !v.url.match(/\.(jpg|jpeg|png|webp|gif)$/i));
    grid.innerHTML = d.map(v => `
        <div class="card">
            <div class="v-thumb-wrap" onclick="playVideo('${v.id}')"><img src="${v.thumb}" class="v-img-prev"></div>
            <div style="display:flex; gap:12px; padding:12px 0;">
                <div class="v-avatar" style="${getAvatarStyle(v.uploader)}">${v.uploader[0]}</div>
                <div><div style="font-weight:700;">${v.title}</div><div style="font-size:12px;">${formatName(v.uploader)}</div></div>
            </div>
        </div>`).join('');
}

async function handleUpload() {
    const v = document.getElementById('vid-input').files[0];
    const t = document.getElementById('vid-thumb').files[0];
    if (!v) return alert("Select a file!");
    const btn = document.getElementById('publish-btn');
    btn.disabled = true;
    try {
        const fd = new FormData(); fd.append('file', v); fd.append('upload_preset', UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
        const data = await res.json();
        await supabaseClient.from('videos').insert([{
            title: document.getElementById('vid-name').value || v.name,
            uploader: currentUser,
            url: data.secure_url,
            thumb: data.secure_url.replace(/\.[^/.]+$/, ".jpg"),
            details: document.getElementById('vid-desc').value
        }]);
        location.reload();
    } catch (e) { alert("Upload failed"); btn.disabled = false; }
}

function updateRankCSS() {
    let css = "";
    allRanks.forEach(r => {
        const d = r.data;
        css += `.rank-name-${r.id} { color: ${d.nameColor}; ${d.nameGlowSize ? `text-shadow: 0 0 ${d.nameGlowSize}px ${d.nameGlow};` : ''} }\n`;
        css += `.rank-badge-${r.id} { background: ${d.badgeBg}; color: ${d.badgeTextColor}; border-radius: ${d.badgeBorderRadius}px; padding: 2px 6px; font-size: 10px; }\n`;
    });
    let s = document.getElementById('dynamic-ranks') || document.createElement('style');
    s.id = 'dynamic-ranks'; s.innerHTML = css; document.head.appendChild(s);
}

// ... Rest of your renderAdmin, renderMarketplace, handleLike, toggleSub functions go here ...

if (currentUser) {
    document.getElementById('nav-bar').style.display = 'flex';
    document.getElementById('main-area').style.display = 'block';
    if(DEV_USERS.includes(currentUser)) document.getElementById('admin-nav-item').style.display = 'block';
    fetchData();
} else {
    document.getElementById('auth-shield').style.display = 'flex';
}
