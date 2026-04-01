const CLOUD_NAME = 'dncftuhoo', UPLOAD_PRESET = 'cemabyss', SUPABASE_URL = 'https://xqvvwejwkmqdmsorqdzp.supabase.co', SUPABASE_KEY = 'sb_publishable_WLR6XzQijI3h1-oWa6T-mg_FeolGe9z';
const DEV_USERS = ["Zoro", "Redtree1222", "redtree"];
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = localStorage.getItem('cem_user'), allVideos = [], allProfiles = [], allRanks = [], allSettings = [], allAudit = [], currentCtx = 'home', authMode = 'login', activeVideo = null, editingId = null;

// Initial UI Boot
function applyPerfSetting() {
    const isMobile = window.innerWidth <= 900 || navigator.userAgent.toLowerCase().includes('mobi');
    const stored = localStorage.getItem('cem_low_perf');
    
    let shouldBeLowPerf = false;
    if (stored === 'true') {
        shouldBeLowPerf = true;
    } else if (stored === 'false') {
        shouldBeLowPerf = false;
    } else {
        // Default behavior: Low mode on mobile, Cinematic on PC
        shouldBeLowPerf = isMobile;
    }

    if (shouldBeLowPerf) {
        document.body.classList.add('mobile-low-perf');
    } else {
        document.body.classList.remove('mobile-low-perf');
    }
}
applyPerfSetting();
window.addEventListener('resize', applyPerfSetting);

try {
    const main = document.getElementById('main-area');
    const nav = document.getElementById('nav-bar');
    if (main) main.style.display = 'block';
    if (nav) nav.style.display = 'flex';
} catch(e) {}

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

    return `<div onclick="event.stopPropagation(); openProfile('${u}')" style="display:inline-flex; flex-direction:column; line-height:1.2; text-align:left; cursor:pointer;">
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
    if (currentCtx === 'settings') renderSettings();    updateNav();
    handleRouting();
}

function handleRouting() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const vId = params.get('v');
    const tab = params.get('tab');
    const cId = params.get('c');

    // 1. Sleek Profile Path (/@username)
    if (path.startsWith('/@')) {
        const u = path.substring(2);
        if (u) return openProfile(u);
    }
    
    // 2. Sleek Video Path (/v/slug)
    if (path.startsWith('/v/')) {
        const vidSlug = path.substring(3);
        if (vidSlug) {
            const vid = allVideos.find(x => (x.video_id === vidSlug || x.id == vidSlug));
            if (vid) {
                openVideo(vid.id);
                if (cId) setTimeout(() => highlightComment(cId), 1000);
                return;
            }
        }
    }

    // 3. Legacy Video Query (?v=id)
    if (vId) {
        const vid = allVideos.find(x => (x.video_id === vId || x.id == vId));
        if (vid) {
            openVideo(vid.id);
            if (cId) setTimeout(() => highlightComment(cId), 1000);
            return;
        }
    }

    // 4. Tab selection (?tab=name) or fallback to home
    if (tab) {
        if (tab === 'admin' && !DEV_USERS.includes(currentUser)) {
            setContext('home', document.querySelector('.side-item'));
        } else {
            const el = document.querySelector(`[onclick*="setContext('${tab}'"]`);
            setContext(tab, el);
        }
    } else {
        setContext('home', document.querySelector('.side-item'));
    }
}

window.onpopstate = () => handleRouting();

function highlightComment(id) {
    const el = document.getElementById(`comment-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = '0.5s';
        el.style.background = 'rgba(168, 85, 247, 0.2)';
        el.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.4)';
        el.style.borderRadius = '12px';
        setTimeout(() => {
            el.style.background = 'transparent';
            el.style.boxShadow = 'none';
        }, 3000);
    }
}

function updateNav() {
    if (currentUser) {
        document.getElementById('nav-user-area').style.display = 'flex';
        document.getElementById('nav-login-btn').style.display = 'none';
        document.getElementById('u-name-display').innerHTML = formatName(currentUser);
        const av = document.getElementById('nav-avatar');
        av.setAttribute('style', getAvatarStyle(currentUser));
        av.innerText = currentUser[0].toUpperCase();

        const p = allProfiles.find(x => x.username === currentUser);
        if (p) {
            const notifs = p.notifications ? (typeof p.notifications === 'string' ? JSON.parse(p.notifications) : p.notifications) : [];
            const unread = notifs.filter(n => !n.seen).length;
            updateNotifBadge(unread);
            if (document.getElementById('u-coins')) document.getElementById('u-coins').innerText = `🪙 ${p.coins || 0}`;
        }
    } else {
        document.getElementById('nav-user-area').style.display = 'none';
        document.getElementById('nav-login-btn').style.display = 'block';
    }
}

function setContext(ctx, el) {
    if (profileAudio) { try { profileAudio.pause(); profileAudio = null; } catch(e){} }
    currentCtx = ctx;

    // Update URL when switching tabs (if not already there)
    if (window.location.protocol !== 'file:') {
        const currentUrl = new URL(window.location);
        if (currentUrl.searchParams.get('tab') !== ctx && ctx !== 'home') {
            const newUrl = window.location.origin + window.location.pathname + '?tab=' + ctx;
            window.history.pushState({ path: newUrl }, '', newUrl);
        } else if (ctx === 'home' && currentUrl.searchParams.has('tab')) {
            const newUrl = window.location.origin + window.location.pathname;
            window.history.pushState({ path: newUrl }, '', newUrl);
        }
    }

    // Reset Sidebar UI
    document.querySelectorAll('.side-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
    try { closeSidebar(); } catch(e){}

    // Hide all views
    document.querySelectorAll('.page-view').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });

    const targetView = document.getElementById(`view-${ctx === 'studio' || ctx === 'imageboard' ? 'home' : ctx}`);
    if (targetView) {
        targetView.classList.add('active');
        targetView.style.display = 'block';
    }

    if (ctx === 'settings') {
        if (!currentUser) return openAuth();
        renderSettings();
    } else if (ctx === 'admin') {
        if (!DEV_USERS.includes(currentUser)) {
            alert("ACCESS DENIED: Developer verification failed.");
            return setContext('home');
        }
        renderAdmin();
    } else if (ctx === 'marketplace') {
        renderMarketplace();
    } else if (ctx === 'announcements') {
        renderAnnouncements();
    } else if (ctx === 'profile') {
        // Handled by openProfile
    } else if (ctx === 'liked') {
        if (!currentUser) return openAuth();
        render('liked-grid');
    } else if (ctx === 'subscriptions') {
        if (!currentUser) return openAuth();
        renderSubscriptions();
    } else {
        if (ctx === 'studio' && !currentUser) return openAuth();
        render();
    }
}

function openUpload() {
    if (!currentUser) return openAuth();
    document.getElementById('modal-upload').style.display = 'flex';
}

function render(target = 'v-grid', list = null) {
    const grid = document.getElementById(target); let d = list || allVideos;
    const isImage = (url) => url && url.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    if (currentCtx === 'imageboard') d = d.filter(v => isImage(v.url));
    else if (currentCtx === 'home') d = d.filter(v => !isImage(v.url));
    else if (currentCtx === 'studio') d = d.filter(v => v.uploader === currentUser);
    else if (currentCtx === 'liked') {
        const myLikes = JSON.parse(localStorage.getItem(`cem_likes_${currentUser}`) || '[]');
        d = d.filter(v => myLikes.includes(v.id));
    }
    else if (currentCtx === 'subscriptions') {
        const mySubs = JSON.parse(localStorage.getItem(`cem_subs_${currentUser}`) || '[]');
        d = d.filter(v => mySubs.includes(v.uploader));
    }

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
                    <div style="margin-bottom: 24px; border-radius: 12px; border: 2px solid var(--primary); box-shadow: 0 0 30px rgba(168, 85, 247, 0.3); overflow: hidden; background: #0a0a0a; position: relative; cursor: pointer; display: flex; flex-wrap: wrap;" onclick="openVideo('${pVid.id}')">
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
                            <div style="font-size:14px; color:var(--text-dim); line-height:1.6;">${pVid.details || 'No description provided.'}</div>
                        </div>
                    </div>`;
            }
        }
    }

    let html = d.map(v => `
        <div class="card" onclick="openVideo('${v.id}')" onmouseenter="handleCardHover(this)" onmouseleave="handleCardLeave(this)" style="position:relative;">
            <div class="v-thumb-wrap">
                <img src="${v.thumb}" class="v-img-prev" style="transition:0.3s; width:100%; height:100%; object-fit:cover;">
                ${v.url && !v.url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? `<video src="${v.url}" class="hover-vid" muted loop playsinline preload="none" style="width:100%; height:100%; object-fit:cover; position:absolute; inset:0;"></video>` : ''}
                <div class="dots-btn" onclick="toggleMenu(event, '${v.id}')">⋮</div>
                <div id="menu-${v.id}" class="dropdown">
                    <div onclick="shareVideo(event, '${v.id}')">🔗 Share Link</div>
                    ${(DEV_USERS.includes(currentUser) || v.uploader === currentUser) ? `<div onclick="openEdit('${v.id}', '${v.title}', '${encodeURIComponent(v.details || "")}')">✏️ Edit</div><div onclick="deleteVideo('${v.id}')">🗑️ Delete</div>` : ''}
                    ${DEV_USERS.includes(currentUser) ? `<div onclick="pinVideo('${v.id}')">📌 Pin Globally</div>` : ''}
                </div>
            </div>
            <div style="display:flex; gap:12px; margin-top:12px; z-index:10; position:relative;">
                <div class="v-avatar" style="${getAvatarStyle(v.uploader)}" onclick="event.stopPropagation(); openProfile('${v.uploader}')">${v.uploader[0]}</div>
                <div style="flex:1;">
                    <div style="font-weight:700; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" title="${v.title}">${v.title}</div>
                    <div style="font-size:12px; color:var(--text-dim); margin-top:4px; display:flex; align-items:center;">
                        ${formatName(v.uploader)}
                    </div>
                </div>
            </div>
        </div>`).join('');
    if (d.length === 0) grid.innerHTML = `<p style="color:gray; padding:20px;">No content found here yet.</p>`;
    else grid.innerHTML = html;
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
            padding: 3px 10px; font-size: 10px; font-weight: 900; margin-left: 6px; display: inline-block;
            background: ${d.badgeBg || 'transparent'};
            color: ${d.badgeTextColor || 'white'};
            border-radius: 999px; position: relative; z-index: 999; vertical-align: middle;
            ${ (d.badgeBg && d.badgeBg.includes('gradient') && d.nameMoving) ? `background-size: 200% 200%; animation: rankBGMove 3s ease infinite;` : '' }
            will-change: transform;
        }\n`;
        css += `.rank-badge-${rank.id}::before {
            content: ""; position: absolute; inset: -5px; border-radius: inherit;
            background: inherit; filter: blur(${d.badgeGlowSize || 10}px); opacity: 0.8; z-index: -1;
            ${d.badgeGlow ? `background: ${d.badgeGlow};` : ''}
            pointer-events: none;
        }\n`;
        css += `@media (max-width: 900px) {
            .rank-badge-${rank.id}::before { filter: blur(${Math.max(2, (d.badgeGlowSize || 10) / 2)}px) !important; opacity: 0.5; inset: -2px; }
            .rank-name-${rank.id} { filter: none !important; }
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

    const b = (allSettings || []).find(x => x.id === 'banner');
    if (b && b.data && document.getElementById('admin-banner-text')) {
        document.getElementById('admin-banner-text').value = b.data.text || '';
        document.getElementById('admin-banner-color').value = b.data.color || '#e11d48';
    }
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
            <h4 style="margin-top:15px; border-top:1px solid var(--border); padding-top:15px; color:#e11d48;">⚠️ Force Reset Password</h4>
            <p style="font-size:12px; color:gray; margin-top:-10px; margin-bottom:10px;">Set a new password for the user. Requires the admin secret key.</p>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <input type="password" id="admin-new-pass" placeholder="New Password..." style="margin-bottom:0; flex:1; min-width:140px;">
                <input type="password" id="admin-key-input" placeholder="Admin Key..." style="margin-bottom:0; flex:1; min-width:140px;">
                <button class="primary-btn" style="width:auto; padding:8px 16px; background:#e11d48;" onclick="adminResetPassword('${p.username}')">Set Password</button>
            </div>
        </div>
    `;
}

async function adminResetPassword(user) {
    const key = document.getElementById('admin-key-input').value;
    const newPass = document.getElementById('admin-new-pass').value;
    
    if (!key) return alert("Enter the Admin Key!");
    if (!newPass || newPass.length < 6) return alert("Password must be at least 6 characters.");

    const btn = event.target;
    btn.innerText = "Setting..."; btn.disabled = true;

    const { data, error } = await supabaseClient.rpc('admin_reset_password', {
        p_username: user,
        p_new_password: newPass,
        p_admin_key: key
    });

    btn.innerText = "Set Password"; btn.disabled = false;

    if (error) return alert("RPC Error: " + error.message + "\n\nMake sure you ran the SQL function in Supabase.");
    if (data && data.startsWith('error:')) return alert("Failed: " + data.replace('error:', ''));
    alert("✅ Password for " + user + " has been updated successfully!");
    document.getElementById('admin-new-pass').value = '';
    document.getElementById('admin-key-input').value = '';
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
    pBadge.style.padding = '3px 8px';
    pBadge.style.fontSize = '10px';
    pBadge.style.fontWeight = '900';
    pBadge.style.marginLeft = '6px';

    pBadge.innerText = document.getElementById('r-badge-text').value || 'BADGE';
    pBadge.style.color = document.getElementById('r-badge-text-col').value;
    pBadge.style.borderRadius = '100px';

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

async function openVideo(id) {
    activeVideo = allVideos.find(v => v.id == id); 
    if (!activeVideo) return;

    // Update URL without reloading (only if changed)
    const slug = activeVideo.video_id || activeVideo.id;
    const currentUrl = new URL(window.location);
    if (window.location.protocol !== 'file:' && currentUrl.pathname !== '/v/' + slug) {
        if (!currentUrl.pathname.startsWith('/v/')) {
            window.lastUrlBeforeVideo = currentUrl.pathname + currentUrl.search;
        }
        const newUrl = window.location.origin + '/v/' + slug;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }

    document.querySelectorAll('.page-view').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
    const pLayer = document.getElementById('player-page');
    if (pLayer) { pLayer.style.display = 'block'; pLayer.classList.add('active'); }
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
    document.body.classList.add('theater-mode'); 
    const isYT = activeVideo.url.includes('youtube.com') || activeVideo.url.includes('youtu.be');
    
    if (isYT) {
        const ytId = extractYouTubeID(activeVideo.url);
        t.innerHTML = `
            <div id="yt-player-container" style="width:100%; height:100%; position:relative;">
                <div id="yt-placeholder"></div>
                <div id="yt-custom-controls" class="custom-player-ui active">
                    <div class="player-top"></div>

                    <div class="player-center" onclick="toggleYT()">
                        <div id="yt-play-center" class="center-play-btn" style="display:none;">▶</div>
                    </div>
                    <div class="player-bottom">
                        <div class="seek-bar-container" id="yt-seek-bar" onclick="seekYT(event)">
                            <div id="yt-seek-fill" class="seek-fill"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                            <div style="display:flex; align-items:center; gap:15px;">
                                <button onclick="toggleYT()" id="yt-play-btn" style="font-size:18px;">⏸</button>
                                <span id="yt-time" class="player-time-display">0:00 / 0:00</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:15px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-size:12px; opacity:0.6;">🔊</span>
                                    <input type="range" min="0" max="100" value="100" oninput="setYTVolume(this.value)" style="width:60px; height:4px; accent-color:var(--primary); margin:0;">
                                </div>
                                <button onclick="toggleYTFullscreen()" style="font-size:18px;">⛶</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        window.ytPlayer = new YT.Player('yt-placeholder', {
            height: '100%', width: '100%', videoId: ytId,
            playerVars: { 'controls': 0, 'disablekb': 1, 'modestbranding': 1, 'rel': 0, 'showinfo': 0, 'iv_load_policy': 3, 'fs': 0, 'autoplay': 1 },
            events: { 'onReady': onYTReady, 'onStateChange': onYTStateChange }
        });
        
        // Attribution Refactor
        const ytAttr = document.getElementById('p-yt-attribution');
        const isYT = activeVideo.url.includes('youtube.com') || activeVideo.url.includes('youtu.be');
        
        if (isYT) {
            ytAttr.style.display = 'block';
            ytAttr.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="background:var(--primary); color:white; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:900;">ABYSS x YOUTUBE</span>
                        <span style="font-weight:800; font-size:12px; opacity:0.6;">SOURCE CONTENT</span>
                    </div>
                    <a href="${activeVideo.url}" target="_blank" style="color:var(--primary); text-decoration:none; font-weight:800; font-size:12px;">VIEW ORIGINAL →</a>
                </div>
            `;
        } else {
            ytAttr.style.display = 'none';
        }
    } else {

        const isImg = activeVideo.url.match(/\.(jpg|jpeg|png|webp|gif)$/i);
        if (isImg) {
            t.innerHTML = `<img src="${activeVideo.url}" class="p-media">`;
        } else {
            t.innerHTML = `
                <div id="native-player-container" style="width:100%; height:100%; position:relative;">
                    <video id="native-player" autoplay src="${activeVideo.url}" style="width:100%; height:100%; object-fit:contain;"></video>
                    <div id="native-custom-controls" class="custom-player-ui active">
                        <div class="player-top"></div>
                        <div class="player-center" onclick="toggleNative()">
                            <div id="native-play-center" class="center-play-btn" style="display:none;">▶</div>
                        </div>
                        <div class="player-bottom">
                            <div class="seek-bar-container" id="native-seek-bar" onclick="seekNative(event)">
                                <div id="native-seek-fill" class="seek-fill"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                                <div style="display:flex; align-items:center; gap:15px;">
                                    <button onclick="toggleNative()" id="native-play-btn" style="font-size:18px;">⏸</button>
                                    <span id="native-time" class="player-time-display">0:00 / 0:00</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:15px;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <span style="font-size:12px; opacity:0.6;">🔊</span>
                                        <input type="range" min="0" max="1" step="0.1" value="1" oninput="setNativeVolume(this.value)" style="width:60px; height:4px; accent-color:var(--primary); margin:0;">
                                    </div>
                                    <button onclick="toggleNativeFullscreen()" style="font-size:18px;">⛶</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const nv = document.getElementById('native-player');
            nv.addEventListener('timeupdate', updateNativeProgress);
            nv.addEventListener('ended', playNext);
        }
    }


    
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
    rG.innerHTML = l.map(v => `<div class="rec-card" onclick="openVideo('${v.id}')"><div class="rec-thumb"><img src="${v.thumb}" style="width:100%;height:100%;object-fit:cover"></div><div class="rec-info"><div class="rec-title">${v.title}</div><div style="font-size:12px;color:gray;margin-top:4px;display:flex;align-items:center;">${formatName(v.uploader)}</div></div></div>`).join('');
}

function playNext() {
    const validRecs = allVideos.filter(v => v.id != activeVideo.id).filter(v => {
        if (DEV_USERS.includes(currentUser) || v.uploader === currentUser) return true;
        const p = allProfiles.find(x => x.username === v.uploader);
        return !(p && p.is_shadowbanned);
    });
    const n = validRecs[0];
    if (n) openVideo(n.id);
}

async function postComment() {
    if (!currentUser) return openAuth();
    const inp = document.getElementById('comm-input');
    const txt = inp.value.trim(); if (!txt) return;

    let existing = activeVideo.comments ? (typeof activeVideo.comments === 'string' ? JSON.parse(activeVideo.comments) : activeVideo.comments) : [];
    const newId = Date.now() + Math.random().toString(36).substr(2, 5);
    const newComment = { id: newId, user: currentUser, text: txt, time: Date.now(), parentId: activeReplyId };
    
    existing.push(newComment);
    
    const { error } = await supabaseClient.from('videos').update({ comments: JSON.stringify(existing) }).eq('id', activeVideo.id);
    if (!error) {
        activeVideo.comments = JSON.stringify(existing);
        inp.value = '';
        cancelReply();
        loadComments();

        // NOTIFICATIONS
        // 1. Notify Video Owner
        if (activeVideo.uploader !== currentUser) {
            pushNotif(activeVideo.uploader, activeReplyId ? 'replied' : 'commented', activeVideo.id, newId);
        }

        // 2. Notify Parent Commenter (if it's a reply)
        if (activeReplyId) {
            const parent = existing.find(c => c.id == activeReplyId);
            if (parent && parent.user !== currentUser && parent.user !== activeVideo.uploader) {
                pushNotif(parent.user, 'replied', activeVideo.id, newId);
            }
        }
    }
}

function loadComments() {
    const list = document.getElementById('comments-list');
    let arr = activeVideo.comments ? (typeof activeVideo.comments === 'string' ? JSON.parse(activeVideo.comments) : activeVideo.comments) : [];
    
    // Ensure all comments have IDs and status
    arr = arr.map((c, i) => ({ ...c, id: c.id || `legacy-${i}`, isPinned: !!c.isPinned }));

    // STRICT Sorting: Pinned first (1-0), then Newest first (time)
    const sorted = [...arr].sort((a,b) => {
        if (b.isPinned !== a.isPinned) return b.isPinned - a.isPinned;
        return (b.time || 0) - (a.time || 0);
    });

    // Top-level comments
    const isParent = c => !c.parentId || c.parentId === 'undefined' || c.parentId === 'null';
    const parents = sorted.filter(c => isParent(c));
    const children = sorted.filter(c => !isParent(c));

    list.innerHTML = parents.map(p => {
        const subReplies = children.filter(c => c.parentId == p.id);
        const pinHtml = p.isPinned ? `<div style="color:var(--primary); font-size:11px; font-weight:800; margin-bottom:5px; display:flex; align-items:center; gap:5px;">📌 Pinned</div>` : '';
        const canPin = activeVideo.uploader === currentUser;

        return `
        <div class="comment-item" id="comment-${p.id}" style="margin-bottom:20px;">
            ${pinHtml}
            <div style="display:flex; gap:12px;">
                <div class="v-avatar" style="width:36px; height:36px; font-size:14px; flex-shrink:0; ${getAvatarStyle(p.user)}" onclick="openProfile('${p.user}')">${p.user[0]}</div>
                <div style="flex:1">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="comment-user" onclick="openProfile('${p.user}')">${formatName(p.user)}</div>
                        ${p.user === activeVideo.uploader ? '<span style="background:var(--primary); color:white; font-size:9px; padding:2px 6px; border-radius:100px; font-weight:800;">OWNER</span>' : ''}
                    </div>
                    <div class="comment-text">${p.text}</div>
                    <div style="display:flex; gap:15px; margin-top:8px;">
                        <span onclick="openReply('${p.id}', '${p.user}')" style="font-size:11px; color:var(--primary); cursor:pointer; font-weight:800;">Reply</span>
                        ${(DEV_USERS.includes(currentUser) || p.user === currentUser) ? `<span onclick="deleteComment('${p.id}')" style="color:rgba(255,0,0,0.6); font-size:11px; cursor:pointer;">Delete</span>` : ''}
                        ${canPin ? `<span onclick="togglePinComment('${p.id}')" style="color:var(--primary); font-size:11px; cursor:pointer;">${p.isPinned ? 'Unpin' : 'Pin'}</span>` : ''}
                    </div>

                    ${subReplies.length > 0 ? `
                        <div id="toggle-replies-${p.id}" onclick="toggleRepliesDisplay('${p.id}')" style="margin-top:10px; color:var(--primary); font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px;">
                            <span id="icon-replies-${p.id}">▶</span> View ${subReplies.length} replies
                        </div>
                        <div id="replies-${p.id}" style="margin-top:10px; border-left: 2px solid var(--border); padding-left:15px; display:none;">
                            ${subReplies.map(c => `
                                <div class="comment-item" id="comment-${c.id}" style="margin-top:15px; padding:0;">
                                    <div style="display:flex; gap:10px;">
                                        <div class="v-avatar" style="width:28px; height:28px; font-size:10px; flex-shrink:0; ${getAvatarStyle(c.user)}" onclick="openProfile('${c.user}')">${c.user[0]}</div>
                                        <div style="flex:1">
                                            <div style="display:flex; align-items:center; gap:8px;">
                                                <div class="comment-user" style="font-size:12px;" onclick="openProfile('${c.user}')">${formatName(c.user)}</div>
                                            </div>
                                            <div class="comment-text" style="font-size:13px;">${c.text}</div>
                                            <div style="display:flex; gap:15px; margin-top:5px;">
                                                <span onclick="openReply('${p.id}', '${c.user}')" style="font-size:11px; color:var(--primary); cursor:pointer; font-weight:800;">Reply</span>
                                                ${(DEV_USERS.includes(currentUser) || c.user === currentUser) ? `<span onclick="deleteComment('${c.id}')" style="color:rgba(255,0,0,0.6); font-size:11px; cursor:pointer;">Delete</span>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>`;
    }).join('') || '<p style="color:gray; text-align:center; padding:20px;">No comments yet. Be the first!</p>';
}

function toggleRepliesDisplay(id) {
    const list = document.getElementById(`replies-${id}`);
    const icon = document.getElementById(`icon-replies-${id}`);
    const btn = document.getElementById(`toggle-replies-${id}`);
    if (list.style.display === 'none') {
        list.style.display = 'block';
        icon.innerText = '▼';
        btn.innerHTML = `<span id="icon-replies-${id}">▼</span> Hide replies`;
    } else {
        list.style.display = 'none';
        icon.innerText = '▶';
        btn.innerHTML = `<span id="icon-replies-${id}">▶</span> View replies`;
    }
}

async function togglePinComment(id) {
    let arr = activeVideo.comments ? (typeof activeVideo.comments === 'string' ? JSON.parse(activeVideo.comments) : activeVideo.comments) : [];
    arr.forEach(c => {
        if (c.id == id) c.isPinned = !c.isPinned;
        else if (!c.parentId) c.isPinned = false; 
    });
    const { error } = await supabaseClient.from('videos').update({ comments: JSON.stringify(arr) }).eq('id', activeVideo.id);
    if (!error) { activeVideo.comments = arr; loadComments(); }
}

let activeReplyId = null;
function openReply(id, user) {
    activeReplyId = id;
    const inp = document.getElementById('com-input') || document.getElementById('comm-input');
    if (inp) { inp.focus(); inp.placeholder = `Replying to @${user}...`; }
    const hint = document.getElementById('reply-hint');
    if (hint) hint.style.display = 'block';
}

function cancelReply() {
    activeReplyId = null;
    const inp = document.getElementById('com-input') || document.getElementById('comm-input');
    if (inp) inp.placeholder = 'Add a public comment...';
    const hint = document.getElementById('reply-hint');
    if (hint) hint.style.display = 'none';
}

async function addComment() {
    if (!currentUser) return openAuth();
    const inp = document.getElementById('com-input') || document.getElementById('comm-input');
    const txt = inp.value.trim(); if (!txt) return;

    let existing = activeVideo.comments ? (typeof activeVideo.comments === 'string' ? JSON.parse(activeVideo.comments) : activeVideo.comments) : [];
    const newId = Date.now() + Math.random().toString(36).substr(2, 5);
    const newComment = { id: newId, user: currentUser, text: txt, time: Date.now(), parentId: activeReplyId, isPinned: false };
    
    existing.push(newComment);
    
    const { error } = await supabaseClient.from('videos').update({ comments: JSON.stringify(existing) }).eq('id', activeVideo.id);
    if (!error) {
    const commentContent = inp.value;
    activeVideo.comments = existing; inp.value = ''; cancelReply(); loadComments();

    // Notifications
    if (activeVideo.uploader !== currentUser) {
        pushNotif(activeVideo.uploader, activeReplyId ? 'reply' : 'comment', { 
            videoId: activeVideo.id, 
            commentId: newId, 
            content: commentContent, 
            videoTitle: activeVideo.title 
        });
    }
        if (activeReplyId) {
            const parent = existing.find(c => c.id == activeReplyId);
            if (parent && parent.user !== currentUser && parent.user !== activeVideo.uploader) {
                pushNotif(parent.user, 'reply', { 
                    videoId: activeVideo.id, 
                    commentId: newId, 
                    content: commentContent,
                    videoTitle: activeVideo.title
                });
            }
        }
    }
}

async function deleteComment(id) {
    if (!confirm("Delete this comment?")) return;
    let arr = activeVideo.comments ? (typeof activeVideo.comments === 'string' ? JSON.parse(activeVideo.comments) : activeVideo.comments) : [];
    arr = arr.filter(c => c.id != id && c.parentId != id);
    const { error } = await supabaseClient.from('videos').update({ comments: JSON.stringify(arr) }).eq('id', activeVideo.id);
    if (!error) { activeVideo.comments = arr; loadComments(); }
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
    pushNotif(activeVideo.uploader, 'like', { from: currentUser, videoId: activeVideo.id, videoTitle: activeVideo.title });
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
        pushNotif(activeVideo.uploader, 'sub', { from: currentUser });
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

let isSubbingProf = false;
async function toggleSubFromProfile(u) {
    if (!currentUser) return openAuth();
    if (isSubbingProf) return;
    isSubbingProf = true;

    let localSubs = JSON.parse(localStorage.getItem(`cem_subs_${currentUser}`) || '[]');
    const isSubbed = localSubs.includes(u);
    const p = allProfiles.find(x => x.username === u);
    let n = p.subscribers || 0;

    const btn = document.getElementById('profile-sub-btn');

    if (!isSubbed) {
        n += 1;
        localSubs.push(u);
        pushNotif(u, 'sub', { from: currentUser });
        if (btn) { btn.innerText = 'SUBSCRIBED'; btn.style.background = '#222'; }
    } else {
        n = Math.max(0, n - 1);
        localSubs = localSubs.filter(x => x !== u);
        if (btn) { btn.innerText = 'SUBSCRIBE'; btn.style.background = 'var(--primary)'; }
    }

    localStorage.setItem(`cem_subs_${currentUser}`, JSON.stringify(localSubs));
    p.subscribers = n;
    
    const statEl = document.getElementById('p-stats');
    if (statEl) statEl.innerHTML = `<span style="color:#fff; letter-spacing:1px;">${n} SUBSCRIBERS</span>`;

    await supabaseClient.from('profiles').update({ subscribers: n }).eq('username', u);
    isSubbingProf = false;
}

function renderSubscriptions() {
    const list = document.getElementById('subs-grid');
    list.className = ''; // Expand to full width blocks
    const mySubs = JSON.parse(localStorage.getItem(`cem_subs_${currentUser}`) || '[]');
    
    if (mySubs.length === 0) {
        list.innerHTML = `<p style="color:gray; padding:20px;">You haven't subscribed to anyone yet.</p>`;
        return;
    }

    let html = '';
    mySubs.forEach(u => {
        const p = allProfiles.find(x => x.username === u);
        if (!p) return;
        const dName = p.display_name || u;
        let pVideos = allVideos.filter(v => v.uploader === u);
        
        if (!DEV_USERS.includes(currentUser) && currentUser !== u && p.is_shadowbanned) return;

        // Sort latest 4 videos
        pVideos.sort((a,b) => b.id - a.id);
        const latest = pVideos.slice(0, 4);

        let vHtml = latest.map(v => `
            <div class="card" onclick="openVideo('${v.id}')" onmouseenter="handleCardHover(this)" onmouseleave="handleCardLeave(this)" style="min-width:220px; max-width:250px; cursor:pointer; position:relative;">
                <div class="v-thumb-wrap" style="aspect-ratio:16/9; border-radius:12px; overflow:hidden; position:relative;">
                    <img src="${v.thumb}" class="v-img-prev" style="width:100%; height:100%; object-fit:cover; transition:0.3s;">
                    ${v.url && !v.url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? `<video src="${v.url}" class="hover-vid" muted loop playsinline preload="none" style="width:100%; height:100%; object-fit:cover; position:absolute; inset:0;"></video>` : ''}
                </div>
                <div style="font-weight:700; font-size:13px; margin-top:8px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" title="${v.title}">${v.title}</div>
            </div>
        `).join('');

        if (latest.length === 0) vHtml = `<div style="color:gray; font-size:12px; padding:10px;">No videos uploaded yet.</div>`;

        html += `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:24px; padding:20px; display:flex; flex-direction:column; gap:15px; margin-bottom:20px;">
                <div style="display:flex; align-items:center; gap:15px; cursor:pointer;" onclick="openProfile('${u}')">
                    <div class="v-avatar" style="width:50px; height:50px; font-size:20px; border-radius:50%; ${getAvatarStyle(u)}">${u[0]}</div>
                    <div style="flex:1;">
                        <div style="font-size:18px; font-weight:800; display:flex; gap:8px; align-items:center;">
                            ${formatName(u)}
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:15px; overflow-x:auto; padding-bottom:10px;">
                    ${vHtml}
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
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
                syncUploadUI('file');
            }
        }
    }
});

function syncUploadUI(mode) {
    const ytUrl = document.getElementById('vid-yt-url').value.trim();
    const file = document.getElementById('vid-input').files[0] || currentUploadFile;
    const ytSec = document.getElementById('yt-import-sec');
    const fileSec = document.getElementById('local-file-sec');
    const sep = document.getElementById('upload-or-sep');

    if (mode === 'yt' && ytUrl) {
        fileSec.style.opacity = '0.3';
        fileSec.style.pointerEvents = 'none';
        sep.style.opacity = '0.3';
    } else if (mode === 'file' && file) {
        ytSec.style.opacity = '0.3';
        ytSec.style.pointerEvents = 'none';
        sep.style.opacity = '0.3';
    } else {
        fileSec.style.opacity = '1';
        fileSec.style.pointerEvents = 'auto';
        ytSec.style.opacity = '1';
        ytSec.style.pointerEvents = 'auto';
        sep.style.opacity = '1';
    }
}


function generateVideoID() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let res = "";
    for (let i = 0; i < 11; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
}

async function handleUpload() {
    if (!currentUser) return openAuth();
    const ytUrl = document.getElementById('vid-yt-url').value.trim();
    const ytId = extractYouTubeID(ytUrl);
    const v = ytId ? null : (currentUploadFile || document.getElementById('vid-input').files[0]);
    const tFile = document.getElementById('vid-thumb').files[0];

    if (!ytId && !v) return alert("Please select a file or paste a YouTube link!");

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
        } else if (ytId) {
            thumbUrl = getYouTubeThumbnail(ytId);
        }
        bar.style.width = "40%";

        let finalVideoUrl = ytUrl;
        if (!ytId && v) {
            const fd = new FormData(); fd.append('file', v); fd.append('upload_preset', UPLOAD_PRESET);
            const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
            const d = await r.json();
            if (d.error) throw new Error("Video Upload Error: " + d.error.message);
            finalVideoUrl = d.secure_url;
        }

        const vid_slug = generateVideoID();
        const { error: dbError } = await supabaseClient.from('videos').insert([{
            video_id: vid_slug,
            title: document.getElementById('vid-name').value || (ytId ? "YouTube Import" : v.name),
            uploader: currentUser,
            url: finalVideoUrl,
            thumb: thumbUrl,
            views: 0, likes: 0,
            details: document.getElementById('vid-desc').value
        }]);

        if (dbError) throw new Error("Database Error: " + dbError.message);
        bar.style.width = "100%";
        setTimeout(() => location.reload(), 800);
    } catch (e) {
        console.error(e);
        alert("Action Failed -> " + e.message);
        btn.disabled = false;
        bar.style.width = "0%";
    }
}


function openProfile(user) {
    if (profileAudio) { profileAudio.pause(); profileAudio = null; }
    currentCtx = 'profile'; 
    document.querySelectorAll('.side-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page-view').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
    const v = document.getElementById('view-profile'); 
    if (v) { v.classList.add('active'); v.style.display = 'block'; }
    closeSidebar(); closePlayer();

    const p = allProfiles.find(x => x.username === user);
    if (!p) return;

    // Profile Music
    if (p.music_url) {
        profileAudio = new Audio(p.music_url); profileAudio.volume = 0.15; // Normalized to 15% to protect ears
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
    const localSubs = JSON.parse(localStorage.getItem(`cem_subs_${currentUser}`) || '[]');
    document.getElementById('p-name-area').innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap;">
            <h1 style="margin:0; font-size:36px; color:#fff; text-shadow: 0 0 20px ${bColor};">${p.display_name || user}</h1>
            ${getRankBadge(user)}
        </div>
        <div style="color:rgba(255,255,255,0.6); font-size:18px; margin-top:8px;">@${user}</div>
        ${user !== currentUser ? `
            <div style="margin-top:20px;">
                <button id="profile-sub-btn" class="primary-btn" style="width:auto; padding:10px 30px; font-size:14px; background:${localSubs.includes(user) ? '#222' : 'var(--primary)'}; border:none; border-radius:100px; font-weight:800; cursor:pointer; transition:0.3s;" onclick="toggleSubFromProfile('${user}')">
                    ${localSubs.includes(user) ? 'SUBSCRIBED' : 'SUBSCRIBE'}
                </button>
            </div>
        ` : ''}
    `;

    // Bio
    document.getElementById('p-bio').innerText = p.bio || 'This user hasn\'t written a bio yet.';
    
    // Socials
    const socials = p.social_links ? (typeof p.social_links === 'string' ? JSON.parse(p.social_links) : p.social_links) : {};
    let sHtml = '';
    if (socials.yt) sHtml += `<a href="https://www.youtube.com/${socials.yt.startsWith('@') ? socials.yt : '@'+socials.yt}" target="_blank"><img src="youtube.png" class="social-link-icon" style="width:36px; height:36px; transition:0.3s; filter:drop-shadow(0 0 10px rgba(255,0,0,0.3)); cursor:pointer;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></a>`;
    if (socials.ig) sHtml += `<a href="https://www.instagram.com/${socials.ig}/" target="_blank"><img src="instagram.png" class="social-link-icon" style="width:36px; height:36px; transition:0.3s; filter:drop-shadow(0 0 10px rgba(255,0,255,0.3)); cursor:pointer;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></a>`;
    if (socials.tiktok) sHtml += `<a href="https://www.tiktok.com/${socials.tiktok.startsWith('@') ? socials.tiktok : '@'+socials.tiktok}" target="_blank"><img src="tiktok.png" class="social-link-icon" style="width:36px; height:36px; transition:0.3s; filter:drop-shadow(0 0 10px rgba(255,255,255,0.3)); cursor:pointer;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></a>`;
    if (socials.discord) sHtml += `<img src="discord.png" class="social-link-icon" title="Discord: ${socials.discord}" style="width:36px; height:36px; transition:0.3s; filter:drop-shadow(0 0 10px rgba(88,101,242,0.3)); cursor:pointer;" onclick="alert('Discord: ${socials.discord}')" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">`;
    document.getElementById('p-socials').innerHTML = sHtml;

    // Stats & Badges
    document.getElementById('p-stats').innerHTML = `<span style="color:#fff; letter-spacing:1px;">${p.subscribers || 0} SUBSCRIBERS</span>`;
    
    const badges = p.badges ? JSON.parse(p.badges) : [];
    document.getElementById('p-badges').innerHTML = badges.map(b => `<span class="badge-item" style="font-size:32px;">${b}</span>`).join('');

    render('profile-grid', allVideos.filter(v => v.uploader === user));

    // PUSH PRETTY URL
    const newPath = '/@' + user;
    if (window.location.protocol !== 'file:' && window.location.pathname !== newPath) {
        window.history.pushState({ path: newPath }, '', newPath);
    }
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
function openUpload() { 
    document.getElementById('modal-upload').style.display = 'flex'; 
    syncUploadUI(); // Ensure fresh state
}
function closeUpload() { 
    document.getElementById('modal-upload').style.display = 'none'; 
    document.getElementById('vid-yt-url').value = "";
    currentUploadFile = null;
    syncUploadUI();
}

function closeEdit() { document.getElementById('modal-edit').style.display = 'none'; }
function closePlayer() { 
    document.getElementById('player-page').style.display = 'none'; 
    document.getElementById('p-target').innerHTML = ""; 
    document.body.classList.remove('theater-mode');
    
    if (window.ytPlayer) {
        window.ytPlayer.destroy();
        window.ytPlayer = null;
        if (window.ytProgInt) clearInterval(window.ytProgInt);
    }
    
    const targetView = document.getElementById(`view-${currentCtx === 'studio' || currentCtx === 'imageboard' ? 'home' : (currentCtx === 'profile' ? 'profile' : currentCtx)}`);
    if (targetView) {
        targetView.classList.add('active');
        targetView.style.display = 'block';
    }

    if (window.location.protocol !== 'file:') {
        const fallBackUrl = window.lastUrlBeforeVideo || '/';
        const newUrl = window.location.origin + fallBackUrl;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }
}

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
    document.body.style.backgroundAttachment = "scroll";
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

async function broadcastGlobalBanner() {
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
    const shooting = galaxyClass ? 'data-shooting="true"' : '';

    return `
        <div class="video-card ${galaxyClass}" ${shooting} style="padding:15px; text-align:center;">
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

async function pushNotif(target, type, data) {
    if (!target || target === currentUser) return;
    const p = allProfiles.find(x => x.username === target);
    if (!p) return;

    // Smart data injection
    if (typeof data !== 'object') data = { videoId: data };
    if (!data.from) data.from = currentUser;

    // Privacy Check
    const sender = allProfiles.find(x => x.username === currentUser);
    if (sender && sender.is_anonymous && (type === 'like' || type === 'sub')) data.anon = true;

    const notifs = p.notifications ? (typeof p.notifications === 'string' ? JSON.parse(p.notifications) : p.notifications) : [];
    notifs.push({ id: Date.now(), type, data, seen: false });
    await supabaseClient.from('profiles').update({ notifications: JSON.stringify(notifs.slice(-50)) }).eq('username', target);
}

function truncate(str, n = 20) { return (str.length > n) ? str.slice(0, n-1) + "..." : str; }

function toggleNotifs() {
    const drp = document.getElementById('notif-dropdown');
    drp.classList.toggle('active');
    if (drp.classList.contains('active')) renderNotifs();
}

let notifsMax = 4;
function expandNotifs(e) { e.stopPropagation(); notifsMax = 99; renderNotifs(); }

function renderNotifs() {
    const list = document.getElementById('notif-list');
    const p = allProfiles.find(x => x.username === currentUser);
    if (!p) return;
    const notifsRaw = p.notifications ? (typeof p.notifications === 'string' ? JSON.parse(p.notifications) : p.notifications) : [];
    
    const validNotifs = [];
    notifsRaw.forEach(n => {
        let msg = "";
        let sender = (n.data && n.data.anon) ? "Anonymous User" : (n.data ? n.data.from : 'Unknown');
        let onClick = (n.data && n.data.anon) ? "" : `onclick="openProfile('${sender}')" style="cursor:pointer; color:var(--primary);"`;
        
        let linkAction = "";
        if (n.data && n.data.videoId) {
            const slug = n.data.slug || n.data.videoId;
            const cParam = n.data.commentId ? `&c=${n.data.commentId}` : '';
            linkAction = `onclick="window.location.href='?v=${slug}${cParam}'" style="cursor:pointer;"`;
        }

        if (n.type === 'like') msg = `<span ${linkAction}><b ${onClick}>${sender}</b> liked your video <i>"${truncate(n.data.videoTitle || 'a video')}"</i></span>`;
        if (n.type === 'comment') msg = `<span ${linkAction}><b ${onClick}>${sender}</b> commented: <i>"${truncate(n.data.content, 30)}"</i></span>`;
        if (n.type === 'reply') msg = `<span ${linkAction}><b ${onClick}>${sender}</b> replied: <i>"${truncate(n.data.content, 30)}"</i></span>`;
        if (n.type === 'sub') msg = `<b ${onClick}>${sender}</b> subscribed to you!`;

        if (msg) validNotifs.push({ ...n, builtHtml: msg });
    });

    const reversed = validNotifs.reverse();
    const showing = reversed.slice(0, notifsMax);

    let html = showing.map(n => `
        <div class="notif-item" style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px; line-height:1.4;">
            ${n.builtHtml}
            <div style="font-size:10px; color:gray; margin-top:4px;">${new Date(n.id).toLocaleTimeString()}</div>
        </div>
    `).join('');

    if (reversed.length === 0) html = '<div style="padding:40px 20px; text-align:center; color:gray;">All caught up! ✨</div>';
    else if (reversed.length > notifsMax) {
        html += `<div onclick="expandNotifs(event)" style="padding:12px; text-align:center; font-size:12px; font-weight:800; color:var(--primary); cursor:pointer; background:rgba(0,0,0,0.3);">View ${reversed.length - notifsMax} More</div>`;
    }

    list.innerHTML = html;
    updateNotifBadge(0);
}

async function clearNotifs(e) {
    e.stopPropagation();
    if (!confirm("Clear all notifications?")) return;
    await supabaseClient.from('profiles').update({ notifications: JSON.stringify([]) }).eq('username', currentUser);
    renderNotifs();
}

function updateNotifBadge(count) {
    const b = document.getElementById('notif-badge');
    if (!b) return;
    if (count > 0) {
        b.style.display = 'flex';
        b.innerText = count > 99 ? '99+' : count;
    } else {
        b.style.display = 'none';
    }
}

async function buyTheme(tid, price) {
    const p = allProfiles.find(x => x.username === currentUser);
    if (!p) return;
    const coins = p.coins || 0;
    if (coins < price) return alert("Not enough CemCoins! Login tomorrow for more.");
    if (!confirm(`Buy theme for ${price} coins?`)) return;

    let existingThemes = p.unlocked_themes || [];

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
    const music = document.getElementById('set-music').value.trim();
    const anon = document.getElementById('set-anon').checked;
    await supabaseClient.from('profiles').update({ 
        social_links: soc,
        music_url: music,
        is_anonymous: anon
    }).eq('username', currentUser);
    fetchData(); alert("Settings updated!");
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

let profileAudio = null;

function renderSettings() {
    const p = allProfiles.find(x => x.username === currentUser);
    if (!p) return;
    
    document.getElementById('set-name').value = p.display_name || '';
    document.getElementById('set-bio').value = p.bio || '';
    document.getElementById('set-music').value = p.music_url || '';

    let soc = p.social_links || {};
    if (typeof soc === 'string') try { soc = JSON.parse(soc); } catch(e){soc={};}
    
    if (document.getElementById('set-yt')) document.getElementById('set-yt').value = soc.yt || '';
    if (document.getElementById('set-discord')) document.getElementById('set-discord').value = soc.discord || '';
    if (document.getElementById('set-ig')) document.getElementById('set-ig').value = soc.ig || '';
    if (document.getElementById('set-tiktok')) document.getElementById('set-tiktok').value = soc.tiktok || '';

    if (document.getElementById('set-anon')) document.getElementById('set-anon').checked = !!p.is_anonymous;

    const pCard = document.getElementById('perf-card');
    if (pCard) {
        // Sync setting with current body class status
        document.getElementById('set-low-perf').checked = document.body.classList.contains('mobile-low-perf');
    }

    // Galaxy Visibility
    const gCard = document.getElementById('settings-galaxy-card');
    if (gCard) gCard.style.display = (p.unlocked_themes || []).includes('galaxy') ? 'block' : 'none';

    // Themes Grid (Owned)
    let unlocked = p.unlocked_themes || [];
    let themeHtml = `
        <div class="theme-btn" style="background:#a855f7" onclick="setTheme('default')">Default (Purple)</div>
        <div class="theme-btn" style="background:#e11d48" onclick="setTheme('midnight-red')">Midnight Red</div>
        <div class="theme-btn" style="background:#0ea5e9" onclick="setTheme('ocean')">Ocean Blue</div>
        <div class="theme-btn" style="background:#10b981" onclick="setTheme('forest')">Forest Green</div>
        <div class="theme-btn" style="background:#f59e0b" onclick="setTheme('eclipse')">Eclipse Orange</div>
        <div class="theme-btn" style="background:#6366f1" onclick="setTheme('abyss')">Deep Abyss</div>
    `;
    MARKET_THEMES.forEach(t => {
        if (unlocked.includes(t.id)) {
            themeHtml += `<div class="theme-btn" style="background:${t.color}; border:2px solid gold;" onclick="setTheme('${t.id}')">★ ${t.name} ${t.id === 'galaxy' ? '🌌' : ''}</div>`;
        }
    });
    const grid = document.getElementById('my-themes-grid');
    if (grid) grid.innerHTML = themeHtml;
}

// Rogue redundant duplicate removed to prevent blank admin screen (all logic merged into line 456)


if (currentUser && DEV_USERS.includes(currentUser)) {
    const adminNav = document.getElementById('admin-nav-item');
    if (adminNav) adminNav.style.display = 'flex';
}
fetchData();

function switchTo(v) {
    try { 
        const el = document.querySelector(`.side-item[data-ctx="${v}"], .nav-item[data-ctx="${v}"]`);
        setContext(v, el); 
    } catch(e){}
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
// Global alias to prevent "playVideo is not defined" errors during transition
const playVideo = openVideo;

function shareVideo(e, id) {
    if (e) e.stopPropagation();
    const v = allVideos.find(x => x.id == id);
    if (!v) return;
    const slug = v.video_id || v.id;
    const url = window.location.origin + '/v/' + slug;
    
    if (navigator.share) {
        navigator.share({ title: v.title, url: url }).catch(() => {
            navigator.clipboard.writeText(url);
            alert("Link copied to clipboard!");
        });
    } else {
        navigator.clipboard.writeText(url);
        alert("Link copied to clipboard!");
    }
}

function togglePerfMode() {
    const isChecked = document.getElementById('set-low-perf').checked;
    localStorage.setItem('cem_low_perf', isChecked ? 'true' : 'false');
    applyPerfSetting();
    if (isChecked) {
        alert("Low Performance Mode ENABLED: Heavy animations, backdrop blurs, and hover-previews are now disabled to ensure the smoothest possible experience.");
    } else {
        alert("Cinematic Mode ENABLED: All high-quality animations and background effects have been restored! This may slow down older devices.");
    }
}

window.handleCardHover = function(el) {
    if (document.body.classList.contains('mobile-low-perf')) return;
    try {
        const vid = el.querySelector('.hover-vid');
        if (vid) { vid.playbackRate = 1.0; vid.play(); } 
        const img = el.querySelector('.v-img-prev');
        if (img && vid) img.style.opacity = 0; // Only hide thumbnail if an actual video exists!
        
        el._hoverT = setTimeout(() => {
            el.originalZIndex = el.style.zIndex;
            el.style.zIndex = '50'; // elevate card
            
            const thumbWrap = el.querySelector('.v-thumb-wrap');
            if (!thumbWrap) return;

            const rect = thumbWrap.getBoundingClientRect();
            let originX = '50%';
            let originY = '50%';
            if (rect.left < 100) originX = '10%';
            else if (window.innerWidth - rect.right < 100) originX = '90%';
            if (rect.top < 100) originY = '20%'; 

            thumbWrap.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            thumbWrap.style.transformOrigin = `${originX} ${originY}`;
            thumbWrap.style.transform = 'scale(1.8)';
            thumbWrap.style.boxShadow = '0 40px 80px rgba(0,0,0,1)';
            thumbWrap.style.zIndex = '60';
            
            if (vid) {
                vid.style.transition = '0.3s';
                vid.style.objectFit = 'contain';
                vid.style.background = '#000';
            } else if (img) {
                img.style.transition = '0.3s';
                img.style.objectFit = 'contain';
                img.style.background = '#000';
            }
        }, 3000); // 3 seconds popup delay
    } catch(e) {}
};

window.handleCardLeave = function(el) {
    try {
        clearTimeout(el._hoverT);
        const vid = el.querySelector('.hover-vid');
        if (vid) { 
            vid.pause(); 
            vid.currentTime = 0; 
            vid.style.objectFit = 'cover';
            vid.style.background = 'transparent';
        }
        const img = el.querySelector('.v-img-prev');
        if (img) {
            img.style.opacity = 1;
            img.style.objectFit = 'cover';
            img.style.background = 'transparent';
        }
        
        el.style.zIndex = el.originalZIndex || '1';

        const thumbWrap = el.querySelector('.v-thumb-wrap');
        if (thumbWrap) {
            thumbWrap.style.transform = 'scale(1)';
            thumbWrap.style.boxShadow = 'none';
            thumbWrap.style.zIndex = '1';
        }
    } catch(e) {}
};

// YouTube Hybrid Engine
function extractYouTubeID(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com.*v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#/ ]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}
function getYouTubeThumbnail(id) { return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`; }

function onYTReady(e) {
    e.target.playVideo();
    window.ytProgInt = setInterval(updateYTProgress, 500);
}

function onYTStateChange(e) {
    const playBtn = document.getElementById('yt-play-btn');
    const centerBtn = document.getElementById('yt-play-center');
    if (e.data === YT.PlayerState.PLAYING) {
        if (playBtn) playBtn.innerText = '⏸';
        if (centerBtn) centerBtn.style.display = 'none';
        document.getElementById('yt-custom-controls').classList.remove('active');
    } else {
        if (playBtn) playBtn.innerText = '▶';
        if (centerBtn) centerBtn.style.display = 'block';
        document.getElementById('yt-custom-controls').classList.add('active');
    }
}

function toggleYT() {
    if (!window.ytPlayer) return;
    const state = window.ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) window.ytPlayer.pauseVideo();
    else window.ytPlayer.playVideo();
}

function seekYT(e) {
    if (!window.ytPlayer) return;
    const rect = document.getElementById('yt-seek-bar').getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const duration = window.ytPlayer.getDuration();
    window.ytPlayer.seekTo(pos * duration, true);
    updateYTProgress();
}

function updateYTProgress() {
    if (!window.ytPlayer || !window.ytPlayer.getCurrentTime) return;
    if (document.hidden) return; // Save resources if tab is hidden

    const cur = window.ytPlayer.getCurrentTime();
    const dur = window.ytPlayer.getDuration();
    if (dur > 0) {
        const fill = document.getElementById('yt-seek-fill');
        const timeDisp = document.getElementById('yt-time');
        if (fill) fill.style.width = (cur / dur * 100) + '%';
        if (timeDisp) timeDisp.innerText = `${fmtTime(cur)} / ${fmtTime(dur)}`;
    }
}

function setYTVolume(v) { if (window.ytPlayer) window.ytPlayer.setVolume(v); }
function toggleYTFullscreen() {
    const p = document.getElementById('yt-player-container');
    if (p.requestFullscreen) p.requestFullscreen();
    else if (p.webkitRequestFullscreen) p.webkitRequestFullscreen();
}

function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

// Native Video Controls
function toggleNative() {
    const v = document.getElementById('native-player');
    const btn = document.getElementById('native-play-btn');
    const center = document.getElementById('native-play-center');
    if (v.paused) {
        v.play();
        btn.innerText = "⏸";
        center.style.display = 'none';
    } else {
        v.pause();
        btn.innerText = "▶";
        center.style.display = 'block';
    }
}

function seekNative(e) {
    const v = document.getElementById('native-player');
    const bar = document.getElementById('native-seek-bar');
    const rect = bar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    v.currentTime = pos * v.duration;
}

function updateNativeProgress() {
    const v = document.getElementById('native-player');
    const fill = document.getElementById('native-seek-fill');
    const time = document.getElementById('native-time');
    if (v && fill && time) {
        const cur = v.currentTime;
        const dur = v.duration;
        fill.style.width = (cur / dur * 100) + '%';
        time.innerText = `${fmtTime(cur)} / ${fmtTime(dur)}`;
    }
}

function setNativeVolume(v) {
    const player = document.getElementById('native-player');
    if (player) player.volume = v;
}

function toggleNativeFullscreen() {
    const p = document.getElementById('native-player-container');
    if (p.requestFullscreen) p.requestFullscreen();
    else if (p.webkitRequestFullscreen) p.webkitRequestFullscreen();
}

