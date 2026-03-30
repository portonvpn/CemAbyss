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
function logout() { supabaseClient.auth.signOut().then(() => { localStorage.removeItem('cem_user'); location.reload(); }); }

function openAuth() { document.getElementById('auth-shield').style.display = 'flex'; }
function closeAuth() { document.getElementById('auth-shield').style.display = 'none'; }

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('auth-title').innerText = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('auth-toggle').innerText = authMode === 'login' ? 'No account? Register' : 'Have an account? Login';
    document.getElementById('login-user').style.display = authMode === 'login' ? 'none' : 'block';
    document.getElementById('reg-email').style.display = authMode === 'login' ? 'none' : 'block';
    document.getElementById('login-email').placeholder = authMode === 'login' ? 'Email or Username' : 'Email (Optional)';
    if (authMode === 'register') document.getElementById('login-email').style.display = 'none';
    else document.getElementById('login-email').style.display = 'block';
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

    if (p && p.rank) {
        const r = allRanks.find(rk => rk.id === p.rank);
        if (r && r.data) {
            const rData = r.data;
            const nameClass = `rank-name-${p.rank}`;
            const extraClass = rData.hasGalaxy ? 'galaxy-rank' : '';
            const b = `<span class="rank-badge-${p.rank} ${extraClass}">${rData.badgeText || ''}</span>`;
            nameMain = `<span class="${nameClass}">${dName}</span> ${b}`;
        } else {
            const glow = isDev ? 'glow-text' : '';
            nameMain = `<span class="${glow}">${dName}</span> ${badge}`;
        }
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
    let inputEmail = document.getElementById('login-email').value.trim();
    const p = document.getElementById('login-pass').value; // Don't trim passwords!
    const u = document.getElementById('login-user').value.trim();
    const regE = document.getElementById('reg-email').value.trim();

    if (authMode === 'register') {
        if (!u || !p) return alert("Username & Password required");

        let emailToUse = regE;
        if (!emailToUse) {
            // Clean username for direct email usage (remove spaces/special chars)
            const cleanU = u.toLowerCase().replace(/[^a-z0-9]/g, '');
            emailToUse = `${cleanU}@cemabyss.com`;
        } else {
            // Basic format check if email was provided
            if (!emailToUse.includes('@') || !emailToUse.includes('.')) {
                return alert("The email you provided is not formatted correctly! (e.g. name@example.com)");
            }
        }
        emailToUse = emailToUse.toLowerCase();

        if (localStorage.getItem('cem_registration_ipblock')) {
            return alert("Registration Limit Exceeded: Device IP blocked.");
        }

        const { data: taken } = await supabaseClient.from('profiles').select('username').eq('username', u).maybeSingle();
        if (taken) return alert("Username already taken!");

        const { data, error } = await supabaseClient.auth.signUp({
            email: emailToUse,
            password: p,
            options: { data: { username: u } }
        });

        if (error) return alert(error.message);

        await supabaseClient.from('profiles').insert([{ 
            username: u, 
            is_banned: false, 
            subscribers: 0, 
            email_lookup: emailToUse.toLowerCase() 
        }]);

        if (data.user && data.user.identities && data.user.identities.length === 0) {
            alert("Email or Username already in use.");
        } else if (data.session) {
            localStorage.setItem('cem_registration_ipblock', 'true');
            loginSuccess(u);
        } else {
            localStorage.setItem('cem_registration_ipblock', 'true');
            alert("Success! If you provided a real email, check it to CONFIRM your account.");
            toggleAuthMode();
        }
    } else {
        if (!inputEmail || !p) return alert("Email/Username & Password required");

        let emailToSignIn = inputEmail;
        if (!inputEmail.includes('@')) {
            const { data: prof } = await supabaseClient.from('profiles').select('email_lookup').ilike('username', inputEmail).maybeSingle();
            if (prof && prof.email_lookup) {
                emailToSignIn = prof.email_lookup;
            } else {
                // Dual Fallback for legacy compatibility
                const cleanU = inputEmail.toLowerCase().replace(/[^a-z0-9]/g, '');
                const { data: dCom, error: eCom } = await supabaseClient.auth.signInWithPassword({
                    email: `${cleanU}@cemabyss.com`,
                    password: p
                });

                if (!eCom) {
                    if (dCom.user) {
                        const uname = dCom.user.user_metadata.username;
                        if (uname) {
                            await supabaseClient.from('profiles').update({ email_lookup: dCom.user.email }).eq('username', uname);
                            loginSuccess(uname);
                        }
                    }
                    return;
                }

                // If .com failed, try legacy .local (no sanitization, just like before)
                const { data: dLoc, error: eLoc } = await supabaseClient.auth.signInWithPassword({
                    email: `${inputEmail}@cemabyss.local`.toLowerCase(),
                    password: p
                });

                if (!eLoc) {
                    if (dLoc.user) {
                        const uname = dLoc.user.user_metadata.username;
                        if (uname) {
                            await supabaseClient.from('profiles').update({ email_lookup: dLoc.user.email }).eq('username', uname);
                            loginSuccess(uname);
                        }
                    }
                    return;
                }

                let msg = eLoc.message;
                msg += " (Try logging in with your Email once if your Username fails)";
                return alert(msg);
            }
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailToSignIn,
            password: p
        });

        if (error) {
            let msg = error.message;
            if (!inputEmail.includes('@')) msg += " (Try logging in with your Email once if your Username fails)";
            return alert(msg);
        }

        if (data.user) {
            const uname = data.user.user_metadata.username;
            if (uname) {
                // Update email_lookup for legacy users
                await supabaseClient.from('profiles').update({ email_lookup: data.user.email }).eq('username', uname);
                loginSuccess(uname);
            }
            else alert("Account has no assigned username.");
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
    if (currentCtx === 'admin') renderAdmin(); else if (currentCtx !== 'profile' && currentCtx !== 'announcements' && currentCtx !== 'settings') render();
    if (currentCtx === 'marketplace') renderMarketplace();
    if (currentCtx === 'announcements') renderAnnouncements();
    if (currentCtx === 'settings') renderSettings();
    updateNav();
}

function updateNav() {
    if (currentUser) {
        document.getElementById('nav-user-area').style.display = 'flex';
        document.getElementById('nav-login-btn').style.display = 'none';
        document.getElementById('u-name-display').innerHTML = formatName(currentUser);
        const av = document.getElementById('nav-avatar');
        av.setAttribute('style', getAvatarStyle(currentUser));
        av.innerText = currentUser[0].toUpperCase();
    } else {
        document.getElementById('nav-user-area').style.display = 'none';
        document.getElementById('nav-login-btn').style.display = 'block';
    }
}

function setContext(ctx, el) {
    if (profileAudio) { profileAudio.pause(); profileAudio = null; }
    currentCtx = ctx; document.querySelectorAll('.side-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active'); closeSidebar();
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    if (ctx === 'settings') {
        document.getElementById('view-settings').classList.add('active'); renderSettings();
    } else if (ctx === 'admin') {
        document.getElementById('view-admin').classList.add('active'); renderAdmin();
    } else if (ctx === 'marketplace') {
        document.getElementById('view-marketplace').classList.add('active'); renderMarketplace();
    } else if (ctx === 'announcements') {
        document.getElementById('view-announcements').classList.add('active'); renderAnnouncements();
    } else {
        if ((ctx === 'studio' || ctx === 'settings') && !currentUser) return openAuth();
        document.getElementById('view-home').classList.add('active'); render();
    }
}

function openUpload() {
    if (!currentUser) return openAuth();
    document.getElementById('modal-upload').style.display = 'flex';
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

    if (currentCtx === 'home' && target === 'v-grid') {
        const pinSet = allSettings.find(x => x.id === 'pinned_video');
        const pCont = document.getElementById('pinned-container');
        if (pinSet && pinSet.data && pinSet.data.videoId) {
            const pVid = allVideos.find(v => v.id == pinSet.data.videoId);
            if (pVid) {
                pCont.innerHTML = `
                    <div style="margin-bottom: 24px; border-radius: 12px; border: 2px solid var(--primary); box-shadow: 0 0 30px rgba(168, 85, 247, 0.3); overflow: hidden; background: #0a0a0a; position: relative; cursor: pointer; display: flex; flex-wrap: wrap;" onclick="playVideo('${pVid.id}')">
                        <div style="position:absolute; top:15px; left:15px; background:var(--primary); color:white; padding:6px 16px; border-radius:100px; font-weight:900; font-size:12px; box-shadow:0 0 15px var(--primary); z-index:10; letter-spacing:1px;">📌 FEATURED</div>
                        ${DEV_USERS.includes(currentUser) ? `<div style="position:absolute; top:15px; right:15px; background:#e11d48; color:white; padding:6px 16px; border-radius:100px; font-weight:900; font-size:12px; z-index:10; cursor:pointer;" onclick="event.stopPropagation(); unpinVideo()">Unpin</div>` : ''}
                        
                        <div style="flex: 1 1 50%; min-width: 250px;">
                            <img src="${pVid.thumb}" style="width: 100%; height: 100%; object-fit: cover; aspect-ratio: 16/9;">
                        </div>
                        <div style="flex: 1 1 50%; padding: 25px; display: flex; flex-direction: column; justify-content: center; min-width: 250px;">
                            <h1 style="margin-top:0; font-size:24px; text-shadow:0 0 15px var(--primary);">${pVid.title}</h1>
                            <div style="display:flex; align-items:center; gap:12px; margin-bottom: 15px;">
                                <div class="v-avatar" style="${getAvatarStyle(pVid.uploader)}">${pVid.uploader[0]}</div>
                                <div style="font-size:16px;">${formatName(pVid.uploader)}</div>
                            </div>
                            <p style="color:var(--text-dim); font-size:13px; line-height:1.5; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">${pVid.details || 'No description provided.'}</p>
                        </div>
                    </div>
                `;
            } else { if (pCont) pCont.innerHTML = ''; }
        } else {
            if (pCont) pCont.innerHTML = '';
        }
    }

    grid.innerHTML = d.map(v => {
        const isOwner = v.uploader === currentUser;
        const canEdit = DEV_USERS.includes(currentUser) || (isOwner && cP?.is_verified);

        return `<div class="card">
            <div class="dots-btn" onclick="event.stopPropagation(); toggleMenu(event,'${v.id}')">⋮</div>
            <div id="menu-${v.id}" class="dropdown">
                <div onclick="openProfile('${v.uploader}')">👤 Channel</div>
                ${canEdit ? `<div onclick="openEdit('${v.id}','${v.title}','${encodeURIComponent(v.details || '')}')">📝 Edit</div><div onclick="deleteVideo('${v.id}')" style="color:red">🗑️ Delete</div>` : ''}
                ${DEV_USERS.includes(currentUser) ? `<div onclick="pinVideo('${v.id}')" style="color:#0ea5e9">📌 Pin Video</div>` : ''}
            </div>
            <div class="v-thumb-wrap" onclick="playVideo('${v.id}')"><img src="${v.thumb}" class="v-img-prev"></div>
            <div style="display:flex; gap:12px; padding:12px 0;">
                <div class="v-avatar" style="${getAvatarStyle(v.uploader)}" onclick="event.stopPropagation(); openProfile('${v.uploader}')">${v.uploader ? v.uploader[0] : '?'}</div>
                <div><div style="font-weight:700;">${v.title}</div><div style="font-size:12px;color:gray;display:flex;align-items:center;">${formatName(v.uploader)}</div></div>
            </div>
        </div>`;
    }).join('');
}

function handleSearch() {
    const q = document.getElementById('global-search').value.trim().toLowerCase();

    if (!q) {
        if (currentCtx === 'home') render('v-grid', null);
        return;
    }

    if (currentCtx !== 'home') {
        document.querySelectorAll('.side-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
        document.getElementById('view-home').classList.add('active');
        currentCtx = 'home';
    }

    // Fuzzy matching: "mri" matches "mario"
    const fuzzyRegex = new RegExp(q.split('').join('.*?'), 'i');

    const results = allVideos.filter(v => {
        if (!(DEV_USERS.includes(currentUser) || v.uploader === currentUser)) {
            const p = allProfiles.find(x => x.username === v.uploader);
            if (p && p.is_shadowbanned) return false;
        }
        return fuzzyRegex.test(v.title) || fuzzyRegex.test(v.uploader);
    });

    render('v-grid', results);
}

function updateRankCSS() {
    let css = `@keyframes rankBGMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } } \n`;
    allRanks.forEach(rank => {
        const d = rank.data;
        if (!d) return;
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
            filter: drop-shadow(0 0 ${d.badgeGlowSize || 4}px ${d.badgeGlow || 'transparent'}); /* Fixed Boxy Glow with drop-shadow */
            ${(d.badgeBg && d.badgeBg.includes('gradient') && d.nameMoving) ? `background-size: 200% 200%; animation: rankBGMove 3s ease infinite;` : ''}
        }\n`;
    });
    let s = document.getElementById('dynamic-ranks');
    if (!s) { s = document.createElement('style'); s.id = 'dynamic-ranks'; document.head.appendChild(s); }
    s.innerHTML = css;
}

async function buyItem(id, cost) {
    if (!currentUser) return openAuth();
    const p = allProfiles.find(x => x.username === currentUser);
    if (!p) return;
    if ((p.coins || 0) < cost) return alert("Not enough CemCoins! Login daily to earn more.");

    if (id === 'galaxy_bundle') {
        const unlocked = p.unlocked_themes || [];
        if (unlocked.includes('galaxy')) return alert("You already own the Galaxy Bundle!");
        unlocked.push('galaxy');
        const { error } = await supabaseClient.from('profiles').update({ coins: p.coins - cost, unlocked_themes: unlocked }).eq('username', currentUser);
        if (error) alert(error.message);
        else { alert("🌌 Galaxy Unlocked! You can now use Galaxy effects in Rank Creation."); fetchData(); }
        return;
    }
    // Generic theme purchase
    const unlocked = p.unlocked_themes || [];
    if (unlocked.includes(id)) return alert("Already owned!");
    unlocked.push(id);
    await supabaseClient.from('profiles').update({ coins: p.coins - cost, unlocked_themes: unlocked }).eq('username', currentUser);
    fetchData(); alert("Success!");
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

function renderAdminLogs() {
    const logArea = document.getElementById('admin-audit-log');
    if (!logArea) return;
    logArea.innerHTML = (allAudit || []).map(a => {
        const date = new Date(a.created_at).toLocaleString();
        return `<div class="audit-item">
            <span style="color:gray">[${date}]</span> 
            <b style="color:var(--primary)">${a.admin_user}</b> 
            <span>${a.action}</span> on 
            <b style="color:var(--text)">${a.target}</b>: 
            <i style="color:var(--text-dim)">${a.details}</i>
        </div>`;
    }).join('') || "No administrative actions found.";
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
                <div style="width:100%;">
                    <p style="font-size:12px; color:gray; margin-top:0; margin-bottom:10px;"><b>Verification:</b> Normal users cannot natively edit or delete their own videos unless they are Verified using the button below. Admins completely bypass this check.</p>
                </div>
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

    pBadge.style.display = 'inline-block';
    pBadge.style.padding = '2px 6px';
    pBadge.style.fontSize = '10px';
    pBadge.style.fontWeight = '800';
    pBadge.style.marginLeft = '6px';

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

async function toggleVerify(u, s) {
    const p = allProfiles.find(x => x.username === u); if (p) p.is_verified = s;
    searchAdminUser();
    await supabaseClient.from('profiles').update({ is_verified: s }).eq('username', u);
    fetchData();
}

async function toggleBan(u, s) {
    const p = allProfiles.find(x => x.username === u); if (p) p.is_banned = s;
    searchAdminUser();
    await supabaseClient.from('profiles').update({ is_banned: s }).eq('username', u);
    fetchData();
}

async function deleteAccount(u) {
    if (confirm("Nuke this user and ALL their videos?")) {
        allProfiles = allProfiles.filter(x => x.username !== u);
        const searchRes = document.getElementById('admin-search-result');
        if (searchRes) searchRes.innerHTML = '<p style="color:var(--primary)">User completely erased.</p>';
        await supabaseClient.from('videos').delete().eq('uploader', u);
        await supabaseClient.from('profiles').delete().eq('username', u);
        fetchData();
    }
}

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

    let localLikes = JSON.parse(localStorage.getItem(`cem_likes_${currentUser}`) || '[]');
    let localSubs = JSON.parse(localStorage.getItem(`cem_subs_${currentUser}`) || '[]');

    const likeBtn = document.getElementById('like-btn');
    if (likeBtn) {
        if (localLikes.includes(activeVideo.id)) {
            likeBtn.style.background = 'var(--primary)';
            likeBtn.innerHTML = `👍 Liked (<span id="p-likes">${activeVideo.likes || 0}</span>)`;
        } else {
            likeBtn.style.background = 'rgba(255,255,255,0.1)';
            likeBtn.innerHTML = `👍 <span id="p-likes">${activeVideo.likes || 0}</span>`;
        }
    } else {
        const pLikes = document.getElementById('p-likes');
        if (pLikes) pLikes.innerText = activeVideo.likes || 0;
    }

    const subBtn = document.getElementById('sub-btn');
    if (subBtn) {
        if (localSubs.includes(activeVideo.uploader)) {
            subBtn.classList.add('active');
            subBtn.innerText = 'SUBSCRIBED';
        } else {
            subBtn.classList.remove('active');
            subBtn.innerText = 'SUBSCRIBE';
        }
    }

    document.getElementById('p-desc-content').innerText = activeVideo.details || "";
    const t = document.getElementById('p-target');
    t.innerHTML = activeVideo.url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? `<img src="${activeVideo.url}" class="p-media">` : `<video controls autoplay src="${activeVideo.url}"></video>`;
    await supabaseClient.from('videos').update({ views: (activeVideo.views || 0) + 1 }).eq('id', id);
    renderRecs(); loadComments();
}

function renderRecs() {
    const rG = document.getElementById('rec-grid');
    const validRecs = allVideos.filter(v => v.id != activeVideo.id).filter(v => {
        if (DEV_USERS.includes(currentUser) || v.uploader === currentUser) return true;
        const p = allProfiles.find(x => x.username === v.uploader);
        return !(p && p.is_shadowbanned);
    });
    const l = validRecs.slice(0, 10);
    rG.innerHTML = l.map(v => `<div class="rec-card" onclick="playVideo('${v.id}')"><div class="rec-thumb"><img src="${v.thumb}" style="width:100%;height:100%;object-fit:cover"></div><div class="rec-info"><div class="rec-title">${v.title}</div><div style="font-size:12px;color:gray;margin-top:4px;display:flex;align-items:center;">${formatName(v.uploader)}</div></div></div>`).join('');
}

function playNext() {
    const validRecs = allVideos.filter(v => v.id != activeVideo.id).filter(v => {
        if (DEV_USERS.includes(currentUser) || v.uploader === currentUser) return true;
        const p = allProfiles.find(x => x.username === v.uploader);
        return !(p && p.is_shadowbanned);
    });
    const n = validRecs[0];
    if (n) playVideo(n.id);
}

async function postComment() {
    if (!currentUser) return openAuth();
    const txt = document.getElementById('comm-input').value.trim(); if (!txt) return;
    let existing = activeVideo.comments ? JSON.parse(activeVideo.comments) : [];
    existing.push({ user: currentUser, text: txt, time: Date.now() });
    const { error } = await supabaseClient.from('videos').update({ comments: JSON.stringify(existing) }).eq('id', activeVideo.id);
    if (!error) { activeVideo.comments = JSON.stringify(existing); document.getElementById('comm-input').value = ''; loadComments(); }
}

function loadComments() {
    const list = document.getElementById('comments-list');
    let arr = activeVideo.comments ? JSON.parse(activeVideo.comments) : [];

    arr = arr.map((c, idx) => ({ ...c, originalIdx: idx })).reverse();

    const filteredComments = arr.filter(c => {
        if (DEV_USERS.includes(currentUser) || c.user === currentUser) return true;
        const p = allProfiles.find(x => x.username === c.user);
        return !(p && p.is_shadowbanned);
    });

    list.innerHTML = filteredComments.map(c => `
        <div class="comment-item">
            <div class="v-avatar" style="width:32px; height:32px; font-size:12px; ${getAvatarStyle(c.user)}" onclick="openProfile('${c.user}')">${c.user[0]}</div>
            <div style="flex:1">
                <div class="comment-user" onclick="openProfile('${c.user}')">${formatName(c.user)}</div>
                <div class="comment-text">${c.text}</div>
            </div>
            ${(DEV_USERS.includes(currentUser) || c.user === currentUser) ? `<div onclick="deleteComment(${c.originalIdx})" style="color:red; font-size:10px; cursor:pointer">Delete</div>` : ''}
        </div>`).join('');
}

async function deleteComment(idx) {
    let arr = JSON.parse(activeVideo.comments);
    arr.splice(idx, 1);
    await supabaseClient.from('videos').update({ comments: JSON.stringify(arr) }).eq('id', activeVideo.id);
    activeVideo.comments = JSON.stringify(arr); loadComments();
}

let isLiking = false;
async function handleLike() {
    if (!currentUser) return openAuth();
    let localLikes = JSON.parse(localStorage.getItem(`cem_likes_${currentUser}`) || '[]');
    if (isLiking || localLikes.includes(activeVideo.id)) return;
    isLiking = true;

    const n = (activeVideo.likes || 0) + 1;

    localLikes.push(activeVideo.id);
    localStorage.setItem(`cem_likes_${currentUser}`, JSON.stringify(localLikes));

    activeVideo.likes = n;
    const b = document.getElementById('like-btn');
    if (b) {
        b.style.background = 'var(--primary)';
        b.innerHTML = `👍 Liked (<span id="p-likes">${n}</span>)`;
    }

    await supabaseClient.from('videos').update({ likes: n }).eq('id', activeVideo.id);
    isLiking = false;
}

let isSubbing = false;
async function toggleSub() {
    if (!currentUser) return openAuth();
    if (isSubbing) return;
    isSubbing = true;

    const b = document.getElementById('sub-btn');
    let localSubs = JSON.parse(localStorage.getItem(`cem_subs_${currentUser}`) || '[]');
    const isCurrentlySubbed = localSubs.includes(activeVideo.uploader);
    const isNowSubbed = !isCurrentlySubbed;

    const p = allProfiles.find(x => x.username === activeVideo.uploader);
    let n = p.subscribers || 0;

    if (isNowSubbed) {
        n += 1;
        b.classList.add('active');
        b.innerText = 'SUBSCRIBED';
        localSubs.push(activeVideo.uploader);
    } else {
        n = Math.max(0, n - 1);
        b.classList.remove('active');
        b.innerText = 'SUBSCRIBE';
        localSubs = localSubs.filter(x => x !== activeVideo.uploader);
    }

    localStorage.setItem(`cem_subs_${currentUser}`, JSON.stringify(localSubs));
    document.getElementById('p-subs').innerText = `${n} subscribers`;
    p.subscribers = n;

    await supabaseClient.from('profiles').update({ subscribers: n }).eq('username', activeVideo.uploader);
    isSubbing = false;
}

let currentUploadFile = null;

function handleFileSelect(input) {
    const file = input.files[0];
    if (file) setUploadFile(file);
}

function setUploadFile(file) {
    currentUploadFile = file;
    const hint = document.getElementById('paste-hint');
    const preview = document.getElementById('paste-preview');
    const img = document.getElementById('pasted-img');
    const area = document.getElementById('paste-area');

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
            if (preview) preview.style.display = 'block';
            if (hint) hint.innerHTML = `<b>SELECTED image:</b> ${file.name}`;
            if (area) area.style.borderColor = 'var(--primary)';
        }
        reader.readAsDataURL(file);
    } else {
        if (preview) preview.style.display = 'none';
        if (hint) hint.innerHTML = `<b>SELECTED file:</b> ${file.name}`;
        if (area) area.style.borderColor = 'var(--primary)';
    }
}

window.addEventListener('paste', (e) => {
    const modal = document.getElementById('modal-upload');
    if (modal && modal.style.display === 'flex') {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                setUploadFile(new File([blob], `pasted_img_${Date.now()}.png`, { type: blob.type }));
            }
        }
    }
});

async function handleUpload() {
    if (!currentUser) return openAuth();
    const v = currentUploadFile || document.getElementById('vid-input').files[0];
    const tFile = document.getElementById('vid-thumb').files[0];
    if (!v) return alert("Please select or PASTE a file to upload!");

    // Cloudinary usually limits unsigned uploads to ~10MB for free tiers
    if (v.size > 100 * 1024 * 1024) return alert("File is too large! Please keep it under 100MB depending on your Cloudinary limits.");

    const btn = document.getElementById('publish-btn'), bar = document.getElementById('prog-bar'), bg = document.getElementById('prog-bg');
    btn.disabled = true; bg.style.display = 'block'; bar.style.width = "10%";

    try {
        let thumbUrl = "";
        if (tFile) {
            const fdT = new FormData(); fdT.append('file', tFile); fdT.append('upload_preset', UPLOAD_PRESET);
            const rT = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fdT });
            const dT = await rT.json();
            if (dT.error) throw new Error("Thumb Upload Error: " + dT.error.message);
            thumbUrl = dT.secure_url;
        }
        bar.style.width = "30%";

        const fd = new FormData(); fd.append('file', v); fd.append('upload_preset', UPLOAD_PRESET);
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
        const d = await r.json();

        if (d.error) throw new Error("Video Upload Error: " + d.error.message);
        bar.style.width = "70%";

        if (!thumbUrl) thumbUrl = d.resource_type === 'video' ? d.secure_url.replace(/\.[^/.]+$/, ".jpg") : d.secure_url;

        const { error: dbError } = await supabaseClient.from('videos').insert([{
            title: document.getElementById('vid-name').value || v.name,
            uploader: currentUser,
            url: d.secure_url,
            thumb: thumbUrl,
            views: 0,
            likes: 0,
            details: document.getElementById('vid-desc').value
        }]);

        if (dbError) throw new Error("Supabase Database Error: " + dbError.message);

        bar.style.width = "100%";
        setTimeout(() => location.reload(), 800);
    } catch (e) {
        console.error(e);
        alert("Upload Failed -> " + e.message);
        btn.disabled = false;
        bar.style.width = "0%";
    }
}

function openProfile(user) {
    if (profileAudio) { profileAudio.pause(); profileAudio = null; }
    currentCtx = 'profile'; document.querySelectorAll('.side-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.getElementById('view-profile').classList.add('active');
    closeSidebar(); closePlayer();

    const p = allProfiles.find(x => x.username === user);
    if (!p) return;

    // Profile Music
    if (p.music_url) {
        profileAudio = new Audio(p.music_url); profileAudio.volume = 0.5;
        profileAudio.play().catch(() => {
            document.addEventListener('click', () => { if(profileAudio && profileAudio.paused) profileAudio.play(); }, {once:true});
        });
    }

    // Apply Profile Vibe
    const container = document.getElementById('profile-container');
    const bColor = p.profile_glow || 'rgba(168, 85, 247, 0.4)';
    container.style.boxShadow = `0 10px 80px ${bColor}`;
    container.style.fontFamily = p.profile_font || 'inherit';

    // Banner
    const banner = document.getElementById('profile-banner');
    if (p.banner_url) banner.style.background = `url('${p.banner_url}') center/cover no-repeat`;
    else banner.style.background = `linear-gradient(135deg, #111, #000)`;

    // Avatar
    const bdr = p.profile_border || 'border-none';
    document.getElementById('p-avatar-wrap').innerHTML = `
        <div class="v-avatar ${bdr}" style="width:120px; height:120px; font-size:50px; border-radius:50%; z-index:2; ${getAvatarStyle(user)}">${user ? user[0] : '?'}</div>
    `;

    // Name Area
    document.getElementById('p-name-area').innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap;">
            <h1 style="margin:0; font-size:36px; color:#fff; text-shadow: 0 0 20px ${bColor};">${p.display_name || user}</h1>
            ${getRankBadge(user)}
        </div>
        <div style="color:rgba(255,255,255,0.6); font-size:18px; margin-top:8px;">@${user}</div>
    `;

    // Bio
    document.getElementById('p-bio').innerText = p.bio || 'This user hasn\'t written a bio yet.';
    
    // Socials
    const socials = p.social_links ? JSON.parse(p.social_links) : {};
    let sHtml = '';
    if (socials.discord) sHtml += `<div class="social-icon" title="Discord: ${socials.discord}" style="font-size:32px;">👾</div>`;
    if (socials.twitter) sHtml += `<div class="social-icon" title="Twitter: ${socials.twitter}" style="font-size:32px;">🐦</div>`;
    if (socials.github) sHtml += `<div class="social-icon" title="GitHub: ${socials.github}" style="font-size:32px;">📂</div>`;
    if (socials.yt) sHtml += `<div class="social-icon" title="YouTube" style="font-size:32px;">🎥</div>`;
    document.getElementById('p-socials').innerHTML = sHtml;

    // Stats & Badges
    document.getElementById('p-stats').innerHTML = `<span style="color:#fff; letter-spacing:1px;">${p.subscribers || 0} SUBSCRIBERS</span>`;
    
    const badges = p.badges ? JSON.parse(p.badges) : [];
    document.getElementById('p-badges').innerHTML = badges.map(b => `<span class="badge-item" style="font-size:32px;">${b}</span>`).join('');

    render('profile-grid', allVideos.filter(v => v.uploader === user));
}

function getRankBadge(user) {
    const p = allProfiles.find(x => x.username === user);
    if (!p) return "";
    const rank = allRanks.find(r => (p.coins || 0) >= r.min_coins);
    if (!rank) return "";
    return `<span class="rank-tag" style="background:${rank.color}">${rank.name}</span>`;
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

async function pinVideo(id) {
    if (!confirm("Pin this video to the top of the Home page globally?")) return;
    const { error } = await supabaseClient.from('site_settings').upsert([{ id: 'pinned_video', data: { videoId: id } }]);

    if (error) {
        alert("SQL Error: " + error.message + " - Ensure site_settings table allows INSERT/UPDATE (RLS policies)!");
        return;
    }

    logAudit('PINNED_VIDEO', id, `Pinned video to front page`);
    fetchData();
}

async function unpinVideo() {
    const { error } = await supabaseClient.from('site_settings').upsert([{ id: 'pinned_video', data: { videoId: null } }]);
    fetchData();
}

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

function setFrutigerBg(img) {
    localStorage.setItem('cem_frutiger_bg', img);
    document.body.style.backgroundImage = `url('${img}')`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundAttachment = "fixed";
}

function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('cem_theme', t);

    if (t === 'frutiger') {
        const bg = localStorage.getItem('cem_frutiger_bg') || 'frutiger.jpg';
        setFrutigerBg(bg);
    } else {
        document.body.style.backgroundImage = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundPosition = '';
        document.body.style.backgroundAttachment = '';
    }

    if (currentCtx === 'settings') renderSettings();
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

function renderProfile(u) {
    const p = allProfiles.find(x => x.username === u);
    if (!p) return;

    let socHtml = '';
    let soc = p.social_links || {};
    if (typeof soc === 'string') try { soc = JSON.parse(soc); } catch(e){soc={};}

    if (soc.yt) socHtml += `<a href="https://www.youtube.com/${soc.yt.startsWith('@') ? soc.yt : '@'+soc.yt}" target="_blank"><img src="youtube.png" class="social-link-icon"></a>`;
    if (soc.ig) socHtml += `<a href="https://www.instagram.com/${soc.ig}/" target="_blank"><img src="instagram.png" class="social-link-icon"></a>`;
    if (soc.tiktok) socHtml += `<a href="https://www.tiktok.com/${soc.tiktok.startsWith('@') ? soc.tiktok : '@'+soc.tiktok}" target="_blank"><img src="tiktok.png" class="social-link-icon"></a>`;
    if (soc.discord) socHtml += `<img src="discord.png" class="social-link-icon" onclick="alert('Discord: ${soc.discord}')" style="cursor:help;">`;

    const galaxyClass = (p.unlocked_themes || []).includes('galaxy_active') ? 'galaxy-profile' : '';

    return `
        <div class="video-card ${galaxyClass}" style="padding:15px; text-align:center;">
            <div class="v-avatar" style="width:80px; height:80px; font-size:32px; margin:0 auto 10px; ${getAvatarStyle(p.username)}">${p.username[0]}</div>
            ${formatName(p.username)}
            <p style="font-size:12px; color:var(--text-dim); margin-top:10px;">${p.bio || 'No bio yet.'}</p>
            <div style="display:flex; justify-content:center; gap:12px; margin-top:15px;">
                ${socHtml}
            </div>
        </div>
    `;
}

async function toggleShadowban(u) {
    const p = allProfiles.find(x => x.username === u);
    if (!p) return;
    const s = !p.is_shadowbanned;

    p.is_shadowbanned = s; // update locally instantly
    searchAdminUser();

    const { error } = await supabaseClient.from('profiles').update({ is_shadowbanned: s }).eq('username', u);

    if (error) {
        p.is_shadowbanned = !s; // revert on fail
        searchAdminUser();
        alert("SQL Error: Missing 'is_shadowbanned' bool column in 'profiles' table. It failed to update!");
        return;
    }

    logAudit(s ? 'SHADOWBAN' : 'UN-SHADOWBAN', u, `Shadowban status changed`);
    fetchData();
}

function checkDailyCoins() {
    const p = allProfiles.find(x => x.username === currentUser);
    if (!p) return;
    const now = Date.now();
    const last = parseInt(p.last_daily) || 0;
    if (now - last > 86400000) {
        const newCoins = (p.coins || 0) + 100;
        supabaseClient.from('profiles').update({ coins: newCoins, last_daily: now }).eq('username', currentUser).then(res => {
            if (!res.error) {
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
    if (!title || !body) return alert("Title and Body required");

    const ann = { id: Date.now().toString(), title, body, color, author: currentUser, date: Date.now() };

    let existing = [];
    const setRec = allSettings.find(x => x.id === 'announcements');
    if (setRec && setRec.data) existing = setRec.data;

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
    if (list.length === 0) {
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
    if (!confirm("Delete announcement?")) return;
    const setRec = allSettings.find(x => x.id === 'announcements');
    if (!setRec) return;
    const filtered = setRec.data.filter(x => x.id !== id);
    await supabaseClient.from('site_settings').upsert([{ id: 'announcements', data: filtered }]);
    fetchData();
}

const MARKET_THEMES = [
    { id: 'galaxy', name: 'Elite Galaxy Bundle', price: 2500, color: 'linear-gradient(to bottom, #a855f7, #6441a5)' },
    { id: 'creamy', name: 'Creamy Gold', price: 1000, color: '#d4a373' },
    { id: 'tropical', name: 'Animated Tropical', price: 2500, color: 'linear-gradient(135deg, #f15bb5, #fee440)' },
    { id: 'rainbow', name: 'Animated Rainbow', price: 5000, color: 'linear-gradient(45deg,red,orange,yellow,green,blue,purple)' },
    { id: 'glitched', name: 'Glitched Hacker', price: 7500, color: '#00ff00' },
    { id: 'frutiger', name: 'Frutiger Aero', price: 10000, color: 'linear-gradient(to bottom, #00a8ff, #005f99)' }
];

function renderMarketplace() {
    const p = allProfiles.find(x => x.username === currentUser);
    if (!p) return;
    const unlocked = p.unlocked_themes || [];
    let html = '';
    MARKET_THEMES.forEach(t => {
        const isOwned = unlocked.includes(t.id);
        const style = t.id === 'galaxy' ? `border:2px solid #a855f7; background:rgba(168, 85, 247, 0.1);` : `border-top:4px solid ${t.color.includes('gradient') ? '#fff' : t.color};`;
        html += `<div class="theme-item" style="${style} padding:20px; border-radius:12px; text-align:center;">
            <h3 style="margin-top:0">${t.id === 'galaxy' ? '🌌 ' : ''}${t.name}</h3>
            ${isOwned ?
                `<button class="primary-btn" style="background:#222; cursor:default">Purchased</button>` :
                `<button class="primary-btn" onclick="buyTheme('${t.id}', ${t.price})">Buy for 🪙 ${t.price}</button>`
            }
        </div>`;
    });
    document.getElementById('market-grid').innerHTML = html;

    let setHtml = `<div class="theme-btn" style="background:#a855f7" onclick="setTheme('default')">Default (Purple)</div>`;
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

    let existingThemes = p.unlocked_themes || [];
    if (typeof existingThemes === 'string') {
        try {
            existingThemes = JSON.parse(existingThemes);
        } catch (e) {
            console.error("Error parsing unlocked_themes:", e);
            existingThemes = [];
        }
    }
    existingThemes.push(tid);

    const t = MARKET_THEMES.find(theme => theme.id === tid);
    if (!t) return alert("Theme not found.");

    const { error } = await supabaseClient.from('profiles').update({ coins: coins - t.price, unlocked_themes: existingThemes }).eq('username', currentUser);

    if (!error) {
        logAudit('PURCHASE_THEME', currentUser, `Bought ${t.id} for ${t.price} coins`);
        alert(`Successfully purchased ${t.name}! You can equip it in the Settings Tab.`);
        setTheme(t.id);
        fetchData();
    } else {
        alert("Error purchasing theme.", error);
    }
}

async function saveSocials() {
    if (!currentUser) return;
    const soc = {
        yt: document.getElementById('set-yt').value.trim(),
        discord: document.getElementById('set-discord').value.trim(),
        ig: document.getElementById('set-ig').value.trim(),
        tiktok: document.getElementById('set-tiktok').value.trim()
    };
    await supabaseClient.from('profiles').update({ social_links: soc }).eq('username', currentUser);
    fetchData(); alert("Socials updated!");
}

async function toggleGalaxyTheme(active) {
    if (!currentUser) return;
    const p = allProfiles.find(x => x.username === currentUser);
    let unlocked = p.unlocked_themes || [];
    if (active) {
        if (!unlocked.includes('galaxy')) return alert("Purchase the Galaxy Bundle in Marketplace first!");
        if (!unlocked.includes('galaxy_active')) unlocked.push('galaxy_active');
    } else {
        unlocked = unlocked.filter(t => t !== 'galaxy_active');
    }
    await supabaseClient.from('profiles').update({ unlocked_themes: unlocked }).eq('username', currentUser);
    fetchData(); location.reload();
}

async function saveBio() {
    const b = document.getElementById('set-bio').value.trim();
    await supabaseClient.from('profiles').update({ bio: b }).eq('username', currentUser);
    fetchData(); alert("Bio Updated!");
}

async function saveBanner() {
    const v = document.getElementById('set-banner').files[0]; if (!v) return;
    const btn = document.getElementById('btn-banner'); btn.innerText = "Uploading..."; btn.disabled = true;
    const fd = new FormData(); fd.append('file', v); fd.append('upload_preset', UPLOAD_PRESET);
    try {
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
        const d = await r.json();
        await supabaseClient.from('profiles').update({ banner_url: d.secure_url }).eq('username', currentUser);
        fetchData(); alert("Banner Updated!");
    } catch (e) { alert("Banner Upload Fail"); }
    btn.innerText = "Upload Banner"; btn.disabled = false; document.getElementById('set-banner').value = '';
}

function renderSettings() {
    const p = allProfiles.find(x => x.username === currentUser);
    if (!p) return;
    
    document.getElementById('set-name').value = p.display_name || '';
    document.getElementById('set-bio').value = p.bio || '';
    document.getElementById('set-music').value = p.music_url || '';

    let soc = p.social_links || {};
    if (typeof soc === 'string') try { soc = JSON.parse(soc); } catch(e){soc={};}
    
    document.getElementById('set-yt').value = soc.yt || '';
    document.getElementById('set-discord').value = soc.discord || '';
    document.getElementById('set-ig').value = soc.ig || '';
    document.getElementById('set-tiktok').value = soc.tiktok || '';

    // Galaxy Visibility
    const gCard = document.getElementById('settings-galaxy-card');
    if (gCard) gCard.style.display = (p.unlocked_themes || []).includes('galaxy') ? 'block' : 'none';

    // Themes Grid (Owned)
    let unlocked = p.unlocked_themes || [];
    let themeHtml = `<div class="theme-btn" style="background:#a855f7" onclick="setTheme('default')">Default Purple</div>`;
    MARKET_THEMES.forEach(t => {
        if (unlocked.includes(t.id) && t.id !== 'galaxy') {
            themeHtml += `<div class="theme-btn" style="background:${t.color}; border:2px solid gold;" onclick="setTheme('${t.id}')">★ ${t.name}</div>`;
        }
    });
    const grid = document.getElementById('my-themes-grid');
    if (grid) grid.innerHTML = themeHtml;
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

document.getElementById('nav-bar').style.display = 'flex';
document.getElementById('main-area').style.display = 'block';

if (currentUser) {
    if (DEV_USERS.includes(currentUser)) {
        const adminNav = document.getElementById('admin-nav-item');
        if (adminNav) adminNav.style.display = 'flex';
    }
    fetchData();
} else {
    fetchData();
}

// Global Navigation Restoration
document.querySelectorAll('.side-item, .nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const ctx = item.getAttribute('data-ctx');
        if (ctx) setContext(ctx, item);
    });
});

function switchTo(v) {
    setContext(v, document.querySelector(`.side-item[data-ctx="${v}"], .nav-item[data-ctx="${v}"]`));
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
