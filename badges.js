import { allBadges, typeLabels } from './data/badges-data.js';

// ─── State ──────────────────────────────────────────────
let badgeState = [];
let currentFilter = 'all';

// ─── Load badge state from localStorage ─────────────────
export function loadBadgeState() {
    const saved = JSON.parse(localStorage.getItem('badgePouch'));
    if (saved && saved.length === allBadges.length) {
        badgeState = saved;
    } else {
        badgeState = allBadges.map(b => ({ ...b, unlocked: false }));
        localStorage.setItem('badgePouch', JSON.stringify(badgeState));
    }
    return badgeState;
}

// ─── Save badge state ────────────────────────────────────
export function saveBadgeState() {
    localStorage.setItem('badgePouch', JSON.stringify(badgeState));
}

// ─── Get stats ───────────────────────────────────────────
export function getBadgeStats() {
    const total = badgeState.length;
    const earned = badgeState.filter(b => b.unlocked).length;
    return { total, earned };
}

// ─── Reset all badges ────────────────────────────────────
export function resetBadges() {
    badgeState.forEach(b => b.unlocked = false);
    saveBadgeState();
    return badgeState;
}

// ─── Set filter ──────────────────────────────────────────
export function setFilter(filter) {
    currentFilter = filter;
    return currentFilter;
}

// ─── Get filtered badges ────────────────────────────────
export function getFilteredBadges() {
    if (currentFilter === 'all') return badgeState;
    return badgeState.filter(b => b.type === currentFilter);
}

// ─── SCOUT ANIMATION (USING YOUR IMAGES) ────────────────
function initScoutAnimation() {
    const canvas = document.getElementById('scoutCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // ════════════════════════════════════════════════════════
    // 🖼️  YOUR IMAGES - CHANGE PATHS IF NEEDED
    // ════════════════════════════════════════════════════════

    const IMAGES = {
        idle: 'idle.png',
        wave: 'wave.png',
        map: 'map.png',
        left: 'left.png',
        right: 'right.png'
    };

    // ════════════════════════════════════════════════════════
    // 🎬  YOUR SEQUENCE - (action, duration in ms)
    // ════════════════════════════════════════════════════════

    const SEQUENCE = [
        { action: 'idle', duration: 3000 },
        { action: 'left', duration: 1500 },
        { action: 'right', duration: 1500 },
        { action: 'map', duration: 2000 },
        { action: 'left', duration: 1000 },
        { action: 'right', duration: 1000 },
        { action: 'idle', duration: 1000 },
        { action: 'wave', duration: 2000 },
    ];

    // ─── Load images ──────────────────────────────────────────
    let loadedImages = {};
    let imagesLoaded = 0;
    const totalImages = Object.keys(IMAGES).length;

    function loadImages() {
        Object.keys(IMAGES).forEach(key => {
            const img = new Image();
            img.onload = () => {
                loadedImages[key] = img;
                imagesLoaded++;
                if (imagesLoaded === totalImages) {
                    console.log('✅ All scout images loaded!');
                    startAnimation();
                }
            };
            img.onerror = () => {
                console.error(`❌ Failed to load: ${IMAGES[key]}`);
                imagesLoaded++;
                if (imagesLoaded === totalImages) {
                    startAnimation();
                }
            };
            img.src = IMAGES[key];
        });
    }

    // ─── Draw action ──────────────────────────────────────────
    function drawAction(actionKey) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const img = loadedImages[actionKey];
        if (img) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } else {
            drawFallback();
        }
    }

    function drawFallback() {
        ctx.fillStyle = '#e94560';
        ctx.fillRect(16, 20, 32, 32);
        ctx.fillRect(20, 8, 24, 16);
        ctx.fillStyle = '#fff';
        ctx.fillRect(24, 12, 6, 6);
        ctx.fillRect(34, 12, 6, 6);
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(26, 14, 3, 3);
        ctx.fillRect(36, 14, 3, 3);
        ctx.fillStyle = '#e94560';
        ctx.fillRect(28, 44, 8, 12);
        ctx.fillRect(36, 44, 8, 12);
    }

    // ─── Animation loop ──────────────────────────────────────
    let sequenceTimer = null;
    let actionIndex = 0;

    function startAnimation() {
        if (sequenceTimer) clearTimeout(sequenceTimer);
        let startTime = Date.now();

        function playNext() {
            const item = SEQUENCE[actionIndex];
            if (!item) return;

            drawAction(item.action);
            console.log(`🎬 Playing: ${item.action} for ${item.duration}ms`);

            const elapsed = Date.now() - startTime;
            const delay = Math.max(0, item.duration - elapsed);

            sequenceTimer = setTimeout(() => {
                actionIndex = (actionIndex + 1) % SEQUENCE.length;
                startTime = Date.now();
                playNext();
            }, delay);
        }

        playNext();
    }

    // ─── Start ──────────────────────────────────────────────
    loadImages();

    window.addEventListener('beforeunload', () => {
        if (sequenceTimer) clearTimeout(sequenceTimer);
    });
}

// ─── Render the pouch ────────────────────────────────────
export function renderBadgePouch(containerId = 'page-content', scoutName = 'Scout', scoutRank = 'Membership') {
    const container = document.getElementById(containerId);
    if (!container) return;

    loadBadgeState();
    const { total, earned } = getBadgeStats();

    let html = `
        <style>
            .badge-page {
                max-width: 800px;
                width: 100%;
                background: white;
                border-radius: 32px;
                padding: 30px 24px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                margin: 0 auto;
            }

            .pouch-header-text {
                text-align: center;
                margin-bottom: 20px;
            }
            .pouch-header-text h2 {
                font-size: 22px;
                color: #4a2a5e;
                margin: 0;
            }
            .pouch-header-text p {
                font-size: 14px;
                color: #6b5f7a;
                margin: 4px 0 0 0;
                font-style: italic;
            }

            .pouch-scout-card {
                background: #8B6B4D;
                background-image: repeating-linear-gradient(45deg, rgba(120, 90, 60, 0.1) 0px, rgba(120, 90, 60, 0.1) 2px, transparent 2px, transparent 6px);
                border-radius: 16px;
                padding: 14px 20px;
                border: 3px solid #6B4F3A;
                box-shadow: inset 0 2px 8px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                flex-wrap: wrap;
                gap: 12px;
                cursor: pointer;
            }
            .pouch-scout-card .scout-info {
                display: flex;
                align-items: center;
                gap: 16px;
            }
            .pouch-scout-card .scout-info .pixel-scout-wrapper {
                position: relative;
                width: 64px;
                height: 64px;
                flex-shrink: 0;
            }
            .pouch-scout-card .scout-info .pixel-scout-wrapper canvas {
                width: 64px;
                height: 64px;
                image-rendering: pixelated;
                display: block;
                background: transparent;
            }
            .pouch-scout-card .scout-info .name {
                font-weight: 700;
                font-size: 16px;
                color: #F5E6D3;
            }
            .pouch-scout-card .scout-info .rank {
                font-size: 12px;
                color: #D4B896;
            }
            .pouch-scout-card .badge-count {
                background: #5A3F2B;
                padding: 6px 16px;
                border-radius: 40px;
                color: #F5E6D3;
                font-weight: 600;
                font-size: 14px;
                border: 2px solid #6B4F3A;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
                white-space: nowrap;
            }
            .pouch-scout-card .badge-count span {
                color: #FFD700;
            }

            .pouch-filters {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 16px;
                justify-content: center;
            }
            .pouch-filters .filter-btn {
                background: #e8e0f0;
                border: none;
                padding: 6px 16px;
                border-radius: 40px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                color: #2d2a3a;
            }
            .pouch-filters .filter-btn:hover {
                background: #d5cae0;
                transform: translateY(-1px);
            }
            .pouch-filters .filter-btn.active {
                background: #6c3b8c;
                color: white;
            }

            .pouch-grid {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 10px;
                background: #8B6B4D;
                background-image: repeating-linear-gradient(45deg, rgba(120, 90, 60, 0.1) 0px, rgba(120, 90, 60, 0.1) 2px, transparent 2px, transparent 6px);
                padding: 16px;
                border-radius: 16px;
                border: 3px solid #6B4F3A;
                box-shadow: inset 0 2px 8px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15);
                margin-bottom: 16px;
                min-height: 200px;
            }
            .pouch-slot {
                aspect-ratio: 1 / 1;
                background: #6B4F3A;
                background-image: repeating-linear-gradient(45deg, rgba(90, 65, 45, 0.3) 0px, rgba(90, 65, 45, 0.3) 2px, transparent 2px, transparent 4px);
                border: 2px solid #5A3F2B;
                border-radius: 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                padding: 4px;
                box-shadow: inset 0 -3px 0 #4A2F1B;
                min-height: 80px;
            }
            .pouch-slot:hover {
                transform: translateY(-3px);
                border-color: #FFD700;
                box-shadow: 0 6px 16px rgba(0,0,0,0.3), inset 0 -3px 0 #4A2F1B;
            }
            .pouch-slot.locked {
                opacity: 0.5;
                filter: grayscale(0.6);
            }
            .pouch-slot.unlocked {
                border-color: #FFD700;
                background: #7A5A3A;
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.15), inset 0 -3px 0 #4A2F1B;
            }
            .pouch-slot .slot-name {
                font-size: 7px;
                color: #D4B896;
                margin-top: 2px;
                text-align: center;
                line-height: 1.2;
                font-weight: 600;
            }
            .pouch-slot.unlocked .slot-name {
                color: #F5E6D3;
            }
            .pouch-slot .slot-type {
                font-size: 6px;
                text-transform: uppercase;
                color: #A08060;
                letter-spacing: 0.5px;
                margin-top: 1px;
            }
            .pouch-slot .lock-badge {
                position: absolute;
                top: 3px;
                right: 4px;
                font-size: 10px;
            }
            .pouch-slot .tooltip-text {
                display: none;
                position: absolute;
                bottom: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%);
                background: #2D1A0A;
                color: #F5E6D3;
                padding: 3px 12px;
                border-radius: 6px;
                font-size: 10px;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                z-index: 10;
                font-weight: 500;
                border: 1px solid #6B4F3A;
            }
            .pouch-slot:hover .tooltip-text {
                display: block;
            }

            .pouch-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .pouch-actions button {
                background: #6B4F3A;
                border: none;
                border-bottom: 3px solid #4A2F1B;
                color: #F5E6D3;
                padding: 8px 20px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.15s;
            }
            .pouch-actions button:hover {
                transform: translateY(-2px);
                border-bottom-width: 5px;
                background: #7A5A3A;
            }
            .pouch-actions button.primary {
                background: #FFD700;
                color: #2D1A0A;
                border-bottom-color: #B8960A;
            }
            .pouch-actions button.primary:hover {
                background: #FFE44D;
            }

            @media (max-width: 768px) {
                .pouch-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px; }
                .pouch-slot { font-size: 20px; min-height: 70px; }
                .pouch-slot .slot-name { font-size: 6px; }
            }
            @media (max-width: 500px) {
                .pouch-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 10px; }
                .pouch-slot { font-size: 18px; min-height: 60px; }
                .pouch-scout-card { flex-direction: column; align-items: stretch; text-align: center; }
                .pouch-scout-card .scout-info { justify-content: center; }
                .pouch-scout-card .badge-count { text-align: center; }
                .pouch-filters .filter-btn { font-size: 10px; padding: 4px 12px; }
            }
        </style>

        <div class="badge-page">
            <div class="pouch-header-text">
                <h2>🎒 WELCOME TO YOUR BADGE POUCH</h2>
                <p>"Every badge tells a story"</p>
            </div>

            <div class="pouch-scout-card" id="scoutCard">
                <div class="scout-info">
                    <div class="pixel-scout-wrapper">
                        <canvas id="scoutCanvas" width="64" height="64"></canvas>
                    </div>
                    <div>
                        <div class="name" id="scoutName">${scoutName}</div>
                        <div class="rank" id="scoutRank">${scoutRank}</div>
                    </div>
                </div>
                <div class="badge-count">
                    <span id="earnedCount">${earned}</span> / <span id="totalCount">${total}</span> badges earned
                </div>
            </div>

            <div class="pouch-filters">
                <button class="filter-btn active" data-filter="all">🎯 All</button>
                <button class="filter-btn" data-filter="camp">🏕️ Camp</button>
                <button class="filter-btn" data-filter="proficiency">🎯 Proficiency</button>
                <button class="filter-btn" data-filter="national">🇿🇦 National</button>
                <button class="filter-btn" data-filter="international">🌍 International</button>
                <button class="filter-btn" data-filter="special">⭐ Special</button>
            </div>

            <div class="pouch-grid" id="pouchGrid"></div>

            <div class="pouch-actions">
                <button id="pouchResetBtn">🔄 Reset</button>
                <button class="primary" id="pouchTicketBtn">🎫 Request Badge</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // ─── Render grid ─────────────────────────────────────────────
    function renderGrid() {
        const grid = document.getElementById('pouchGrid');
        if (!grid) return;

        const filtered = getFilteredBadges();

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:#D4B896;padding:40px 0;font-size:14px;">
                    No badges of this type yet. Keep exploring! 🧭
                </div>
            `;
            return;
        }

        grid.innerHTML = '';

        filtered.forEach((badge) => {
            const isUnlocked = badge.unlocked;
            const slot = document.createElement('div');
            slot.className = `pouch-slot ${isUnlocked ? 'unlocked' : 'locked'}`;
            slot.dataset.index = badge.id;
            slot.innerHTML = `
                <span>${badge.icon}</span>
                <span class="slot-name">${badge.name}</span>
                <span class="slot-type">${typeLabels[badge.type] || ''}</span>
                ${!isUnlocked ? '<span class="lock-badge">🔒</span>' : ''}
                <span class="tooltip-text">${isUnlocked ? '✅ Earned!' : '🔒 Click to request'}</span>
            `;

            slot.addEventListener('click', () => {
                if (badge.unlocked) {
                    alert(`🎉 You already earned "${badge.name}"!`);
                } else {
                    alert(`🎫 Request ticket for "${badge.name}"?`);
                }
            });

            grid.appendChild(slot);
        });
    }

    // ─── Filter buttons ──────────────────────────────────────────
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.dataset.filter;
            setFilter(filter);
            renderGrid();
        });
    });

    // ─── Reset button ────────────────────────────────────────────
    document.getElementById('pouchResetBtn')?.addEventListener('click', () => {
        if (confirm('Reset all badges? This will lock everything.')) {
            resetBadges();
            const { total, earned } = getBadgeStats();
            document.getElementById('earnedCount').textContent = earned;
            renderGrid();
        }
    });

    // ─── Ticket button ───────────────────────────────────────────
    document.getElementById('pouchTicketBtn')?.addEventListener('click', () => {
        alert('🎫 Select a locked badge from the grid to request it.');
    });

    // ─── Click scout for surprise ───────────────────────────────
    document.getElementById('scoutCard')?.addEventListener('click', () => {
        const locked = badgeState.filter(b => !b.unlocked);
        if (locked.length === 0) {
            alert('🎉 All badges unlocked! You\'re a legend!');
            return;
        }
        const random = locked[Math.floor(Math.random() * locked.length)];
        random.unlocked = true;
        saveBadgeState();
        const { total, earned } = getBadgeStats();
        document.getElementById('earnedCount').textContent = earned;
        renderGrid();
    });

    // ─── INIT SCOUT ANIMATION ──────────────────────────────────
    initScoutAnimation();

    // ─── Initial render ──────────────────────────────────────────
    renderGrid();
}
