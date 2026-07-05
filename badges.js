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

// ─── SCOUT ANIMATION ────────────────────────────────────
function initScoutAnimation() {
    const canvas = document.getElementById('scoutCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const IMAGES = {
        idle: 'idle.png',
        wave: 'wave.png',
        map: 'map.png',
        left: 'left.png',
        right: 'right.png'
    };

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

    function drawAction(actionKey) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const img = loadedImages[actionKey];
        if (img) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
    }

    let sequenceTimer = null;
    let actionIndex = 0;

    function startAnimation() {
        if (sequenceTimer) clearTimeout(sequenceTimer);
        let startTime = Date.now();

        function playNext() {
            const item = SEQUENCE[actionIndex];
            if (!item) return;

            drawAction(item.action);

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

    loadImages();

    window.addEventListener('beforeunload', () => {
        if (sequenceTimer) clearTimeout(sequenceTimer);
    });
}

// ─── TICKET MODAL ──────────────────────────────────────────
function openTicketModal(badge) {
    const existing = document.querySelector('.ticket-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ticket-modal-overlay';

    overlay.innerHTML = `
        <div class="ticket-modal">
            <button class="modal-close" id="modalCloseBtn">✕</button>
            
            <div class="badge-preview">
                <span class="icon">${badge.icon}</span>
                <div class="info">
                    <div class="name">${badge.name}</div>
                    <div class="type">${badge.type.charAt(0).toUpperCase() + badge.type.slice(1)} Badge</div>
                </div>
            </div>

            <label for="ticketNote">📝 Message to your leader (optional)</label>
            <textarea id="ticketNote" placeholder="Why do you want this badge? Any special request?"></textarea>

            <div class="modal-message" id="modalMessage"></div>

            <div class="modal-actions">
                <button class="btn-cancel" id="modalCancelBtn">Cancel</button>
                <button class="btn-submit" id="modalSubmitBtn">🎫 Request Badge</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    document.getElementById('modalSubmitBtn').addEventListener('click', async function() {
        const note = document.getElementById('ticketNote').value.trim();
        const messageEl = document.getElementById('modalMessage');
        const submitBtn = this;
        const cancelBtn = document.getElementById('modalCancelBtn');

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Submitting...';
        cancelBtn.disabled = true;

        try {
            const module = await import('./tickets.js');
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));

            const result = await module.createTicket(
                currentUser.username,
                badge.id,
                badge.name,
                badge.icon,
                note || ''
            );

            if (result.success) {
                messageEl.className = 'modal-message success';
                messageEl.textContent = `✅ Ticket created for "${badge.name}"! Your leader will review it.`;
                submitBtn.textContent = '✅ Submitted';
                submitBtn.disabled = true;
                cancelBtn.textContent = 'Close';
                cancelBtn.disabled = false;
                cancelBtn.onclick = closeModal;
                setTimeout(closeModal, 3500);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            messageEl.className = 'modal-message error';
            messageEl.textContent = `❌ Failed: ${error.message || 'Something went wrong. Try again.'}`;
            submitBtn.disabled = false;
            submitBtn.textContent = '🎫 Request Badge';
            cancelBtn.disabled = false;
        }
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
            /* ─── LEATHER LOGBOOK THEME ─── */
            .badge-page {
                max-width: 800px;
                width: 100%;
                background: #f2e8d5;
                background-image: 
                    url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4a882' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                border: 8px solid #6b4c3a;
                border-radius: 24px;
                box-shadow: 
                    inset 0 0 0 2px #8b6b4d,
                    0 8px 32px rgba(0,0,0,0.3);
                padding: 30px 24px;
                margin: 0 auto;
                position: relative;
            }

            /* ─── CORNER BRACKETS ─── */
            .corner-bracket {
                position: absolute;
                width: 32px;
                height: 32px;
                border: 3px solid #a08060;
                border-radius: 4px;
                opacity: 0.5;
                pointer-events: none;
            }
            .corner-tl { top: 16px; left: 16px; border-right: none; border-bottom: none; }
            .corner-tr { top: 16px; right: 16px; border-left: none; border-bottom: none; }
            .corner-bl { bottom: 16px; left: 16px; border-right: none; border-top: none; }
            .corner-br { bottom: 16px; right: 16px; border-left: none; border-top: none; }

            /* ─── HEADER ─── */
            .pouch-header-text {
                text-align: center;
                margin-bottom: 24px;
                position: relative;
            }
            .pouch-header-text h2 {
                font-family: 'Georgia', 'Times New Roman', serif;
                font-size: 26px;
                color: #3d2b1f;
                background: #c4a882;
                display: inline-block;
                padding: 8px 32px;
                border-radius: 4px;
                box-shadow: 0 3px 0 #8b6b4d;
                letter-spacing: 2px;
                margin: 0;
                position: relative;
            }
            .pouch-header-text h2::after {
                content: '';
                position: absolute;
                bottom: -10px;
                left: 15%;
                width: 70%;
                height: 3px;
                background: #8b6b4d;
                border-radius: 2px;
            }
            .pouch-header-text p {
                font-size: 14px;
                color: #6b5f4a;
                margin: 12px 0 0 0;
                font-style: italic;
                font-family: 'Georgia', serif;
                letter-spacing: 1px;
            }

            /* ─── SCOUT CARD ─── */
            .pouch-scout-card {
                background: #d4c4a8;
                border: 4px solid #8b6b4d;
                border-radius: 16px;
                box-shadow: inset 0 0 0 2px #b8a080, 0 4px 12px rgba(0,0,0,0.1);
                padding: 14px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 12px;
                cursor: pointer;
                transition: transform 0.2s;
            }
            .pouch-scout-card:hover {
                transform: scale(1.01);
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
                background: #b8a080;
                border-radius: 50%;
                padding: 4px;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
            }
            .pouch-scout-card .scout-info .pixel-scout-wrapper canvas {
                width: 64px;
                height: 64px;
                image-rendering: pixelated;
                display: block;
                background: transparent;
                border-radius: 50%;
            }
            .pouch-scout-card .scout-info .name {
                font-weight: 700;
                font-size: 18px;
                color: #3d2b1f;
                font-family: 'Georgia', serif;
            }
            .pouch-scout-card .scout-info .rank {
                font-size: 13px;
                color: #6b5f4a;
                font-style: italic;
            }
            .pouch-scout-card .badge-count {
                background: #6b4c3a;
                padding: 6px 18px;
                border-radius: 40px;
                color: #f2e8d5;
                font-weight: 600;
                font-size: 14px;
                border: 2px solid #8b6b4d;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
                white-space: nowrap;
                font-family: 'Georgia', serif;
            }
            .pouch-scout-card .badge-count span {
                color: #ffd700;
            }

            /* ─── FILTER BUTTONS ─── */
            .pouch-filters {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 16px;
                justify-content: center;
            }
            .pouch-filters .filter-btn {
                background: #d4c4a8;
                border: 2px solid #8b6b4d;
                padding: 6px 16px;
                border-radius: 40px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                color: #3d2b1f;
                font-family: 'Georgia', serif;
            }
            .pouch-filters .filter-btn:hover {
                background: #c4a882;
                transform: translateY(-2px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .pouch-filters .filter-btn.active {
                background: #6b4c3a;
                color: #f2e8d5;
                border-color: #6b4c3a;
            }

            /* ─── BADGE GRID ─── */
            .pouch-grid {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 12px;
                background: #d4c4a8;
                padding: 16px;
                border-radius: 16px;
                border: 3px solid #8b6b4d;
                box-shadow: inset 0 0 0 2px #b8a080, 0 4px 12px rgba(0,0,0,0.1);
                margin-bottom: 16px;
                min-height: 200px;
            }
            .pouch-slot {
                aspect-ratio: 1 / 1;
                background: #e8dcc8;
                background-image: 
                    repeating-linear-gradient(45deg, rgba(120, 90, 60, 0.05) 0px, rgba(120, 90, 60, 0.05) 2px, transparent 2px, transparent 6px);
                border: 2px dashed #a08060;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                cursor: pointer;
                transition: all 0.25s ease;
                position: relative;
                padding: 6px;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
                min-height: 80px;
            }
            .pouch-slot:hover {
                transform: translateY(-4px) scale(1.02);
                border-color: #b8860b;
                box-shadow: 0 6px 16px rgba(0,0,0,0.15), inset 0 2px 4px rgba(0,0,0,0.05);
                z-index: 2;
            }
            .pouch-slot.locked {
                opacity: 0.6;
                filter: grayscale(0.3);
            }
            .pouch-slot.unlocked {
                border: 2px solid #b8860b;
                background: #f0e8d8;
                box-shadow: 0 0 20px rgba(184, 134, 11, 0.15), inset 0 2px 4px rgba(0,0,0,0.05);
                animation: slotGlow 3s ease-in-out infinite;
            }
            @keyframes slotGlow {
                0%, 100% { box-shadow: 0 0 10px rgba(184, 134, 11, 0.1); }
                50% { box-shadow: 0 0 25px rgba(184, 134, 11, 0.25); }
            }
            .pouch-slot .slot-name {
                font-size: 8px;
                color: #6b5f4a;
                margin-top: 3px;
                text-align: center;
                line-height: 1.2;
                font-weight: 600;
                font-family: 'Georgia', serif;
            }
            .pouch-slot.unlocked .slot-name {
                color: #3d2b1f;
            }
            .pouch-slot .slot-type {
                font-size: 6px;
                text-transform: uppercase;
                color: #8b7a6a;
                letter-spacing: 0.5px;
                margin-top: 1px;
                font-family: 'Georgia', serif;
            }
            .pouch-slot .lock-badge {
                position: absolute;
                top: 4px;
                right: 6px;
                font-size: 12px;
                opacity: 0.8;
            }
            .pouch-slot .tooltip-text {
                display: none;
                position: absolute;
                bottom: calc(100% + 10px);
                left: 50%;
                transform: translateX(-50%);
                background: #3d2b1f;
                color: #f2e8d5;
                padding: 4px 14px;
                border-radius: 8px;
                font-size: 10px;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                z-index: 10;
                font-weight: 500;
                border: 1px solid #8b6b4d;
                font-family: 'Georgia', serif;
            }
            .pouch-slot:hover .tooltip-text {
                display: block;
            }

            /* ─── ACTIONS ─── */
            .pouch-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .pouch-actions button {
                background: #6b4c3a;
                border: none;
                border-bottom: 3px solid #3d2b1f;
                color: #f2e8d5;
                padding: 8px 24px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.15s;
                font-family: 'Georgia', serif;
                letter-spacing: 0.5px;
            }
            .pouch-actions button:hover {
                transform: translateY(-2px);
                border-bottom-width: 5px;
                background: #8b6b4d;
            }
            .pouch-actions button.primary {
                background: #b8860b;
                color: #f2e8d5;
                border-bottom-color: #6b4c3a;
            }
            .pouch-actions button.primary:hover {
                background: #d4a017;
            }

            /* ─── TICKET MODAL ─── */
            .ticket-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            }
            .ticket-modal {
                background: #f2e8d5;
                border: 6px solid #6b4c3a;
                border-radius: 24px;
                padding: 32px;
                max-width: 450px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.4), inset 0 0 0 2px #8b6b4d;
                animation: slideUp 0.3s ease;
                position: relative;
            }
            .ticket-modal .modal-close {
                position: absolute;
                top: 16px;
                right: 20px;
                background: none;
                border: none;
                font-size: 28px;
                color: #6b5f4a;
                cursor: pointer;
                transition: color 0.2s;
            }
            .ticket-modal .modal-close:hover {
                color: #3d2b1f;
            }
            .ticket-modal .badge-preview {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 20px;
                padding-bottom: 16px;
                border-bottom: 2px solid #d4c4a8;
            }
            .ticket-modal .badge-preview .icon {
                font-size: 48px;
            }
            .ticket-modal .badge-preview .info .name {
                font-size: 20px;
                font-weight: 700;
                color: #3d2b1f;
                font-family: 'Georgia', serif;
            }
            .ticket-modal .badge-preview .info .type {
                font-size: 14px;
                color: #6b5f4a;
            }
            .ticket-modal label {
                display: block;
                font-weight: 600;
                font-size: 14px;
                color: #3d2b1f;
                margin-bottom: 6px;
                font-family: 'Georgia', serif;
            }
            .ticket-modal textarea {
                width: 100%;
                padding: 12px;
                border: 2px solid #b8a080;
                border-radius: 12px;
                font-family: inherit;
                font-size: 14px;
                resize: vertical;
                min-height: 80px;
                transition: border-color 0.2s;
                box-sizing: border-box;
                background: #f8f0e0;
            }
            .ticket-modal textarea:focus {
                outline: none;
                border-color: #b8860b;
            }
            .ticket-modal .modal-actions {
                display: flex;
                gap: 12px;
                margin-top: 20px;
            }
            .ticket-modal .modal-actions button {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 40px;
                font-weight: 600;
                font-size: 15px;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Georgia', serif;
            }
            .ticket-modal .modal-actions .btn-cancel {
                background: #d4c4a8;
                color: #3d2b1f;
            }
            .ticket-modal .modal-actions .btn-cancel:hover {
                background: #c4a882;
            }
            .ticket-modal .modal-actions .btn-submit {
                background: #6b4c3a;
                color: #f2e8d5;
            }
            .ticket-modal .modal-actions .btn-submit:hover {
                background: #8b6b4d;
            }
            .ticket-modal .modal-message {
                margin-top: 12px;
                padding: 10px;
                border-radius: 8px;
                font-size: 14px;
                text-align: center;
                display: none;
                font-family: 'Georgia', serif;
            }
            .ticket-modal .modal-message.success {
                display: block;
                background: #d4edda;
                color: #155724;
            }
            .ticket-modal .modal-message.error {
                display: block;
                background: #f8d7da;
                color: #721c24;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            /* ─── RESPONSIVE ─── */
            @media (max-width: 768px) {
                .badge-page { padding: 20px 16px; border-width: 6px; }
                .corner-bracket { width: 24px; height: 24px; }
                .corner-tl, .corner-bl { left: 12px; }
                .corner-tr, .corner-br { right: 12px; }
                .corner-tl, .corner-tr { top: 12px; }
                .corner-bl, .corner-br { bottom: 12px; }
                .pouch-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px; }
                .pouch-slot { font-size: 22px; min-height: 70px; }
                .pouch-slot .slot-name { font-size: 7px; }
                .pouch-header-text h2 { font-size: 20px; padding: 6px 20px; }
                .ticket-modal { padding: 24px; margin: 16px; }
            }
            @media (max-width: 500px) {
                .badge-page { padding: 16px 12px; border-width: 4px; }
                .pouch-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 10px; }
                .pouch-slot { font-size: 18px; min-height: 60px; }
                .pouch-scout-card { flex-direction: column; align-items: stretch; text-align: center; }
                .pouch-scout-card .scout-info { justify-content: center; }
                .pouch-scout-card .badge-count { text-align: center; }
                .pouch-filters .filter-btn { font-size: 10px; padding: 4px 12px; }
                .pouch-header-text h2 { font-size: 18px; }
                .ticket-modal { padding: 20px; }
                .ticket-modal .modal-actions { flex-direction: column; }
            }
        </style>

        <div class="badge-page">
            <!-- Corner Brackets -->
            <div class="corner-bracket corner-tl"></div>
            <div class="corner-bracket corner-tr"></div>
            <div class="corner-bracket corner-bl"></div>
            <div class="corner-bracket corner-br"></div>

            <div class="pouch-header-text">
                <h2>📖 BADGE LOGBOOK</h2>
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
                <div style="grid-column:1/-1;text-align:center;color:#6b5f4a;padding:40px 0;font-size:14px;font-family:'Georgia',serif;font-style:italic;">
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

            slot.addEventListener('click', async () => {
                if (badge.unlocked) {
                    alert(`🎉 You already earned "${badge.name}"!`);
                    return;
                }

                // ─── Check if there's already a pending ticket ──────────
                try {
                    const module = await import('./tickets.js');
                    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
                    
                    const result = await module.getScoutTickets(currentUser.username);
                    if (result.success) {
                        const existing = result.data.find(t => 
                            t.badgeId === badge.id && 
                            (t.status === 'pending' || t.status === 'in-progress')
                        );
                        if (existing) {
                            alert(`⏳ You already have a ticket for "${badge.name}" (${existing.status}). Check with your leader.`);
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('Ticket check failed:', e);
                }

                // ─── Open the modal ──────────────────────────────────────
                openTicketModal(badge);
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
