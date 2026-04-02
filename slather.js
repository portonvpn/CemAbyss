const slatherVars = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    isRunning: false,
    player: null,
    bots: [],
    orbs: [],
    camera: { x: 0, y: 0, zoom: 1 },
    maxOrbs: 2500, // Multiplied orbital density up dramatically for a 5000px radius map
    worldRadius: 5000, // Circular world
    maxBots: 50,
    mouse: { x: 0, y: 0, isDown: false },
    speedMod: 1, botSpeedMod: 1,
    infiniteBoost: false, noClip: false, blackout: false, hideGrid: false,
    ghostMode: false, playerFrozen: false, botsFrozen: false, peacefulBots: false, insaneBots: false, botSwarm: false, botsNoDrop: false, freezeOrbs: false, orbValueMod: 1, showHitboxes: false, hideHUD: false, matrixFX: false, cinemaFX: false, lsdFX: false, lockCamera: false, simLag: false, lowFpsCap: false,
    names: ['AbyssLord', 'VoidEater', 'NoobMaster', 'SnakeZ', 'CemAbyssBot', 'NullPointer', 'SlitherKing', 'Orbit', 'Glitch', 'Terminal', 'Spectre', 'Wraith']
};

const peerVars = {
    peer: null,
    isHost: true,
    connections: [],
    hostConn: null,
    remoteSnakes: {},
    syncInterval: null,
    cleanupInterval: null
};

class Snake {
    constructor(x, y, name, isBot, skin) {
        this.name = name;
        this.isBot = isBot;
        this.skin = skin; // 'red', 'blue', 'gradient'
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.segments = []; // Array of {x, y}
        this.length = 10;
        this.baseRadius = 15;
        this.targetAngle = Math.random() * Math.PI * 2;
        this.angle = this.targetAngle;
        this.score = 10;
        this.visualScore = 10;
        this.isBoosting = false;
        this.pulseTime = 0;
        this.isDead = false;
        this.botState = 'wander'; // 'wander', 'target'
        this.botTimer = Math.random() * 100;
        
        for (let i = 0; i < this.length; i++) {
            this.segments.push({ x: this.x, y: this.y });
        }
    }

    get radius() {
        // Smooth logarithmic growth: visibly increases but much slower and constrained
        return Math.min(this.baseRadius + Math.pow(this.visualScore, 0.52) * 0.8, 100); 
    }

    get speed() {
        let baseSpeed = this.isBot ? 5.8 : 5.4; // Buffed baseline
        // Even bigger snakes stay fast now
        let speedMultiplier = Math.max(0.75, 1 - (this.radius / 500)); 
        let finalSpeed = baseSpeed * speedMultiplier;
        
        // Apply Global Dev Overrides
        if (!this.isBot && this === slatherVars.player) finalSpeed *= slatherVars.speedMod;
        
        return finalSpeed;
    }

    update() {
        if (this.isBot) {
            this.updateBotLogic();
        }
        
        this.visualScore += (this.score - this.visualScore) * 0.08; // Smooth growth tweening!

        // Boost Logic (Consolidated)
        if (!this.isBot && this === slatherVars.player) {
            this.isBoosting = (slatherVars.mouse.isDown && this.score > 20);
        } else if (this.isBot) {
            // Bot boost state managed by botBoostTimer downstream
            if (this.botBoostTimer === undefined) this.botBoostTimer = 0;
            this.botBoostTimer--;
            
            if (this.botBoostTimer <= 0) {
                this.isBoosting = (this.visualScore > 50 && Math.random() < 0.1);
                this.botBoostTimer = 100 + Math.random() * 300; 
            }
        }
        
        let currentSpeed = this.speed;
        if (this.isBoosting) {
            currentSpeed *= 1.8;
            if (!slatherVars.infiniteBoost || this !== slatherVars.player) {
                this.score -= Math.max(0.02, this.score * 0.0001); // Decayed heavily
            }
            this.pulseTime += 0.3;
            
            // Drop trail dots (Medium sized, not too many)
            if (Math.random() < 0.15 && this.segments.length > 5 && !(this.isBot && slatherVars.botsNoDrop)) {
                let tail = this.segments[this.segments.length - 1];
                slatherVars.orbs.push({
                    x: tail.x + (Math.random()-0.5)*10,
                    y: tail.y + (Math.random()-0.5)*10,
                    size: 4 + Math.random() * 3, // Calibrated size
                    scoreValue: 0.12 * slatherVars.orbValueMod,
                    color: this.getSegmentColor(this.segments.length - 1),
                    isGiant: false,
                    animTime: Math.random() * Math.PI * 2,
                    isEaten: false,
                    eatenBy: null
                });
            }
        }
        
        if (!this.isBot && slatherVars.playerFrozen) currentSpeed = 0;
        if (this.isBot && slatherVars.botsFrozen) currentSpeed = 0;
        if (this.isBot && !slatherVars.botsFrozen) currentSpeed *= slatherVars.botSpeedMod;
        
        if (slatherVars.simLag && Math.random() < 0.3) return;

        // Smooth angle rotation (Slither.io turning is more sluggish and organic)
        let angleDiff = this.targetAngle - this.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        
        let turnSpeed = Math.max(0.02, 0.06 - (this.visualScore / 25000)); // Much harder to rotate!
        if (this.isBoosting) turnSpeed *= 0.5; // Even heavier when boosting
        this.angle += angleDiff * turnSpeed;

        this.vx = Math.cos(this.angle) * currentSpeed;
        this.vy = Math.sin(this.angle) * currentSpeed;

        let oldX = this.x;
        let oldY = this.y;
        this.x += this.vx;
        this.y += this.vy;

        // FIXED SEGMENT SPACING: Prevents "stretching" when boosting
        // We now add MULTIPLE segments if we move fast, to keep spacing 100% constant!
        if (this.segments.length === 0) {
            this.segments.unshift({ x: this.x, y: this.y });
        } else {
            let lastSeg = this.segments[0];
            let distMoved = Math.hypot(this.x - lastSeg.x, this.y - lastSeg.y);
            let spacing = 5; 
            
            if (distMoved >= spacing) {
                let numToAdd = Math.floor(distMoved / spacing);
                
                // MATH SAFETY: Prevent NaN or runaway growth
                let targetLength = 10 + Math.floor((this.visualScore || 0) / 4.5); 
                if (isNaN(targetLength) || targetLength < 10) targetLength = 10;
                
                // Exactly the same maxLen scaling regardless of speed
                let maxLen = targetLength * 5.0; 

                for (let k = 0; k < numToAdd; k++) {
                    let ratio = (k + 1) / numToAdd;
                    this.segments.unshift({
                        x: lastSeg.x + (this.x - lastSeg.x) * ratio,
                        y: lastSeg.y + (this.y - lastSeg.y) * ratio
                    });
                    
                    // Pop for every unshift to maintain rock-solid length parity
                    if (this.segments.length > maxLen) {
                        this.segments.pop();
                    }
                }
            }
        }
        
        // Physics state updates handled in the main movement block
    }

    updateBotLogic() {
        let nearestTarget = null;
        let minDist = Infinity;

        // 1. DANGER ASSESSMENT
        let allSnakes = [slatherVars.ghostMode ? null : slatherVars.player, ...slatherVars.bots].filter(Boolean);
        for (let s of allSnakes) {
            if (s === this) continue;
            // Check body segments 
            for (let i = 0; i < s.segments.length; i += 8) {
                let seg = s.segments[i];
                let dist = Math.hypot(this.x - seg.x, this.y - seg.y);
                if (dist < this.radius + 60) { // Danger very close (Nerfed range!)
                    let angToDanger = Math.atan2(seg.y - this.y, seg.x - this.x);
                    let angleDiff = angToDanger - this.angle;
                    
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    
                    if (Math.abs(angleDiff) < Math.PI / 5) { // Narrower FOV blindspots
                        // Turn away slowly
                        this.targetAngle = angToDanger + (Math.PI / 2) * (angleDiff > 0 ? -1 : 1); 
                        return; // Survival overrides everything!
                    }
                }
            }
        }

        // 2. AVOID WORLD EDGE
        let distFromCenter = Math.hypot(this.x, this.y);
        if (distFromCenter > slatherVars.worldRadius - 800) {
             let angleToCenter = Math.atan2(-this.y, -this.x);
             this.targetAngle = angleToCenter + (Math.random() - 0.5);
             return; 
        }

        // 3. TARGETING
        let combatTarget = null;
        if (slatherVars.player && !slatherVars.ghostMode && !slatherVars.peacefulBots) {
            let px = slatherVars.player.x;
            let py = slatherVars.player.y;
            let distToPlayer = Math.hypot(this.x - px, this.y - py);
            
            // Aggro radius / Swarm Target
            if ((distToPlayer < 700 && this.score > 15) || slatherVars.botSwarm || slatherVars.insaneBots) {
                let pVx = Math.cos(slatherVars.player.angle) * 150;
                let pVy = Math.sin(slatherVars.player.angle) * 150;
                combatTarget = { x: px + pVx, y: py + pVy };
                
                if ((distToPlayer < 350 && Math.random() < 0.05) || slatherVars.insaneBots) {
                     this.isBoosting = true;
                }
            }
        }

        if (combatTarget) {
            nearestTarget = combatTarget;
        } else {
            // New "Human-Like" Foraging Nerf: 
            // Bots spend significant time just wandering or being "confused", ignoring nearest orbs
            this.botTimer--;
            if (this.botTimer <= 0) {
                this.botState = Math.random() > 0.4 ? 'target' : 'wander';
                this.botTimer = 50 + Math.random() * 150;
            }

            if (this.botState === 'target') {
                for (let orb of slatherVars.orbs) {
                    if (orb.isEaten) continue;
                    let dist = Math.hypot(this.x - orb.x, this.y - orb.y);
                    
                    // Massive noise injection so they swim PAST orbs or ignore closer ones
                    let noise = Math.random() * 400; 
                    if (dist + noise < minDist) {
                        minDist = dist + noise;
                        nearestTarget = orb;
                    }
                }
            } else {
                // Occasional random drift when wandering
                if (Math.random() < 0.02) this.targetAngle += (Math.random() - 0.5) * 2;
            }
        }
        
        if (nearestTarget) {
            this.targetAngle = Math.atan2(nearestTarget.y - this.y, nearestTarget.x - this.x);
        } else {
            if (Math.random() < 0.05) this.targetAngle += (Math.random() - 0.5) * 2;
        }
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;

        if (this.isBot && slatherVars.botsNoDrop) return;

        // Balanced Drop Spray
        let massToDrop = Math.max(0, this.score * 0.5);
        if (isNaN(massToDrop)) massToDrop = 0;
        
        // Non-Linear Scaling
        let numOrbs = Math.floor(Math.sqrt(massToDrop) * 2.8);
        if (isNaN(numOrbs) || numOrbs < 3) numOrbs = 3;
        
        // Cap it for safety
        if (numOrbs > 180) numOrbs = 180; 
        
        let segmentSpacing = Math.max(1, Math.floor(this.segments.length / numOrbs));
        let scorePerOrb = massToDrop / numOrbs;
        if (isNaN(scorePerOrb)) scorePerOrb = 0.5;
        
        for (let i = 0; i < numOrbs; i++) {
            let idx = i * segmentSpacing;
            if (idx >= this.segments.length) idx = this.segments.length - 1;
            let seg = this.segments[idx];
            if (!seg) continue;
            
            // Neon Bright Death Orbs (White/Light cores like Pic 5)
            let colorStr = `hsl(${Math.random()*360}, 100%, 85%)`; 
            if (Math.random() > 0.5) colorStr = '#fff'; // Many white ones like the image
            
            // Equal distribution but size reflects the magnitude of the kill
            let baseOrbSize = 9 + (scorePerOrb * 0.18);
            let pSize = Math.min(50, baseOrbSize + (Math.random() * 4));
            
            slatherVars.orbs.push({
                x: seg.x + (Math.random() - 0.5) * 20, // Tighter trail for better visuals
                y: seg.y + (Math.random() - 0.5) * 20,
                size: pSize,
                scoreValue: scorePerOrb,
                color: colorStr,
                animTime: Math.random() * Math.PI * 2,
                isEaten: false,
                isGiant: pSize > 25,
                isNeon: true, // Special glow flag
                eatenBy: null
            });
        }
    }

    getSegmentColor(index) {
        // Striped / Pattern Logic
        let segmentGroup = Math.floor(index / 10);
        let isStriped = segmentGroup % 2 === 0;

        if (this.skin === 'red') {
            return isStriped ? '#ef4444' : '#991b1b';
        } else if (this.skin === 'blue') {
            return isStriped ? '#3b82f6' : '#1e3a8a';
        } else if (this.skin === 'gradient') {
            // "USA/Stars" like behavior - alternating bright and dark blue
            return isStriped ? '#60a5fa' : '#1d4ed8';
        }
        return '#ffffff';
    }

    draw(ctx) {
        let r = this.radius;
        // ULTRA SMOOTH rendering: Step is very small so spheres overlap into a single body
        // Slither uses a step that is approx 1/8th of the radius
        let step = Math.max(1, Math.floor(r / 12)); 
        
        ctx.save();
        
        // Boost Body Glow
        if (this.isBoosting) {
            // No ghosting segments! Just a smooth core glow layer.
            ctx.save();
            ctx.shadowBlur = 45;
            ctx.shadowColor = this.getSegmentColor(0);
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Body Drawing Loop
        for (let i = this.segments.length - 1; i >= 0; i -= step) { 
            let seg = this.segments[i];
            let segSize = r * (1 - (i/this.segments.length)*0.3); // Tapering
            if (segSize < 2) continue; 

            let color = this.getSegmentColor(i);
            
            // OPTIMIZED PULSE-FLOW: Avoid shadowBlur in loops (very slow!)
            if (this.isBoosting) {
                let flow = Math.sin(this.pulseTime * 0.8 - i * 0.15);
                if (flow > 0.3) {
                   ctx.save();
                   ctx.globalAlpha = 0.25 * flow;
                   ctx.fillStyle = '#fff';
                   ctx.beginPath();
                   ctx.arc(seg.x, seg.y, segSize * 1.5, 0, Math.PI * 2); // Larger glow halo
                   ctx.fill();
                   ctx.restore();
                }
            }

            // 3D Shading Effect (High Fidelity Gradient)
            let grad = ctx.createRadialGradient(seg.x - segSize*0.3, seg.y - segSize*0.3, segSize*0.1, seg.x, seg.y, segSize);
            grad.addColorStop(0, '#fff6'); 
            grad.addColorStop(0.3, color);
            grad.addColorStop(1, 'rgba(0,0,0,0.5)');

            ctx.beginPath();
            ctx.arc(seg.x, seg.y, segSize, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            
            // Subtle Glow Border
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Star Logic
            if (this.skin === 'gradient' && i % 25 === 0) {
               ctx.save();
               ctx.globalAlpha = 0.5;
               ctx.fillStyle = '#fff';
               ctx.beginPath();
               ctx.arc(seg.x, seg.y, segSize * 0.4, 0, Math.PI * 2);
               ctx.fill();
               ctx.restore();
            }
        }

        // Eyes (Cursor-Tracking)
        let eyeRad = r * 0.45;
        let eyeOffset = r * 0.55;
        let eyeAngleOffset = 0.6;
        
        for(let side of [-1, 1]) {
            let ex = this.x + Math.cos(this.angle + eyeAngleOffset * side) * eyeOffset;
            let ey = this.y + Math.sin(this.angle + eyeAngleOffset * side) * eyeOffset;
            
            // White part
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(ex, ey, eyeRad, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupil (Tracks Cursor Relative to Camera)
            let dx = (slatherVars.mouse.x - slatherVars.width/2) / slatherVars.camera.zoom;
            let dy = (slatherVars.mouse.y - slatherVars.height/2) / slatherVars.camera.zoom;
            let lookAngle = Math.atan2(dy - (ey - slatherVars.player.y), dx - (ex - slatherVars.player.x));
            
            ctx.fillStyle = '#050505';
            ctx.beginPath();
            ctx.arc(ex + Math.cos(lookAngle)*3, ey + Math.sin(lookAngle)*3, eyeRad*0.6, 0, Math.PI * 2);
            ctx.fill();
            
            // Reflection
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(ex - eyeRad*0.3, ey - eyeRad*0.3, eyeRad*0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Name tag
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '900 14px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(this.name, this.x, this.y - r - 20);
        ctx.fillText(this.name, this.x, this.y - r - 20);
    }
}

function initSlather() {
    slatherVars.canvas = document.getElementById('slather-canvas');
    slatherVars.ctx = slatherVars.canvas.getContext('2d', { alpha: false });
    
    let selectedSkin = 'red';
    document.querySelectorAll('.slather-skin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.slather-skin-btn').forEach(b => {
                b.classList.remove('active');
                if(b.dataset.skin === 'red') b.style.borderColor = 'white';
                else b.style.borderColor = 'transparent';
            });
            btn.classList.add('active');
            selectedSkin = btn.dataset.skin;
            document.querySelectorAll('.slather-skin-btn').forEach(b => {
               if(b.classList.contains('active')) b.style.borderColor = 'white';
               else b.style.borderColor = 'transparent';
            });
        });
    });

    document.getElementById('slather-start').addEventListener('click', () => {
        let name = document.getElementById('slather-name').value.trim() || 'Guest' + Math.floor(Math.random()*1000);
        startMultiplayer(name, selectedSkin);
    });
    
    // Strict Dev Auth Hook
    if (typeof DEV_USERS !== 'undefined' && DEV_USERS.includes(currentUser)) {
        let devBtn = document.getElementById('slather-dev-btn');
        let igDevBtn = document.getElementById('slather-ingame-dev-toggle');
        let toggleFn = () => {
             let p = document.getElementById('slather-dev-panel');
             if(p) p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
             else initSlatherDevPanel();
        };
        if (devBtn) { devBtn.style.display = 'block'; devBtn.onclick = toggleFn; }
        if (igDevBtn) { igDevBtn.style.display = 'block'; igDevBtn.onclick = toggleFn; }
    }

    slatherVars.canvas.addEventListener('mousemove', (e) => {
        let rect = slatherVars.canvas.getBoundingClientRect();
        slatherVars.mouse.x = e.clientX - rect.left;
        slatherVars.mouse.y = e.clientY - rect.top;

        if (slatherVars.player) {
            let dx = slatherVars.mouse.x - (slatherVars.width / 2);
            let dy = slatherVars.mouse.y - (slatherVars.height / 2);
            slatherVars.player.targetAngle = Math.atan2(dy, dx);
        }
    });

    slatherVars.canvas.addEventListener('mousedown', () => slatherVars.mouse.isDown = true);
    slatherVars.canvas.addEventListener('mouseup', () => slatherVars.mouse.isDown = false);
    
    // Touch controls mapped as well
    slatherVars.canvas.addEventListener('touchstart', (e) => {
        slatherVars.mouse.isDown = true;
        let rect = slatherVars.canvas.getBoundingClientRect();
        slatherVars.mouse.x = e.touches[0].clientX - rect.left;
        slatherVars.mouse.y = e.touches[0].clientY - rect.top;
        if(slatherVars.player) {
            let dx = slatherVars.mouse.x - (slatherVars.width / 2);
            let dy = slatherVars.mouse.y - (slatherVars.height / 2);
            slatherVars.player.targetAngle = Math.atan2(dy, dx);
        }
    });
    slatherVars.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); 
        let rect = slatherVars.canvas.getBoundingClientRect();
        slatherVars.mouse.x = e.touches[0].clientX - rect.left;
        slatherVars.mouse.y = e.touches[0].clientY - rect.top;
        if(slatherVars.player) {
            let dx = slatherVars.mouse.x - (slatherVars.width / 2);
            let dy = slatherVars.mouse.y - (slatherVars.height / 2);
            slatherVars.player.targetAngle = Math.atan2(dy, dx);
        }
    }, {passive: false});
    slatherVars.canvas.addEventListener('touchend', () => slatherVars.mouse.isDown = false);

    // Explicit Mobile Boost Button listener
    let mobBoostBtn = document.getElementById('slather-mob-boost');
    if (mobBoostBtn) {
        mobBoostBtn.addEventListener('touchstart', (e) => { e.preventDefault(); slatherVars.mouse.isDown = true; });
        mobBoostBtn.addEventListener('touchend', (e) => { e.preventDefault(); slatherVars.mouse.isDown = false; });
    }

    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    if(!slatherVars.canvas) return;
    const viewSlather = document.getElementById('view-slather');
    slatherVars.width = viewSlather.clientWidth;
    slatherVars.height = viewSlather.clientHeight;
    slatherVars.canvas.width = slatherVars.width;
    slatherVars.canvas.height = slatherVars.height;
}

function startMultiplayer(playerName, skin) {
    if (peerVars.peer) {
        peerVars.peer.destroy();
        peerVars.peer = null;
    }
    if (peerVars.hostConn) {
        peerVars.hostConn.close();
        peerVars.hostConn = null;
    }
    peerVars.connections.forEach(c => c.close());
    peerVars.connections = [];
    if (peerVars.syncInterval) clearInterval(peerVars.syncInterval);
    if (peerVars.cleanupInterval) clearInterval(peerVars.cleanupInterval);
    if (slatherVars.logicLoop) clearInterval(slatherVars.logicLoop);

    document.getElementById('slather-ui').style.display = 'none';
    document.getElementById('slather-hud').style.display = 'block';
    
    let codeDisplay = document.getElementById('slather-room-display');
    codeDisplay.style.display = 'block';
    codeDisplay.innerText = "SERVERS: SCANNING...";

    let serverNumber = 1;
    let tempPeer = new Peer();

    function tryConnect() {
        if (serverNumber > 50) return alert("All realms are extremely full. Try again later!");
        let targetHostId = 'cemabyss-slather-' + serverNumber;
        codeDisplay.innerText = "PINGING NODE: " + serverNumber;
        
        let conn = tempPeer.connect(targetHostId, { reliable: true });

        conn.on('open', () => {
            // Connected to host
            conn.on('data', data => {
                if (data.type === 'server_full') {
                    conn.close();
                    serverNumber++;
                    tryConnect();
                } else if (data.type === 'init_orbs') {
                    becomeClient(tempPeer, conn, targetHostId, playerName, skin, data.orbs);
                }
            });
        });
    }

    tempPeer.on('open', () => tryConnect());
    
    tempPeer.on('error', err => {
        if (err.type === 'peer-unavailable') {
            // Server doesn't exist yet, we capture the ID!
            let targetHostId = 'cemabyss-slather-' + serverNumber;
            tempPeer.destroy(); 
            becomeHost(targetHostId, playerName, skin);
        } else {
            // Generic fail, iterate
            serverNumber++;
            tryConnect();
        }
    });
}

function becomeHost(hostId, playerName, skin) {
    resizeCanvas();
    peerVars.isHost = true;
    slatherVars.isRunning = true;
    slatherVars.orbs = [];
    slatherVars.bots = [];
    peerVars.remoteSnakes = {};
    
    let sr = Math.random() * (slatherVars.worldRadius - 500);
    let sth = Math.random() * Math.PI * 2;
    slatherVars.player = new Snake(Math.cos(sth)*sr, Math.sin(sth)*sr, playerName, false, skin);

    document.getElementById('slather-room-display').innerText = "HOSTING SERVER #" + hostId.replace('cemabyss-slather-','');

    peerVars.peer = new Peer(hostId); // Bind strictly to this node

    // Initial bots and orbs
    for (let i = 0; i < 5; i++) spawnBot();
    for (let i = 0; i < slatherVars.maxOrbs; i++) spawnOrb();

    peerVars.peer.on('connection', conn => {
        if (peerVars.connections.length >= 100) {
            conn.on('open', () => {
                conn.send({ type: 'server_full' });
                setTimeout(() => conn.close(), 500);
            });
            return;
        }

        peerVars.connections.push(conn);
        let remoteId = conn.peer;

        conn.on('open', () => conn.send({ type: 'init_orbs', orbs: slatherVars.orbs }));

        conn.on('data', data => {
            if (data.type === 'sync_snake') {
                if (!peerVars.remoteSnakes[remoteId]) peerVars.remoteSnakes[remoteId] = { s: new Snake(data.x, data.y, data.name, false, data.skin) };
                let rs = peerVars.remoteSnakes[remoteId].s;
                rs.x = data.x; rs.y = data.y; rs.segments = data.segments; rs.isBoosting = data.boost; rs.name = data.name; rs.visualScore = data.score; rs.skin = data.skin;
                rs.lastUpdate = performance.now();
                peerVars.connections.forEach(c => { if(c !== conn) c.send(data); });
            }
        });

        conn.on('close', () => {
             peerVars.connections = peerVars.connections.filter(c => c !== conn);
             delete peerVars.remoteSnakes[remoteId];
        });
    });

    if (peerVars.syncInterval) clearInterval(peerVars.syncInterval);
    peerVars.syncInterval = setInterval(() => {
        if (!slatherVars.isRunning || !slatherVars.player) return;
        let myData = { type: 'sync_snake', id: peerVars.peer.id, x: slatherVars.player.x, y: slatherVars.player.y, score: slatherVars.player.score, segments: slatherVars.player.segments, boost: slatherVars.player.isBoosting, name: slatherVars.player.name, skin: slatherVars.player.skin };
        let botData = { type: 'sync_bots', bots: slatherVars.bots.map(b => ({x:b.x, y:b.y, radius:b.radius, segments:b.segments, skin:b.skin, name:b.name})) };
        let orbTick = (Math.random() < 0.2); 
        peerVars.connections.forEach(c => {
             c.send(myData);
             c.send(botData);
             if (orbTick) c.send({ type: 'sync_orbs', orbs: slatherVars.orbs });
        });
    }, 100);

    slatherVars.logicLoop = setInterval(gameLogic, 16); // Decoupled physics running independently 
    requestAnimationFrame(gameLoop);
}

function becomeClient(myPeer, conn, hostId, playerName, skin, initOrbs) {
    resizeCanvas();
    peerVars.isHost = false;
    slatherVars.isRunning = true;
    slatherVars.orbs = initOrbs || [];
    slatherVars.bots = [];
    peerVars.remoteSnakes = {};

    let sr = Math.random() * (slatherVars.worldRadius - 500);
    let sth = Math.random() * Math.PI * 2;
    slatherVars.player = new Snake(Math.cos(sth)*sr, Math.sin(sth)*sr, playerName, false, skin);
    document.getElementById('slather-room-display').innerText = "CONNECTED: SERVER #" + hostId.replace('cemabyss-slather-','');

    peerVars.peer = myPeer;
    peerVars.hostConn = conn;

    slatherVars.logicLoop = setInterval(gameLogic, 16); 
    requestAnimationFrame(gameLoop);

    if (peerVars.syncInterval) clearInterval(peerVars.syncInterval);
    peerVars.syncInterval = setInterval(() => {
        if (!slatherVars.isRunning || !slatherVars.player) return;
        peerVars.hostConn.send({ type: 'sync_snake', id: myPeer.id, x: slatherVars.player.x, y: slatherVars.player.y, score: slatherVars.player.score, segments: slatherVars.player.segments, boost: slatherVars.player.isBoosting, name: slatherVars.player.name, skin: slatherVars.player.skin });
    }, 100);

    if (peerVars.cleanupInterval) clearInterval(peerVars.cleanupInterval);
    peerVars.cleanupInterval = setInterval(() => {
        let now = performance.now();
        Object.keys(peerVars.remoteSnakes).forEach(id => {
            if (now - peerVars.remoteSnakes[id].s.lastUpdate > 4000) delete peerVars.remoteSnakes[id];
        });
    }, 2000);

    peerVars.hostConn.on('data', data => {
         if (data.type === 'init_orbs' || data.type === 'sync_orbs') slatherVars.orbs = data.orbs;
         
         if (data.type === 'sync_snake') {
             if (data.id === myPeer.id) return; 
             if (!peerVars.remoteSnakes[data.id]) peerVars.remoteSnakes[data.id] = { s: new Snake(data.x, data.y, data.name, false, data.skin) };
             let rs = peerVars.remoteSnakes[data.id].s;
             rs.x = data.x; rs.y = data.y; rs.segments = data.segments; rs.isBoosting = data.boost; rs.name = data.name; rs.visualScore = data.score; rs.skin = data.skin;
             rs.lastUpdate = performance.now();
         }
         
         if (data.type === 'sync_bots') {
             slatherVars.bots = data.bots.map(bd => {
                 let b = new Snake(bd.x, bd.y, bd.name, true, bd.skin);
                 b.segments = bd.segments;
                 Object.defineProperty(b, 'radius', { get: function() { return bd.radius; } });
                 return b;
             });
         }
    });
}

function spawnBot() {
    // Spawn within world radius
    let angle = Math.random() * Math.PI * 2;
    let dist = Math.random() * (slatherVars.worldRadius - 100);
    let name = slatherVars.names[Math.floor(Math.random() * slatherVars.names.length)];
    let skins = ['red', 'blue', 'gradient'];
    let skin = skins[Math.floor(Math.random() * skins.length)];
    let bot = new Snake(Math.cos(angle)*dist, Math.sin(angle)*dist, name, true, skin);
    bot.score = 10; // Default size only!
    slatherVars.bots.push(bot);
}

function spawnOrb() {
    if (slatherVars.orbs.length >= slatherVars.maxOrbs) return;
    
    // NATURAL SPAWN: No giants anymore (only deaths drop big orbs!)
    // Lowered base scoreValue so bots don't pump up instantly
    let rDist = slatherVars.worldRadius * Math.sqrt(Math.random());
    let theta = Math.random() * 2 * Math.PI;

    let hue = Math.floor(Math.random() * 360);
    let color = `hsl(${hue}, 80%, 50%)`;

    // Heterogeneous natural spawning: Variety in sizes
    let variety = Math.random();
    let size = 5;
    let val = 0.8;
    
    if (variety > 0.95) { size = 14; val = 4.5; } // rare large
    else if (variety > 0.8) { size = 9; val = 2.0; } // uncommon med
    
    slatherVars.orbs.push({
        x: rDist * Math.cos(theta),
        y: rDist * Math.sin(theta),
        size: size + Math.random() * 2,
        scoreValue: val * slatherVars.orbValueMod,
        color: color,
        isGiant: size > 10,
        animTime: Math.random() * Math.PI * 2,
        isEaten: false,
        eatenBy: null
    });
}

function renderGridAndBounds(ctx, camX, camY, zoom) {
    // Fill deep space
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, slatherVars.width, slatherVars.height);

    ctx.save();
    ctx.translate(slatherVars.width / 2, slatherVars.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // Honeycomb Hexagon Grid rendering
    ctx.beginPath();
    ctx.arc(0, 0, slatherVars.worldRadius, 0, Math.PI * 2);
    ctx.clip(); // Limit rendering to inside the circle!

    let hexSize = 75;
    let hexWidth = hexSize * Math.sqrt(3);
    let yOffset = hexSize * 1.5;
    
    // Calculate visible grid area dynamically based on camera bounds
    let startX = Math.floor((camX - slatherVars.width / (2*zoom)) / hexWidth) * hexWidth - hexWidth;
    let endX   = Math.floor((camX + slatherVars.width / (2*zoom)) / hexWidth) * hexWidth + hexWidth*2;
    let startY = Math.floor((camY - slatherVars.height / (2*zoom)) / yOffset) * yOffset - yOffset;
    let endY   = Math.floor((camY + slatherVars.height / (2*zoom)) / yOffset) * yOffset + yOffset*2;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 6;
    
    for (let y = startY; y <= endY; y += yOffset) {
        let isOddRow = Math.abs(Math.floor(y / yOffset)) % 2 === 1;
        let rowXOffset = isOddRow ? hexWidth / 2 : 0;
        
        for (let x = startX; x <= endX; x += hexWidth) {
            let cx = x + rowXOffset;
            let cy = y;
            
            // Draw hexagon path
            ctx.beginPath();
            for(let i=0; i<6; i++) {
                let ang = (Math.PI / 3) * i + (Math.PI / 6);
                let px = cx + Math.cos(ang) * hexSize;
                let py = cy + Math.sin(ang) * hexSize;
                if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            
            // Slither Style: Darker center, lighter edges
            ctx.fillStyle = '#0a0a0a';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.stroke();
            
            // Inner mini-hex for beveled look
            ctx.beginPath();
            for(let i=0; i<6; i++) {
                let ang = (Math.PI / 3) * i + (Math.PI / 6);
                let px = cx + Math.cos(ang) * (hexSize * 0.85);
                let py = cy + Math.sin(ang) * (hexSize * 0.85);
                if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    ctx.restore();

    // Now draw the red glowing circle boundary OVER everything (no clip)
    ctx.save();
    ctx.translate(slatherVars.width / 2, slatherVars.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    ctx.beginPath();
    ctx.arc(0, 0, slatherVars.worldRadius, 0, Math.PI * 2);
    ctx.lineWidth = 15;
    ctx.strokeStyle = '#ef4444';
    ctx.shadowBlur = 50;
    ctx.shadowColor = '#ef4444';
    ctx.stroke();

    ctx.restore();
}

function renderMinimap(ctx) {
    if(!slatherVars.player) return;
    
    let mapSize = 150;
    let pad = 20;
    let mapX = slatherVars.width - mapSize/2 - pad;
    let mapY = slatherVars.height - mapSize/2 - pad;

    ctx.save();
    
    // Map Background
    ctx.beginPath();
    ctx.arc(mapX, mapY, mapSize/2, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();
    ctx.clip(); // Mask to circle

    // Draw Player dot
    let px = (slatherVars.player.x / slatherVars.worldRadius) * (mapSize/2);
    let py = (slatherVars.player.y / slatherVars.worldRadius) * (mapSize/2);
    
    ctx.beginPath();
    ctx.arc(mapX + px, mapY + py, 4, 0, Math.PI*2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.fill();
    
    // Optional: draw enemies as faint red dots
    slatherVars.bots.forEach(b => {
        let bx = (b.x / slatherVars.worldRadius) * (mapSize/2);
        let by = (b.y / slatherVars.worldRadius) * (mapSize/2);
        ctx.beginPath();
        ctx.arc(mapX + bx, mapY + by, 2, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.fill();
    });

    ctx.restore();
}

function handleOrbsAndCollisions() {
    let allSnakes = [slatherVars.player, ...slatherVars.bots, ...Object.values(peerVars.remoteSnakes).map(r => r.s)].filter(Boolean);
    
    // Tween eaten orbs
    for (let i = slatherVars.orbs.length - 1; i >= 0; i--) {
        let o = slatherVars.orbs[i];
        if (o.isEaten) {
            if (!o.eatenBy) {
                slatherVars.orbs.splice(i, 1);
                continue;
            }
            // Tween to head
            let dx = o.eatenBy.x - o.x;
            let dy = o.eatenBy.y - o.y;
            o.x += dx * 0.3; 
            o.y += dy * 0.3;
            
            // Reached head
            if (Math.hypot(dx, dy) < 20) {
                o.eatenBy.score += o.scoreValue;
                if(o.eatenBy === slatherVars.player) {
                    document.getElementById('slather-score').innerText = Math.floor(slatherVars.player.visualScore);
                }
                slatherVars.orbs.splice(i, 1);
                spawnOrb(); // Replenish
            }
        }
    }

    // Orb Collection detection
    for (let s of allSnakes) {
        for (let o of slatherVars.orbs) {
            if (o.isEaten) continue;
            let dist = Math.hypot(s.x - o.x, s.y - o.y);
            // Slightly extended jaw radius
            if (dist < s.radius + o.size + 10) {
                o.isEaten = true;
                o.eatenBy = s;
            }
        }
    }

    // Body & Wall collisions
    for (let hitter of allSnakes) {
        let dead = false;
        
        // 1. World Border Death
        if (Math.hypot(hitter.x, hitter.y) > slatherVars.worldRadius - hitter.radius) {
            if (!(slatherVars.noClip && hitter === slatherVars.player)) dead = true;
        }
        
        // 2. Snake vs Snake
        if (!dead) {
            for (let target of allSnakes) {
                if (hitter === target) continue; 
                
                for (let i = 5; i < target.segments.length; i+=3) { // Step optimization
                    let seg = target.segments[i];
                    let dist = Math.hypot(hitter.x - seg.x, hitter.y - seg.y);
                    // Size factored collision
                    if (dist < hitter.radius * 0.8 + (target.radius * 0.6)) { 
                        if (!(slatherVars.player && hitter === slatherVars.player && slatherVars.player.isGod)) dead = true;
                        break;
                    }
                }
                if (dead) break;
            }
        }

        if (dead) {
            hitter.die(); 
            
            if (hitter === slatherVars.player) {
                slatherVars.player = null;
                setTimeout(() => {
                    document.getElementById('slather-ui').style.display = 'flex';
                    document.getElementById('slather-hud').style.display = 'none';
                    slatherVars.isRunning = false;
                }, 1000); // 1s delay to watch orb explosion
            } else if (hitter.isBot) {
                slatherVars.bots = slatherVars.bots.filter(b => b !== hitter);
                if (peerVars.isHost && slatherVars.bots.length < 5) {
                    setTimeout(spawnBot, 5000); 
                }
            } else {
                // A remote snake peer was killed
                // Their own native heartbeat disconnect will drop them naturally
            }
        }
    }
}

function updateLeaderboard() {
    let allSnakes = [...slatherVars.bots];
    if (slatherVars.player) allSnakes.push(slatherVars.player);
    
    // Mix in Remote players!
    Object.values(peerVars.remoteSnakes).forEach(rs => allSnakes.push(rs.s));
    
    allSnakes.sort((a, b) => b.score - a.score);
    
    let html = '';
    let top10 = allSnakes.slice(0, 10);
    top10.forEach((s, idx) => {
        let isMe = s === slatherVars.player;
        let color = isMe ? 'var(--primary)' : 'white';
        let bold = isMe ? '800' : '500';
        let scoreInt = Math.floor(s.visualScore);
        html += `<div style="display:flex; justify-content:space-between; color:${color}; font-weight:${bold}; align-items:center;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px;">#${idx+1}. ${s.name}</span>
            <span>${scoreInt}</span>
        </div>`;
    });
    
    document.getElementById('slather-leaderboard').innerHTML = html;
}

function gameLogic() {
    if (!slatherVars.isRunning) return;
    
    if (slatherVars.player) {
         slatherVars.player.update();
         
         // Smooth camera follow
         slatherVars.camera.x += (slatherVars.player.x - slatherVars.camera.x) * 0.1;
         slatherVars.camera.y += (slatherVars.player.y - slatherVars.camera.y) * 0.1;
         
         // Camera tightens instead of completely distancing outward! Max pan is deeply restricted.
         if (!slatherVars.lockCamera) {
             let targetZoom = Math.max(0.65, 1 - (slatherVars.player.radius / 300));
             slatherVars.camera.zoom += (targetZoom - slatherVars.camera.zoom) * 0.05;
         }
    } else {
         // Cinematic Death View (Zoom out fast like slither.io)
         if (!slatherVars.lockCamera) {
             slatherVars.camera.zoom += (0.45 - slatherVars.camera.zoom) * 0.08;
             // Add a slow camera drift while looking at your orbs
             slatherVars.camera.x += (Math.random() - 0.5) * 5;
             slatherVars.camera.y += (Math.random() - 0.5) * 5;
         }
    }

    slatherVars.bots.forEach(b => b.update());
    
    // DEV FPS Override Limiter
    if (slatherVars.lowFpsCap && Math.random() < 0.5) return;

    handleOrbsAndCollisions();
}

function gameLoop(timestamp) {
    if (!slatherVars.isRunning) return;
    
    let ctx = slatherVars.ctx;

    if (timestamp % 200 < 20) updateLeaderboard();

    // == RENDER PIPELINE ==
    renderGridAndBounds(ctx, slatherVars.camera.x, slatherVars.camera.y, slatherVars.camera.zoom);

    ctx.save();
    ctx.translate(slatherVars.width / 2, slatherVars.height / 2);
    let z = slatherVars.camera.zoom;
    ctx.scale(z, z);
    ctx.translate(-slatherVars.camera.x, -slatherVars.camera.y);

    let time = performance.now() * 0.005;
    
    // View Frustum Culling bounds
    let cx = slatherVars.camera.x;
    let cy = slatherVars.camera.y;
    let viewRadius = (Math.max(slatherVars.width, slatherVars.height) / z) / 2 + 100;
    let viewRadiusSq = viewRadius * viewRadius;
    let botViewRadiusSq = (viewRadius + 1000) * (viewRadius + 1000); 

    slatherVars.orbs.forEach(o => {
        // CULL OFF-SCREEN ORBS dynamically!
        let dx = o.x - cx;
        let dy = o.y - cy;
        if (dx * dx + dy * dy > viewRadiusSq) return; 
        
        let hoverY = Math.sin(time + o.animTime) * (o.isGiant ? 5 : 2);
        let pSize = Math.max(1, o.size + Math.sin(time*1.5 + o.animTime) * (o.isGiant ? 3 : 1));
        
        ctx.beginPath();
        ctx.arc(o.x, o.y + hoverY, pSize, 0, Math.PI * 2);
        
        if (o.isGiant || o.isNeon) {
            ctx.fillStyle = o.color;
            ctx.shadowBlur = 25;
            ctx.shadowColor = o.color;
        } else {
            ctx.fillStyle = o.color;
            ctx.shadowBlur = o.isEaten ? 5 : 12;
            ctx.shadowColor = o.color;
        }
        ctx.fill();
        ctx.closePath();
        
        // Glossy Top Shine
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(o.x - pSize*0.2, o.y + hoverY - pSize*0.2, pSize * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
        
        // Inner Core
        ctx.beginPath();
        ctx.arc(o.x, o.y + hoverY, pSize * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.closePath();
    });
    ctx.shadowBlur = 0;

    // Cull distant bots
    slatherVars.bots.forEach(b => {
        let dx = b.x - cx;
        let dy = b.y - cy;
        if (dx * dx + dy * dy < botViewRadiusSq) {
            b.draw(ctx);
        }
    });
    
    // Draw Remote Multiplayer Peers natively!
    Object.values(peerVars.remoteSnakes).forEach(rs => {
         let dx = rs.s.x - cx;
         let dy = rs.s.y - cy;
         if (dx * dx + dy * dy < botViewRadiusSq) {
             rs.s.draw(ctx);
         }
    });

    if (slatherVars.player) slatherVars.player.draw(ctx);

    ctx.restore();

    renderMinimap(ctx); // UI Minimap Top-Level

    requestAnimationFrame(gameLoop);
}

// Hook
setTimeout(() => {
    const originalSetContext = window.setContext;
    window.setContext = function(viewId, el) {
        if (viewId === 'slather') {
            if(!slatherVars.canvas) initSlather();
            if (!slatherVars.isRunning && slatherVars.player) {
                slatherVars.isRunning = true;
                requestAnimationFrame(gameLoop);
            }
        } else {
            if (slatherVars.isRunning) {
                slatherVars.isRunning = false;
            }
        }
        if(originalSetContext) originalSetContext(viewId, el);
    };
}, 100);

function initSlatherDevPanel() {
    if (typeof DEV_USERS === 'undefined' || !DEV_USERS.includes(currentUser)) return;
    let b = document.getElementById('slather-dev-panel');
    if (b) { b.style.display = 'flex'; return; }
    
    b = document.createElement('div');
    b.id = 'slather-dev-panel';
    b.style.cssText = 'position:absolute; top:5%; left:5%; width:900px; background:rgba(5,5,5,0.95); border:1px solid #10b981; border-radius:12px; z-index:9999; display:flex; flex-direction:column; box-shadow:0 0 50px rgba(16,185,129,0.2); backdrop-filter:blur(10px); resize:both; overflow:hidden;';
    
    let header = document.createElement('div');
    header.style.cssText = 'padding:15px; background:rgba(16,185,129,0.1); border-bottom:1px solid #10b981; cursor:move; display:flex; justify-content:space-between; align-items:center; user-select:none;';
    header.innerHTML = `<span style="color:#10b981; font-weight:900;">SLATHER.IO ENGINE DEV CONSOLE</span>
    <div>
        <button id="sdp-minmax" style="background:transparent; border:none; color:white; cursor:pointer; font-size:16px;">➖</button>
        <button onclick="document.getElementById('slather-dev-panel').style.display='none';" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:16px;">✖</button>
    </div>`;
    
    let content = document.createElement('div');
    content.id = 'sdp-content';
    content.style.cssText = 'padding:20px; max-height:75vh; overflow-y:auto; display:flex; flex-direction:column;';
    
    let navUI = document.createElement('div');
    navUI.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px; border-bottom:1px solid rgba(16,185,129,0.3); padding-bottom:10px; justify-content:center;';
    let grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:10px;';
    
    content.appendChild(navUI);
    content.appendChild(grid);
    b.appendChild(header);
    b.appendChild(content);
    document.getElementById('view-slather').appendChild(b);
    
    let isDragging = false, startX, startY, initX, initY;
    header.onmousedown = (e) => {
        if(e.target.tagName==='BUTTON') return;
        isDragging = true; startX = e.clientX; startY = e.clientY; initX = b.offsetLeft; initY = b.offsetTop;
    };
    window.addEventListener('mousemove', e => {
        if(!isDragging) return; b.style.left = (initX + e.clientX - startX) + 'px'; b.style.top = (initY + e.clientY - startY) + 'px';
    });
    window.addEventListener('mouseup', () => isDragging = false);
    
    document.getElementById('sdp-minmax').onclick = () => {
        content.style.display = content.style.display === 'none' ? 'flex' : 'none';
        document.getElementById('sdp-minmax').innerText = content.style.display === 'none' ? '➕' : '➖';
    };
    
    let s = slatherVars, p = () => slatherVars.player, cvs = document.getElementById('slather-canvas');

    const PAGES = {
        "PLAYER": [
            { n: "God Mode", t: () => p() && p().isGod, a: () => { if(p()) p().isGod = !p().isGod; } },
            { n: "Infinite Boost", t: () => s.infiniteBoost, a: () => { s.infiniteBoost = !s.infiniteBoost; } },
            { n: "NoClip (Wall Pass)", t: () => s.noClip, a: () => { s.noClip = !s.noClip; } },
            { n: "Invisible to Bots", t: () => s.ghostMode, a: () => { s.ghostMode = !s.ghostMode; } },
            { n: "Speed Hack: 2x Fast", t: () => s.speedMod === 2, a: () => { s.speedMod = s.speedMod === 2 ? 1 : 2; } },
            { n: "Speed Hack: 5x Sanic", t: () => s.speedMod === 5, a: () => { s.speedMod = s.speedMod === 5 ? 1 : 5; } },
            { n: "Instant Stop Movement", t: () => s.playerFrozen, a: () => { s.playerFrozen = !s.playerFrozen; } },
            { n: "Give Score: +1,000", a: () => { if(p()) p().score += 1000; } },
            { n: "Give Score: +10,000", a: () => { if(p()) p().score += 10000; } },
            { n: "Give Score: +50,000", a: () => { if(p()) p().score += 50000; } },
            { n: "Give Score: Max (100k)", a: () => { if(p()) p().score = 100000; } },
            { n: "Reset Score (Tiny)", a: () => { if(p()) p().score = 10; } },
            { n: "Drop 50% Mass", a: () => { if(p()) { p().score /= 2; for(let i=0;i<50;i++) spawnOrb(); } } },
            { n: "Teleport Center", a: () => { if(p()){ p().x = 0; p().y = 0; } } },
            { n: "Teleport Map Edge", a: () => { if(p()){ p().x = s.worldRadius-200; p().y = 0; } } },
            { n: "Suicide (Die)", a: () => { if(p()) p().score = 0; } },
            { n: "Force Skin: Red", a: () => { if(p()) p().skin = 'red'; } },
            { n: "Force Skin: Blue", a: () => { if(p()) p().skin = 'blue'; } },
            { n: "Force Skin: Gradient", a: () => { if(p()) p().skin = 'gradient'; } }
        ],
        "BOTS & AI": [
            { n: "Freeze All Bots", t: () => s.botsFrozen, a: () => { s.botsFrozen = !s.botsFrozen; } },
            { n: "Peaceful Mode (No Boost)", t: () => s.peacefulBots, a: () => { s.peacefulBots = !s.peacefulBots; } },
            { n: "Insane Aggro Mode", t: () => s.insaneBots, a: () => { s.insaneBots = !s.insaneBots; } },
            { n: "Swarm Mechanism", t: () => s.botSwarm, a: () => { s.botSwarm = !s.botSwarm; } },
            { n: "Bots Drop No Mass", t: () => s.botsNoDrop, a: () => { s.botsNoDrop = !s.botsNoDrop; } },
            { n: "Bot Speed x3 Override", t: () => s.botSpeedMod === 3, a: () => { s.botSpeedMod = s.botSpeedMod === 3 ? 1 : 3; } },
            { n: "Force Bot Limit: 0 (Kill All)", a: () => { s.bots = []; s.maxBots = 0; } },
            { n: "Force Bot Limit: 10", a: () => { s.maxBots = 10; } },
            { n: "Force Bot Limit: 50 (Default)", a: () => { s.maxBots = 50; } },
            { n: "Force Bot Limit: 150 (Stress Test)", a: () => { s.maxBots = 150; for(let i=s.bots.length; i<150; i++) spawnBot(); } },
            { n: "Spawn 1 Bot", a: () => spawnBot() },
            { n: "Spawn 10 Bots", a: () => { for(let i=0; i<10; i++) spawnBot(); } },
            { n: "Delete Fast/Far Bots", a: () => { s.bots = s.bots.filter(b => p() && Math.hypot(b.x-p().x, b.y-p().y) < 1500); } },
            { n: "Make Bots Giant (+50k)", a: () => { s.bots.forEach(b => b.score += 50000); } },
            { n: "Make Bots Tiny", a: () => { s.bots.forEach(b => b.score = 10); } },
            { n: "Spawn Bodyguard Bot", a: () => { spawnBot(); let b = s.bots[s.bots.length-1]; if(p()&&b){b.x=p().x; b.y=p().y; b.score=10000; b.name="Guard";} } }
        ],
        "WORLD & SPAWN": [
            { n: "World Density: 100 (Empty)", t: () => s.maxOrbs === 100, a: () => s.maxOrbs = 100 },
            { n: "World Density: 2,500 (Default)", t: () => s.maxOrbs === 2500, a: () => s.maxOrbs = 2500 },
            { n: "World Density: 10,000 (Lag)", t: () => s.maxOrbs === 10000, a: () => { s.maxOrbs = 10000; for(let i=0;i<5000;i++) spawnOrb(); } },
            { n: "World Density: 50,000 (Crash Game)", t: () => s.maxOrbs === 50000, a: () => { s.maxOrbs = 50000; for(let i=0;i<20000;i++) spawnOrb(); } },
            { n: "Clear All Current Orbs", a: () => { s.orbs = []; } },
            { n: "Spawn 100 Giant Orbs", a: () => { for(let i=0;i<100;i++){ let r=s.worldRadius*Math.sqrt(Math.random()); let t=Math.random()*6.28; s.orbs.push({x:r*Math.cos(t),y:r*Math.sin(t),size:25,scoreValue:50,color:'white',isGiant:true,isEaten:false,animTime:0,eatenBy:null});} } },
            { n: "Spawn 1,000 Tiny Orbs", a: () => { for(let i=0;i<1000;i++){ let r=s.worldRadius*Math.sqrt(Math.random()); let t=Math.random()*6.28; s.orbs.push({x:r*Math.cos(t),y:r*Math.sin(t),size:4,scoreValue:0.1,color:'red',isGiant:false,isEaten:false,animTime:0,eatenBy:null});} } },
            { n: "World Radius: 1,000 (Deathmatch)", t: () => s.worldRadius === 1000, a: () => s.worldRadius = 1000 },
            { n: "World Radius: 5,000 (Default)", t: () => s.worldRadius === 5000, a: () => s.worldRadius = 5000 },
            { n: "World Radius: 20,000 (Ocean)", t: () => s.worldRadius === 20000, a: () => s.worldRadius = 20000 },
            { n: "Freeze Orb Respawn", t: () => s.freezeOrbs, a: () => { s.freezeOrbs = !s.freezeOrbs; } },
            { n: "Multiplier Orbs x10 Value", t: () => s.orbValueMod === 10, a: () => { s.orbValueMod = s.orbValueMod === 10 ? 1 : 10; } },
            { n: "Shrink Boundary (Battle Royale)", a: () => { setInterval(() => { if(s.worldRadius>1000) s.worldRadius-=50; }, 2000); } }
        ],
        "VISUALS & RENDERING": [
            { n: "Render Hitbox Spheres", t: () => s.showHitboxes, a: () => { s.showHitboxes = !s.showHitboxes; } },
            { n: "Hide HUD Canvas Layer", t: () => s.hideHUD, a: () => { s.hideHUD = !s.hideHUD; document.getElementById('slather-hud').style.display = s.hideHUD?'none':'block'; } },
            { n: "Render Hex-Grid Floor", t: () => !s.hideGrid, a: () => { s.hideGrid = !s.hideGrid; } },
            { n: "Blackout Engine Mode", t: () => s.blackout, a: () => { s.blackout = !s.blackout; cvs.style.filter = s.blackout ? "brightness(0.3) contrast(1.5)" : "none"; } },
            { n: "Matrix Digital Rain Output", t: () => s.matrixFX, a: () => { s.matrixFX = !s.matrixFX; cvs.style.filter = s.matrixFX ? "hue-rotate(90deg) contrast(1.5) saturate(2)" : "none"; } },
            { n: "Cinematic Letterbox (CRT)", t: () => s.cinemaFX, a: () => { s.cinemaFX = !s.cinemaFX; cvs.style.boxShadow = s.cinemaFX ? "inset 0 0 100px 50px rgba(0,0,0,0.9)" : "none"; } },
            { n: "LSD Visual Shift (Motion Blur)", t: () => s.lsdFX, a: () => { s.lsdFX = !s.lsdFX; cvs.style.filter = s.lsdFX ? "saturate(5) hue-rotate(180deg) invert(0.2)" : "none"; } },
            { n: "Rainbow Shift Animation", t: () => cvs.style.animation === "rgbRotate 3s infinite linear", a: () => { let a = "rgbRotate 3s infinite linear"; if(cvs.style.animation === a) cvs.style.animation = "none"; else cvs.style.animation = a; } },
            { n: "Camera: Lock Standard Target", t: () => s.lockCamera, a: () => { s.lockCamera = !s.lockCamera; } },
            { n: "Camera: Force First-Person FOV", a: () => { if(p()) s.camera.zoom = 2; } },
            { n: "Camera: Force Satellite FOV", a: () => { if(p()) s.camera.zoom = 0.05; } },
            { n: "Dynamic Flashbang Effect", a: () => { let c=document.createElement('div'); c.style.cssText='position:absolute; inset:0; background:white; z-index:99; transition:1s ease;'; document.getElementById('view-slather').appendChild(c); setTimeout(()=>c.style.opacity='0', 50); setTimeout(()=>c.remove(), 1000); } }
        ],
        "NETWORK & THREADS": [
            { n: "Force Self to Host Promotion", t: () => peerVars.isHost, a: () => { peerVars.isHost = true; alert("Promoted local topology context to Master Node."); } },
            { n: "Disconnect Tunnels (Isolate Loop)", a: () => { if(peerVars.peer) peerVars.peer.destroy(); alert("Isolated local P2P interface state."); } },
            { n: "Kick All Remote Trackers", a: () => { peerVars.connections.forEach(c => c.close()); peerVars.connections = []; peerVars.remoteSnakes = {}; } },
            { n: "Simulate Packet Jitter 500ms", t: () => s.simLag, a: () => { s.simLag = !s.simLag; } },
            { n: "Drop Physics FPS Cap (15Hz)", t: () => s.lowFpsCap, a: () => { s.lowFpsCap = !s.lowFpsCap; } },
            { n: "Dump Internal Object Structs", a: () => { console.log(s); alert("Dumped payload logic core to devtools window."); } },
            { n: "Memory Profiler Log", a: () => { let u = Math.round(performance.memory ? performance.memory.usedJSHeapSize/1024/1024 : 0); alert(`Native Client Heap Allocated: ${u}MB`); } },
            { n: "Display Socket Tree Info", a: () => { alert(`Live Sockets: ${peerVars.connections.length}\nBot Map Vectors: ${s.bots.length}\nWorld Radius Array: ${s.worldRadius}px`); } }
        ]
    };
    
    let activePage = "PLAYER";
    
    const renderPage = (target) => {
        activePage = target;
        navUI.innerHTML = "";
        Object.keys(PAGES).forEach(k => {
            let btn = document.createElement('button');
            btn.innerText = k;
            let active = k === activePage;
            btn.style.cssText = `background:${active?'#10b981':'#111'}; color:${active?'white':'rgba(16,185,129,0.8)'}; border:1px solid #10b981; padding:8px 15px; border-radius:4px; font-weight:800; cursor:pointer; min-width:120px; transition:0.2s;`;
            btn.onclick = () => renderPage(k);
            navUI.appendChild(btn);
        });
        
        grid.innerHTML = "";
        PAGES[activePage].forEach(f => {
            let b = document.createElement('button');
            b.style.cssText = 'background:rgba(255,255,255,0.05); color:white; border:1px solid rgba(16,185,129,0.4); padding:12px; border-radius:6px; font-size:12px; cursor:pointer; text-align:left; display:flex; justify-content:space-between; align-items:center; transition:0.2s;';
            b.onmouseover = () => b.style.background = 'rgba(16,185,129,0.1)';
            b.onmouseout = () => b.style.background = 'rgba(255,255,255,0.05)';
            
            let drawText = () => {
                let left = `<span style="font-weight:700;">${f.n}</span>`;
                if(f.t !== undefined) {
                    let on = f.t();
                    let right = `<span style="color:${on?'#10b981':'#ef4444'}; font-weight:900;">${on?'ON':'OFF'}</span>`;
                    b.innerHTML = `<span>${left}</span> <span>${right}</span>`;
                } else {
                    b.innerHTML = left;
                }
            };
            drawText();
            b.onclick = () => { if(DEV_USERS.includes(currentUser)){ f.a(); drawText(); } };
            grid.appendChild(b);
        });
    };
    
    renderPage("PLAYER");
}
