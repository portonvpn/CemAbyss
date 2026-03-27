const CLOUD_NAME = 'dncftuhoo', UPLOAD_PRESET = 'cemabyss', SUPABASE_URL = 'https://xqvvwejwkmqdmsorqdzp.supabase.co', SUPABASE_KEY = 'sb_publishable_WLR6XzQijI3h1-oWa6T-mg_FeolGe9z';
const DEV_USERS = ["Zoro", "Redtree1222", "redtree"];
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = localStorage.getItem('cem_user'), allVideos = [], allProfiles = [], allRanks = [], allSettings = [], allAudit = [], currentCtx = 'home', authMode = 'login', activeVideo = null, editingId = null;

function toggleSidebar() { document.getElementById('side-bar').classList.toggle('open'); }
function closeSidebar() { document.getElementById('side-bar').classList.remove('open'); }
function logout() { supabaseClient.auth.signOut().then(() => { localStorage.removeItem('cem_user'); location.reload(); }); }

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('auth-title').innerText = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('auth-toggle').innerText = authMode === 'login' ? 'No account? Register' : 'Have an account? Login';
    document.getElementById('login-user').style.display = authMode === 'login' ? 'none' : 'block';
}

function showResetPassword() {
    document.getElementById('auth-form-container').style.display = 'none';
    document.getElementById('reset-form-container').style.display = 'block';
}

function hideResetPassword() {
    document.getElementById('reset-form-container').style.display = 'none';
    document.getElementById('auth-form-container').style.display = 'block';
}

async function sendResetEmail() {
    const e = document.getElementById('reset-email').value.trim();
    if (!e) return alert("Enter your email");
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(e, {
        redirectTo: window.location.origin
    });
    if (error) alert(error.message);
    else { alert("Check your email for the password reset link!"); hideResetPassword(); }
}

function getCol(n) { let h = 0; if (n) { for (let i = 0; i < n.length; i++)h = n.charCodeAt(i) + ((h << 5) - h); } return `hsl(${Math.abs(h) % 360}, 70%, 60%)`; }
function getAvatarStyle(u) { const p = allProfiles.find(x => x.username === u); if (p && p.avatar_url) return `background:url('${p.avatar_url}') center/cover;color:transparent;`; return `background:${getCol(u)};`; }

function formatName(u) {
    const p = allProfiles.find(x => x.username === u);
    const dName = (p && p.display_name) ? p.display_name : u;

    let nameMain = '';
    const isDev = DEV_USERS.includes(u);
    const badge = isDev ? `<span class="dev-badge">DEV</span>` : (p?.is_verified ? `<span class="badge">✓</span>` : '');

    if (p && p.rank && allRanks.find(r => r.id === p.rank)) {
        const rData = allRanks.find(r => r.id === p.rank).data;
        const nameClass = `rank-name-${p.rank}`;
        const b = `<span class="rank-badge-${p.rank}">${rData.badgeText}</span>`;
        nameMain = `<span class="${nameClass}">${dName}</span> ${b}`;
    } else {
        const glow = isDev ? 'glow-text' : '';
        nameMain = `<span class="${glow}">${dName}</span> ${badge}`;
    }

    return `<div style="display:inline-flex; flex-direction:column; line-height:1.2; text-align:left;">
                <div style="font-weight:800">${nameMain}</div>
                <div style="color:var(--text-dim); font-size:11px; font-weight:normal; letter-spacing:0.5px;">@${u}</div>
            </div>`;
}

async function handleAuth() {
    const e = document.getElementById('login-email').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    const u = document.getElementById('login-user').value.trim();

    if (!e || !p) return alert("Email & Password required");

    if (authMode === 'register') {
        if (!u) return alert("Please choose a username");
        
        if (localStorage.getItem('cem_registration_ipblock')) {
            return alert("Registration Limit Exceeded: Device IP blocked. You already made an account.");
        }

        const { data: taken } = await supabaseClient.from('profiles').select('username').eq('username', u).maybeSingle();
        if (taken) return alert("Username already taken!");

        const { data, error } = await supabaseClient.auth.signUp({
            email: e,
            password: p,
            options: { data: { username: u } }
        });

        if (error) return alert(error.message);

        await supabaseClient.from('profiles').insert([{ username: u, is_banned: false, subscribers: 0 }]);

        if (data.user && data.user.identities && data.user.identities.length === 0) {
            alert("Email already in use.");
        } else if (data.session) {
            localStorage.setItem('cem_registration_ipblock', 'true');
            loginSuccess(u);
        } else {
            localStorage.setItem('cem_registration_ipblock', 'true');
            alert("Success! Check your email to CONFIRM your account before logging in.");
            toggleAuthMode();
        }
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: e,
            password: p
        });

        if (error) return alert(error.message);

        if (data.user) {
            const uname = data.user.user_metadata.username;
            if (uname) loginSuccess(uname);
            else alert("Account has no assigned username. You may be a legacy user without email.");
        }
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
    if (currentCtx === 'admin') renderAdmin(); else if (currentCtx !== 'profile' && currentCtx !== 'announcements') render();
    if (currentCtx === 'marketplace') renderMarketplace();
    if (currentCtx === 'announcements') renderAnnouncements();
    updateNav();
}

function updateNav() {
    document.getElementById('u-name-display').innerHTML = formatName(currentUser);
    const av = document.getElementById('nav-avatar'); av.setAttribute('style', getAvatarStyle(currentUser)); av.innerText = currentUser ? currentUser[0].toUpperCase() : '?';
}

function setContext(ctx, el) {
    currentCtx = ctx; document.querySelectorAll('.side-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active'); closeSidebar();
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    if (ctx === 'settings') {
        document.getElementById('view-settings').classList.add('active');
    } else if (ctx === 'admin') {
        document.getElementById('view-admin').classList.add('active'); renderAdmin();
    } else if (ctx === 'marketplace') {
        document.getElementById('view-marketplace').classList.add('active'); renderMarketplace();
    } else if (ctx === 'announcements') {
        document.getElementById('view-announcements').classList.add('active'); renderAnnouncements();
    } else {
        document.getElementById('view-home').classList.add('active'); render();
    }
}

function render(target = 'v-grid', list = null) {
    const grid = document.getElementById(target); let d = list || allVideos;
    if (currentCtx === 'imageboard') d = d.filter(v => v.url.match(/\.(jpg|jpeg|png|webp|gif)$/i));
    else if (currentCtx === 'home') d = d.filter(v => v.url && !v.url.match(/\.(jpg|jpeg|png|webp|gif)$/i));
    else if (currentCtx === 'studio') d = d.filter(v => v.uploader === currentUser);

    d = d.filter(v => {
        if (DEV_USERS.includes(currentUser) || v.uploader === currentUser) return true;
        const p = allProfiles.find(x => x.username === v.uploader);
        return !(p && p.is_shadowbanned);
    });

    const cP = allProfiles.find(x => x.username === currentUser);

    grid.innerHTML = d.map(v => {
        const isOwner = v.uploader === currentUser;
        const canEdit = DEV_USERS.includes(currentUser) || (isOwner && cP?.is_verified);

        return `<div class="card">
            <div class="dots-btn" onclick="event.stopPropagation(); toggleMenu(event,'${v.id}')">⋮</div>
            <div id="menu-${v.id}" class="dropdown">
                <div onclick="openProfile('${v.uploader}')">👤 Channel</div>
                ${canEdit ? `<div onclick="openEdit('${v.id}','${v.title}','${encodeURIComponent(v.details || '')}')">📝 Edit</div><div onclick="deleteVideo('${v.id}')" style="color:red">🗑️ Delete</div>` : ''}
            </div>
            <div class="v-thumb-wrap" onclick="playVideo('${v.id}')"><img src="${v.thumb}" class="v-img-prev"></div>
            <div style="display:flex; gap:12px; padding:12px 0;">
                <div class="v-avatar" style="${getAvatarStyle(v.uploader)}" onclick="event.stopPropagation(); openProfile('${v.uploader}')">${v.uploader ? v.uploader[0] : '?'}</div>
                <div><div style="font-weight:700;">${v.title}</div><div style="font-size:12px;color:gray;display:flex;align-items:center;">${formatName(v.uploader)}</div></div>
            </div>
        </div>`;
    }).join('');
}

function updateRankCSS() {
    let css = `@keyframes rankBGMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } } \n`;
    allRanks.forEach(rank => {
        const d = rank.data;
        css += `.rank-name-${rank.id} {
            font-weight: 800;
            ${d.nameColor ? (d.nameColor.includes('gradient') ? `background: ${d.nameColor}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: transparent;` : `color: ${d.nameColor};`) : ''}
            ${d.nameGlow ? `filter: drop-shadow(0 0 ${d.nameGlowSize || 5}px ${d.nameGlow});` : ''}
            ${d.nameMoving ? `background-size: 200% 200%; animation: rankBGMove 3s ease infinite;` : ''}
        }\n`;
        css += `.rank-badge-${rank.id} {
            padding: 2px 6px; font-size: 10px; font-weight: 800; margin-left: 6px; display: inline-block;
            background: ${d.badgeBg || 'transparent'};
            color: ${d.badgeTextColor || 'white'};
            border-radius: ${d.badgeBorderRadius || 0}px;
            box-shadow: 0 0 ${d.badgeGlowSize || 0}px ${d.badgeGlow || 'transparent'};
            ${(d.badgeBg && d.badgeBg.includes('gradient') && d.nameMoving) ? `background-size: 200% 200%; animation: rankBGMove 3s ease infinite;` : ''}
        }\n`;
    });
    let s = document.getElementById('dynamic-ranks');
    if (!s) { s = document.createElement('style'); s.id = 'dynamic-ranks'; document.head.appendChild(s); }
    s.innerHTML = css;
}

function renderAdminRanks() {
    document.getElementById('admin-ranks-list').innerHTML = allRanks.map(r => `
        <div style="background:#222; padding:10px 15px; border-radius:10px; cursor:pointer; font-weight:800; border:1px solid var(--border)" onclick="editRank('${r.id}')">${r.id}</div>
    `).join('');
}

function renderAdmin() {
    if (!DEV_USERS.includes(currentUser)) return;
    renderAdminRanks();
    renderAdminLogs();
}

function searchAdminUser() {
    const query = document.getElementById('admin-user-search').value.trim().toLowerCase();
    const p = allProfiles.find(x => x.username.toLowerCase() === query);
    const res = document.getElementById('admin-search-result');
    if (!p) {
        res.innerHTML = '<p style="color:#e11d48">User not found.</p>';
        return;
    }

    res.innerHTML = `
        <div style="background:#111; padding:20px; border-radius:12px; border:1px solid var(--border);">
            <div style="font-weight:800; display:flex; align-items:center; gap:10px; margin-bottom: 15px; font-size:20px;">
                <div class="v-avatar" style="width:40px; height:40px; font-size:16px; ${getAvatarStyle(p.username)}">${p.username[0]}</div>
                ${formatName(p.username)} ${p.is_banned ? '<span style="color:#e11d48; font-size:10px; background:rgba(225,29,72,0.1); padding:2px 6px; border-radius:4px; margin-left:6px;">BANNED</span>' : ''}
            </div>
            
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
                <button class="primary-btn" style="width:auto; padding:8px 16px; background:#222;" onclick="toggleVerify('${p.username}', ${!p.is_verified})">${p.is_verified ? 'Unverify' : 'Verify'}</button>
                <button class="primary-btn" style="width:auto; padding:8px 16px; background:#222;" onclick="toggleBan('${p.username}', ${!p.is_banned})">${p.is_banned ? 'Unban' : 'Ban'}</button>
                <button class="primary-btn" style="width:auto; padding:8px 16px; background:#222; color:#f59e0b;" onclick="toggleShadowban('${p.username}')">${p.is_shadowbanned ? 'Un-Shadowban' : 'Shadowban'}</button>
                <button class="primary-btn" style="width:auto; padding:8px 16px; background:#e11d48;" onclick="deleteAccount('${p.username}')">Delete Account</button>
            </div>
            
            <h4 style="margin-top:0; border-top:1px solid var(--border); padding-top:15px;">Admin Economy Control</h4>
            <div style="display:flex; gap:10px;">
                <input type="number" id="user-give-coins" placeholder="Amount (e.g. 500)" style="margin-bottom:0">
                <button class="primary-btn" style="width:auto; padding:0 20px;" onclick="addCoinsToUser('${p.username}')">Add Coins</button>
            </div>

            <h4 style="margin-top:0; border-top:1px solid var(--border); padding-top:15px;">Assign Custom Rank</h4>
            <div style="display:flex; gap:10px;">
                <select id="user-assign-rank" style="background:#222; border:1px solid var(--border); color:white; padding:10px; border-radius:8px; width:100%;">
                    <option value="">None / Default</option>
                    ${allRanks.map(r => `<option value="${r.id}" ${p.rank === r.id ? 'selected' : ''}>${r.id}</option>`).join('')}
                </select>
                <button class="primary-btn" style="width:auto; padding:0 20px;" onclick="assignRankToUser('${p.username}')">Assign</button>
            </div>
        </div>
    `;
}

async function assignRankToUser(u) {
    const rid = document.getElementById('user-assign-rank').value;
    const updateVal = rid === "" ? null : rid;
    const { error } = await supabaseClient.from('profiles').update({ rank: updateVal }).eq('username', u);
    if (error) alert("Error! Did you run the SQL to add the 'rank' column?");
    else { alert("Rank updated!"); fetchData(); setTimeout(searchAdminUser, 500); }
}

let currentEditingRankId = null;

function toggleNameColorInputs() {
    document.getElementById('name-c2-wrap').style.display = document.getElementById('r-name-type').value === 'gradient' ? 'flex' : 'none';
    updateLivePreview();
}

function toggleBadgeColorInputs() {
    const t = document.getElementById('r-badge-type').value;
    document.getElementById('badge-color-inputs').style.display = t === 'transparent' ? 'none' : 'block';
    document.getElementById('badge-c2-wrap').style.display = t === 'gradient' ? 'flex' : 'none';
    updateLivePreview();
}

function updateLivePreview() {
    const pName = document.getElementById('prev-name');
    const pBadge = document.getElementById('prev-badge');

    const nType = document.getElementById('r-name-type').value;
    const nc1 = document.getElementById('r-name-c1').value;
    const nc2 = document.getElementById('r-name-c2').value;
    const nMoving = document.getElementById('r-name-moving').checked;

    if (nType === 'solid') {
        pName.style.background = 'none';
        pName.style.webkitBackgroundClip = 'initial';
        pName.style.webkitTextFillColor = 'initial';
        pName.style.color = nc1;
    } else {
        pName.style.background = `linear-gradient(45deg, ${nc1}, ${nc2})`;
        pName.style.webkitBackgroundClip = 'text';
        pName.style.webkitTextFillColor = 'transparent';
        pName.style.color = 'transparent';
    }

    const ngls = parseInt(document.getElementById('r-name-glow-size').value) || 0;
    const nglc = document.getElementById('r-name-glow-c').value;
    pName.style.filter = ngls > 0 ? `drop-shadow(0 0 ${ngls}px ${nglc})` : 'none';

    pName.style.backgroundSize = nMoving && nType === 'gradient' ? '200% 200%' : '100% 100%';
    pName.style.animation = nMoving && nType === 'gradient' ? 'rankBGMove 3s ease infinite' : 'none';

    pBadge.innerText = document.getElementById('r-badge-text').value || 'BADGE';
    pBadge.style.color = document.getElementById('r-badge-text-col').value;
    pBadge.style.borderRadius = (parseInt(document.getElementById('r-badge-root-rad').value) || 0) + 'px';

    const bType = document.getElementById('r-badge-type').value;
    const bc1 = document.getElementById('r-badge-c1').value;
    const bc2 = document.getElementById('r-badge-c2').value;

    let bbg = 'transparent';
    if (bType === 'solid') bbg = bc1;
    else if (bType === 'gradient') bbg = `linear-gradient(45deg, ${bc1}, ${bc2})`;

    pBadge.style.background = bbg;
    pBadge.style.backgroundSize = nMoving && bType === 'gradient' ? '200% 200%' : '100% 100%';
    pBadge.style.animation = nMoving && bType === 'gradient' ? 'rankBGMove 3s ease infinite' : 'none';

    const bgsize = parseInt(document.getElementById('r-badge-glow-size').value) || 0;
    const bgcol = document.getElementById('r-badge-glow-c').value;
    pBadge.style.boxShadow = bgsize > 0 ? `0 0 ${bgsize}px ${bgcol}` : 'none';
}

function clearRankForm() {
    currentEditingRankId = null;
    document.getElementById('r-id').value = '';
    document.getElementById('r-id').disabled = false;
    document.getElementById('r-badge-text').value = '';

    document.getElementById('r-name-type').value = 'solid';
    document.getElementById('r-name-c1').value = '#ffffff';
    document.getElementById('r-name-c2').value = '#ffffff';
    document.getElementById('r-name-moving').checked = false;
    document.getElementById('r-name-glow-c').value = '#000000';
    document.getElementById('r-name-glow-size').value = 0;

    document.getElementById('r-badge-type').value = 'transparent';
    document.getElementById('r-badge-c1').value = '#ffffff';
    document.getElementById('r-badge-c2').value = '#ffffff';
    document.getElementById('r-badge-text-col').value = '#ffffff';
    document.getElementById('r-badge-glow-c').value = '#000000';
    document.getElementById('r-badge-glow-size').value = 0;
    document.getElementById('r-badge-root-rad').value = 4;

    document.getElementById('r-delete-btn').style.display = 'none';

    toggleNameColorInputs();
    toggleBadgeColorInputs();
    updateLivePreview();
}

function editRank(id) {
    const r = allRanks.find(x => x.id === id);
    if (!r) return;
    const d = r.data;
    const raw = d.raw || {};
    currentEditingRankId = id;

    document.getElementById('r-id').value = id;
    document.getElementById('r-id').disabled = true;
    document.getElementById('r-badge-text').value = d.badgeText || '';

    document.getElementById('r-name-type').value = raw.nType || 'solid';
    document.getElementById('r-name-c1').value = raw.nc1 || '#ffffff';
    document.getElementById('r-name-c2').value = raw.nc2 || '#ffffff';
    document.getElementById('r-name-moving').checked = !!d.nameMoving;
    document.getElementById('r-name-glow-c').value = raw.nglc || '#000000';
    document.getElementById('r-name-glow-size').value = d.nameGlowSize || 0;

    document.getElementById('r-badge-type').value = raw.bType || 'transparent';
    document.getElementById('r-badge-c1').value = raw.bc1 || '#ffffff';
    document.getElementById('r-badge-c2').value = raw.bc2 || '#ffffff';
    document.getElementById('r-badge-text-col').value = d.badgeTextColor || '#ffffff';
    document.getElementById('r-badge-glow-c').value = raw.bgcol || '#000000';
    document.getElementById('r-badge-glow-size').value = d.badgeGlowSize || 0;
    document.getElementById('r-badge-root-rad').value = d.badgeBorderRadius || 0;

    document.getElementById('r-delete-btn').style.display = 'block';

    toggleNameColorInputs();
    toggleBadgeColorInputs();
    updateLivePreview();
}

async function saveRank() {
    const id = document.getElementById('r-id').value.trim().toLowerCase();
    if (!id) return alert("Rank ID required");

    const nType = document.getElementById('r-name-type').value;
    const nc1 = document.getElementById('r-name-c1').value;
    const nc2 = document.getElementById('r-name-c2').value;
    const nameColor = nType === 'solid' ? nc1 : `linear-gradient(45deg, ${nc1}, ${nc2})`;
    const nglc = document.getElementById('r-name-glow-c').value;

    const bType = document.getElementById('r-badge-type').value;
    const bc1 = document.getElementById('r-badge-c1').value;
    const bc2 = document.getElementById('r-badge-c2').value;
    const bgcol = document.getElementById('r-badge-glow-c').value;

    let badgeBg = 'transparent';
    if (bType === 'solid') badgeBg = bc1;
    else if (bType === 'gradient') badgeBg = `linear-gradient(45deg, ${bc1}, ${bc2})`;

    const data = {
        badgeText: document.getElementById('r-badge-text').value.trim(),
        nameColor: nameColor,
        nameGlow: nglc,
        nameGlowSize: parseInt(document.getElementById('r-name-glow-size').value) || 0,
        nameMoving: document.getElementById('r-name-moving').checked,
        badgeBg: badgeBg,
        badgeTextColor: document.getElementById('r-badge-text-col').value,
        badgeGlow: bgcol,
        badgeGlowSize: parseInt(document.getElementById('r-badge-glow-size').value) || 0,
        badgeBorderRadius: parseInt(document.getElementById('r-badge-root-rad').value) || 0,
        raw: { nType, nc1, nc2, bType, bc1, bc2, nglc, bgcol }
    };

    if (currentEditingRankId) {
        const { error } = await supabaseClient.from('ranks').update({ data }).eq('id', id);
        if (error) return alert("DB Error! Did you add the ranks table?");
    } else {
        const { error } = await supabaseClient.from('ranks').insert([{ id, data }]);
        if (error) return alert("DB Error! Did you add the ranks table?");
    }

    alert("Rank Saved!");
    clearRankForm();
    fetchData();
}

async function deleteRank() {
    if (!currentEditingRankId) return;
    if (!confirm("Delete this rank completely?")) return;
    const { error } = await supabaseClient.from('ranks').delete().eq('id', currentEditingRankId);
    if (error) return alert("DB Error");
    alert("Rank Deleted!");
    clearRankForm();
    fetchData();
}

async function toggleVerify(u, s) { await supabaseClient.from('profiles').update({ is_verified: s }).eq('username', u); fetchData(); }
async function toggleBan(u, s) { await supabaseClient.from('profiles').update({ is_banned: s }).eq('username', u); fetchData(); }
async function deleteAccount(u) { if (confirm("Nuke this user and ALL their videos?")) { await supabaseClient.from('videos').delete().eq('uploader', u); await supabaseClient.from('profiles').delete().eq('username', u); fetchData(); } }

async function playVideo(id) {
    activeVideo = allVideos.find(v => v.id == id); document.getElementById('player-page').style.display = 'block';
    const p = allProfiles.find(x => x.username === activeVideo.uploader);
    document.getElementById('p-title').innerText = activeVideo.title;
    document.getElementById('p-uploader').innerHTML = formatName(activeVideo.uploader);
    document.getElementById('p-uploader').onclick = () => openProfile(activeVideo.uploader);
    document.getElementById('p-avatar').setAttribute('style', `width:40px; height:40px; ${getAvatarStyle(activeVideo.uploader)}`);
    document.getElementById('p-avatar').innerText = activeVideo.uploader[0];
    document.getElementById('p-avatar').onclick = () => openProfile(activeVideo.uploader);
    document.getElementById('p-subs').innerText = `${p?.subscribers || 0} subscribers`;
    document.getElementById('p-likes').innerText = activeVideo.likes || 0;
    document.getElementById('p-desc-content').innerText = activeVideo.details || "";
    const t = document.getElementById('p-target');
    t.innerHTML = activeVideo.url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? `<img src="${activeVideo.url}" class="p-media">` : `<video controls autoplay src="${activeVideo.url}"></video>`;
    await supabaseClient.from('videos').update({ views: (activeVideo.views || 0) + 1 }).eq('id', id);
    renderRecs(); loadComments();
}

function renderRecs() {
    const rG = document.getElementById('rec-grid');
    const l = allVideos.filter(v => v.id != activeVideo.id).slice(0, 10);
    rG.innerHTML = l.map(v => `<div class="rec-card" onclick="playVideo('${v.id}')"><div class="rec-thumb"><img src="${v.thumb}" style="width:100%;height:100%;object-fit:cover"></div><div class="rec-info"><div class="rec-title">${v.title}</div><div style="font-size:12px;color:gray;margin-top:4px;display:flex;align-items:center;">${formatName(v.uploader)}</div></div></div>`).join('');
}

function playNext() { const n = allVideos.filter(v => v.id != activeVideo.id)[0]; if (n) playVideo(n.id); }

async function postComment() {
    const txt = document.getElementById('comm-input').value.trim(); if (!txt) return;
    let existing = activeVideo.comments ? JSON.parse(activeVideo.comments) : [];
    existing.push({ user: currentUser, text: txt, time: Date.now() });
    const { error } = await supabaseClient.from('videos').update({ comments: JSON.stringify(existing) }).eq('id', activeVideo.id);
    if (!error) { activeVideo.comments = JSON.stringify(existing); document.getElementById('comm-input').value = ''; loadComments(); }
}

function loadComments() {
    const list = document.getElementById('comments-list');
    const arr = activeVideo.comments ? JSON.parse(activeVideo.comments) : [];
    list.innerHTML = arr.reverse().map((c, i) => `
        <div class="comment-item">
            <div class="v-avatar" style="width:32px; height:32px; font-size:12px; ${getAvatarStyle(c.user)}" onclick="openProfile('${c.user}')">${c.user[0]}</div>
            <div style="flex:1">
                <div class="comment-user" onclick="openProfile('${c.user}')">${formatName(c.user)}</div>
                <div class="comment-text">${c.text}</div>
            </div>
            ${(DEV_USERS.includes(currentUser) || c.user === currentUser) ? `<div onclick="deleteComment(${i})" style="color:red; font-size:10px; cursor:pointer">Delete</div>` : ''}
        </div>`).join('');
}

async function deleteComment(idx) {
    let arr = JSON.parse(activeVideo.comments); arr.reverse().splice(idx, 1); arr.reverse();
    await supabaseClient.from('videos').update({ comments: JSON.stringify(arr) }).eq('id', activeVideo.id);
    activeVideo.comments = JSON.stringify(arr); loadComments();
}

async function handleLike() {
    const n = (activeVideo.likes || 0) + 1; await supabaseClient.from('videos').update({ likes: n }).eq('id', activeVideo.id);
    document.getElementById('p-likes').innerText = n; activeVideo.likes = n;
}

async function toggleSub() {
    const b = document.getElementById('sub-btn'); b.classList.toggle('active');
    const isS = b.classList.contains('active'); b.innerText = isS ? 'SUBSCRIBED' : 'SUBSCRIBE';
    const p = allProfiles.find(x => x.username === activeVideo.uploader);
    const n = isS ? (p.subscribers + 1) : Math.max(0, p.subscribers - 1);
    await supabaseClient.from('profiles').update({ subscribers: n }).eq('username', activeVideo.uploader);
    document.getElementById('p-subs').innerText = `${n} subscribers`; p.subscribers = n;
}

async function handleUpload() {
    const v = document.getElementById('vid-input').files[0];
    const tFile = document.getElementById('vid-thumb').files[0];
    if (!v) return;
    const btn = document.getElementById('publish-btn'), bar = document.getElementById('prog-bar'), bg = document.getElementById('prog-bg');
    btn.disabled = true; bg.style.display = 'block'; bar.style.width = "10%";

    try {
        let thumbUrl = "";
        if (tFile) {
            const fdT = new FormData(); fdT.append('file', tFile); fdT.append('upload_preset', UPLOAD_PRESET);
            const rT = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fdT });
            const dT = await rT.json();
            thumbUrl = dT.secure_url;
        }
        bar.style.width = "30%";

        const fd = new FormData(); fd.append('file', v); fd.append('upload_preset', UPLOAD_PRESET);
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
        const d = await r.json(); bar.style.width = "70%";

        if (!thumbUrl) thumbUrl = d.resource_type === 'video' ? d.secure_url.replace(/\.[^/.]+$/, ".jpg") : d.secure_url;

        await supabaseClient.from('videos').insert([{ title: document.getElementById('vid-name').value || v.name, uploader: currentUser, url: d.secure_url, thumb: thumbUrl, views: 0, likes: 0, details: document.getElementById('vid-desc').value }]);
        bar.style.width = "100%"; setTimeout(() => location.reload(), 800);
    } catch (e) { alert("Fail"); btn.disabled = false; }
}

function openProfile(user) {
    currentCtx = 'profile'; document.querySelectorAll('.side-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.getElementById('view-profile').classList.add('active');
    const p = allProfiles.find(x => x.username === user);
    document.getElementById('profile-head').innerHTML = `<div class="v-avatar" style="width:80px;height:80px;font-size:30px;margin:0 auto;${getAvatarStyle(user)}">${user ? user[0] : '?'}</div><h2 style="margin:10px 0 5px;display:flex;align-items:center;justify-content:center;gap:8px;">${formatName(user)}</h2><p style="color:gray">${p?.subscribers || 0} subscribers</p>`;
    render('profile-grid', allVideos.filter(v => v.uploader === user));
    closePlayer();
}

function openEdit(id, t, d) {
    editingId = id;
    document.getElementById('edit-title').value = t;
    document.getElementById('edit-desc').value = decodeURIComponent(d);
    document.getElementById('modal-edit').style.display = 'flex';
}

async function saveEdit() {
    const btn = document.getElementById('save-edit-btn');
    btn.disabled = true; btn.innerText = "Saving...";
    let updates = {
        title: document.getElementById('edit-title').value,
        details: document.getElementById('edit-desc').value
    };
    const tFile = document.getElementById('edit-thumb').files[0];
    if (tFile) {
        const fdT = new FormData(); fdT.append('file', tFile); fdT.append('upload_preset', UPLOAD_PRESET);
        try {
            const rT = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fdT });
            const dT = await rT.json();
            updates.thumb = dT.secure_url;
        } catch (e) { }
    }
    await supabaseClient.from('videos').update(updates).eq('id', editingId);
    location.reload();
}

function toggleMenu(e, id) { e.stopPropagation(); closeAllMenus(); document.getElementById(`menu-${id}`).style.display = 'block'; }
function closeAllMenus() { document.querySelectorAll('.dropdown').forEach(d => d.style.display = 'none'); }
async function deleteVideo(id) { if (confirm("Delete?")) { await supabaseClient.from('videos').delete().eq('id', id); location.reload(); } }
function openUpload() { document.getElementById('modal-upload').style.display = 'flex'; }
function closeUpload() { document.getElementById('modal-upload').style.display = 'none'; }
function closeEdit() { document.getElementById('modal-edit').style.display = 'none'; }
function closePlayer() { document.getElementById('player-page').style.display = 'none'; document.getElementById('p-target').innerHTML = ""; }

async function saveName() {
    const n = document.getElementById('set-name').value.trim(); if (!n) return;
    const btn = document.getElementById('btn-name'); btn.innerText = "Saving..."; btn.disabled = true;
    await supabaseClient.from('profiles').update({ display_name: n }).eq('username', currentUser);
    btn.innerText = "Save"; btn.disabled = false; document.getElementById('set-name').value = ''; fetchData();
}

async function savePfp() {
    const v = document.getElementById('set-pfp').files[0]; if (!v) return;
    const btn = document.getElementById('btn-pfp'); btn.innerText = "Uploading..."; btn.disabled = true;
    const fd = new FormData(); fd.append('file', v); fd.append('upload_preset', UPLOAD_PRESET);
    try {
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
        const d = await r.json();
        await supabaseClient.from('profiles').update({ avatar_url: d.secure_url }).eq('username', currentUser);
        fetchData();
    } catch (e) { alert("Fail"); }
    btn.innerText = "Upload"; btn.disabled = false; document.getElementById('set-pfp').value = '';
}

function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('cem_theme', t);
}

function applyGlobalBanner() {
    const b = allSettings.find(x => x.id === 'banner');
    const bDiv = document.getElementById('global-banner');
    if (b && b.data && b.data.active && b.data.text) {
        bDiv.style.display = 'flex';
        bDiv.style.background = b.data.color || 'var(--primary)';
        document.getElementById('banner-text-content').innerText = b.data.text;
    } else {
        bDiv.style.display = 'none';
    }
}

async function saveBanner() {
    const txt = document.getElementById('admin-banner-text').value.trim();
    const col = document.getElementById('admin-banner-color').value;
    const data = { active: !!txt, text: txt, color: col };
    await supabaseClient.from('site_settings').upsert([{ id: 'banner', data }]);
    logAudit('UPDATED_BANNER', 'Global', `Set banner to: ${txt}`);
    alert("Banner broadcasted!"); fetchData();
}

async function logAudit(action, target, details) {
    if (!DEV_USERS.includes(currentUser)) return;
    await supabaseClient.from('audit_logs').insert([{ admin_user: currentUser, action, target, details }]);
}

async function toggleShadowban(u) {
    const p = allProfiles.find(x => x.username === u);
    if (!p) return;
    const s = !p.is_shadowbanned;
    await supabaseClient.from('profiles').update({ is_shadowbanned: s }).eq('username', u);
    logAudit(s ? 'SHADOWBAN' : 'UN-SHADOWBAN', u, `Shadowban status changed`);
    fetchData(); setTimeout(searchAdminUser, 500);
}

function checkDailyCoins() {
    const p = allProfiles.find(x => x.username === currentUser);
    if (!p) return;
    const now = Date.now();
    const last = parseInt(p.last_daily) || 0;
    if (now - last > 86400000) {
        const newCoins = (p.coins || 0) + 100;
        supabaseClient.from('profiles').update({ coins: newCoins, last_daily: now }).eq('username', currentUser).then(res=>{
            if(!res.error) {
                allProfiles.find(x => x.username === currentUser).coins = newCoins;
                allProfiles.find(x => x.username === currentUser).last_daily = now;
                document.getElementById('u-coins').innerText = `🪙 ${newCoins}`;
                alert("🎉 You received 100 CemCoins for your daily login! Welcome back.");
            }
        });
    } else {
        document.getElementById('u-coins').innerText = `🪙 ${p.coins || 0}`;
    }
}

async function addCoinsToUser(u) {
    const amt = parseInt(document.getElementById('user-give-coins').value);
    if (!amt) return alert("Enter valid amount");
    const p = allProfiles.find(x => x.username === u);
    const newCoins = (p.coins || 0) + amt;
    await supabaseClient.from('profiles').update({ coins: newCoins }).eq('username', u);
    logAudit('GIVE_COINS', u, `Gave ${amt} coins. New total: ${newCoins}`);
    fetchData(); setTimeout(searchAdminUser, 500);
}

async function postAnnouncement() {
    const title = document.getElementById('admin-ann-title').value.trim();
    const body = document.getElementById('admin-ann-body').value.trim();
    const color = document.getElementById('admin-ann-color').value;
    if(!title || !body) return alert("Title and Body required");

    const ann = { id: Date.now().toString(), title, body, color, author: currentUser, date: Date.now() };
    
    let existing = [];
    const setRec = allSettings.find(x => x.id === 'announcements');
    if(setRec && setRec.data) existing = setRec.data;
    
    existing.unshift(ann);
    
    await supabaseClient.from('site_settings').upsert([{ id: 'announcements', data: existing }]);
    logAudit('POSTED_ANNOUNCEMENT', 'Global', `Title: ${title}`);
    alert("Announcement Posted!");
    document.getElementById('admin-ann-title').value = '';
    document.getElementById('admin-ann-body').value = '';
    fetchData();
}

function renderAnnouncements() {
    const setRec = allSettings.find(x => x.id === 'announcements');
    const list = (setRec && setRec.data) ? setRec.data : [];
    if(list.length === 0) {
        document.getElementById('announcement-grid').innerHTML = '<p style="color:gray">No announcements yet.</p>';
        return;
    }

    document.getElementById('announcement-grid').innerHTML = list.map(a => `
        <div style="background:var(--card); border:1px solid var(--border); border-radius:16px; padding:24px; position:relative; overflow:hidden;">
            <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:${a.color}; box-shadow:0 0 15px ${a.color};"></div>
            <h3 style="margin-top:0; color:${a.color}; text-shadow:0 0 10px ${a.color}80; margin-bottom:10px;">${a.title}</h3>
            <div style="font-size:12px; color:gray; margin-bottom:15px; display:flex; gap:10px; align-items:center;">
                <span>By: <span style="font-weight:bold; color:var(--text);">${a.author}</span></span>
                <span>•</span>
                <span>${new Date(a.date).toLocaleString()}</span>
                ${DEV_USERS.includes(currentUser) ? `<span style="color:#e11d48; cursor:pointer;" onclick="deleteAnnouncement('${a.id}')">Delete</span>` : ''}
            </div>
            <div style="white-space:pre-wrap; line-height:1.5; color:var(--text);">${a.body}</div>
        </div>
    `).join('');
}

async function deleteAnnouncement(id) {
    if(!confirm("Delete announcement?")) return;
    const setRec = allSettings.find(x => x.id === 'announcements');
    if(!setRec) return;
    const filtered = setRec.data.filter(x => x.id !== id);
    await supabaseClient.from('site_settings').upsert([{ id: 'announcements', data: filtered }]);
    fetchData();
}

const MARKET_THEMES = [
    { id: 'creamy', name: 'Creamy Gold', price: 100, color: '#d4a373' },
    { id: 'tropical', name: 'Animated Tropical', price: 500, color: 'linear-gradient(135deg, #f15bb5, #fee440)' },
    { id: 'rainbow', name: 'Animated Rainbow', price: 1000, color: 'linear-gradient(45deg,red,orange,yellow,green,blue,purple)' },
    { id: 'glitched', name: 'Glitched Hacker', price: 1500, color: '#00ff00' }
];

function renderMarketplace() {
    const p = allProfiles.find(x => x.username === currentUser);
    if (!p) return;
    const unlocked = p.unlocked_themes || [];
    let html = '';
    MARKET_THEMES.forEach(t => {
        const isOwned = unlocked.includes(t.id);
        html += `<div class="theme-item" style="border-top:4px solid ${t.color.includes('gradient') ? '#fff' : t.color}">
            <h3 style="margin-top:0">${t.name}</h3>
            ${isOwned ?
                `<button class="primary-btn" style="background:#222; cursor:default">Purchased</button>` :
                `<button class="primary-btn" onclick="buyTheme('${t.id}', ${t.price})">Buy for 🪙 ${t.price}</button>`
            }
        </div>`;
    });
    document.getElementById('market-grid').innerHTML = html;

    let setHtml = `
      <div class="theme-btn" style="background:#a855f7" onclick="setTheme('default')">Default</div>
      <div class="theme-btn" style="background:#e11d48" onclick="setTheme('midnight-red')">Midnight Red</div>
      <div class="theme-btn" style="background:#0ea5e9" onclick="setTheme('ocean')">Ocean Blue</div>
      <div class="theme-btn" style="background:#10b981" onclick="setTheme('forest')">Forest Green</div>
      <div class="theme-btn" style="background:#f59e0b" onclick="setTheme('eclipse')">Eclipse Orange</div>
      <div class="theme-btn" style="background:#6366f1" onclick="setTheme('abyss')">Deep Abyss</div>
    `;
    MARKET_THEMES.forEach(t => {
        if (unlocked.includes(t.id)) {
            setHtml += `<div class="theme-btn" style="background:${t.color}" onclick="setTheme('${t.id}')">${t.name}</div>`;
        }
    });
    document.getElementById('my-themes-grid').innerHTML = setHtml;
}

async function buyTheme(tid, price) {
    const p = allProfiles.find(x => x.username === currentUser);
    const coins = p.coins || 0;
    if (coins < price) return alert("Not enough CemCoins! Login tomorrow for more.");

    if (!confirm(`Buy theme for ${price} coins?`)) return;

    let unlocked = p.unlocked_themes || [];
    unlocked.push(tid);

    const { error } = await supabaseClient.from('profiles').update({
        coins: coins - price,
        unlocked_themes: unlocked
    }).eq('username', currentUser);

    if (!error) { alert("Theme Unlocked! Go to settings to equip it."); fetchData(); }
    else alert("Error purchasing theme.", error);
}

function renderAdminLogs() {
    document.getElementById('admin-audit-log').innerHTML = allAudit.map(a => {
        return `<div>[${new Date(a.created_at).toLocaleString()}] <strong style="color:var(--text)">${a.admin_user}</strong> executed <strong style="color:var(--primary)">${a.action}</strong> on ${a.target}: <span>${a.details}</span></div>`;
    }).join('') || "No logs found.";

    const b = allSettings.find(x => x.id === 'banner');
    if (b && b.data && document.getElementById('admin-banner-text')) {
        document.getElementById('admin-banner-text').value = b.data.text || '';
        document.getElementById('admin-banner-color').value = b.data.color || '#e11d48';
    }
}

if (currentUser) {
    document.getElementById('nav-bar').style.display = 'flex';
    document.getElementById('main-area').style.display = 'block';
    if (DEV_USERS.includes(currentUser)) document.getElementById('admin-nav-item').style.display = 'flex';
    fetchData();
} else {
    document.getElementById('auth-shield').style.display = 'flex';
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        const newPassword = prompt("Enter your NEW password:");
        if (!newPassword) return alert("Password update cancelled.");
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) alert(error.message);
        else { alert("Password successfully updated. You can now login."); logout(); }
    }
});
