import { auth, db } from './firebase-config.js';
import { 
    collection, getDocs, doc, getDoc, setDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'leader') {
    window.location.href = 'index.html';
}

const leaderNameEl = document.getElementById('leader-name');
const leaderAvatarEl = document.getElementById('leader-avatar');
const pendingBadgeEl = document.getElementById('pending-badge');
const pageContent = document.getElementById('page-content');

if (leaderNameEl) leaderNameEl.textContent = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
if (leaderAvatarEl) leaderAvatarEl.textContent = currentUser.username.charAt(0).toUpperCase();

let allScouts = [];
let allStatus = {};
let currentView = 'dashboard';
let selectedScoutId = null;
let unsubscribeStatus = null;
let allSessions = [];
let sessionsUnsubscribe = null;

const membershipReqs = [
    "Law and Promise",
    "Scout Uniform, Badges and Positions",
    "Knots and Whipping",
    "Woodcraft Signs",
    "National Flag, Anthem, Emblem, Tree, Flower",
    "Scouting History",
    "Salutes, Signs, Handshake, Scout Staff",
    "Dress a Wound",
    "Whistle Calls, Silent Signs, Formations",
    "Re-test Membership",
    "Interview by Scouter",
    "Investiture"
];

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

document.querySelectorAll('.sidebar-nav a').forEach(function(link) {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.sidebar-nav a').forEach(function(l) {
            l.classList.remove('active');
        });
        this.classList.add('active');
        currentView = this.dataset.view;
        renderView();
    });
});

async function loadScouts() {
    const snapshot = await getDocs(collection(db, 'users'));
    allScouts = [];
    snapshot.forEach(function(doc) {
        const data = doc.data();
        if (data.role === 'scout') {
            allScouts.push({ id: doc.id, username: data.username });
        }
    });
    return allScouts;
}

function listenToStatus() {
    if (unsubscribeStatus) unsubscribeStatus();
    unsubscribeStatus = onSnapshot(collection(db, 'scoutStatus'), function(snapshot) {
        allStatus = {};
        snapshot.forEach(function(doc) {
            allStatus[doc.id] = doc.data();
        });
        renderView();
        updatePendingBadge();
    });
}

function updatePendingBadge() {
    let count = 0;
    for (let i = 0; i < allScouts.length; i++) {
        const scout = allScouts[i];
        const status = allStatus[scout.id] || {};
        for (let j = 0; j < membershipReqs.length; j++) {
            const req = membershipReqs[j];
            const key = 'membership_' + req;
            const value = status[key];
            if (value === 'pending' || (value && value.status === 'pending')) {
                count++;
                break;
            }
        }
    }
    if (pendingBadgeEl) pendingBadgeEl.textContent = count;
}

function renderView() {
    if (!pageContent) return;
    pageContent.innerHTML = '';

    if (currentView === 'dashboard') {
        renderDashboard();
    } else if (currentView === 'scouts') {
        renderAllScouts();
    } else if (currentView === 'pending') {
        renderPending();
    } else if (currentView === 'sessions') {
        renderSessions();
    } else if (currentView === 'export') {
        renderExport();
    } else if (currentView === 'scout-detail' && selectedScoutId) {
        renderScoutDetail(selectedScoutId);
    } else {
        pageContent.innerHTML = '<p style="color:#5a7c6e;">View "' + currentView + '" not found.</p>';
    }
}

function renderDashboard() {
    // ─── Calculate stats ──────────────────────────────────────
    let totalScouts = allScouts.length;
    let totalRequirementsDone = 0;
    let totalPossible = membershipReqs.length * totalScouts;
    const pendingItems = [];

    for (let i = 0; i < allScouts.length; i++) {
        const scout = allScouts[i];
        const status = allStatus[scout.id] || {};
        let done = 0, pending = 0;
        for (let j = 0; j < membershipReqs.length; j++) {
            const req = membershipReqs[j];
            const key = 'membership_' + req;
            const value = status[key];
            if (value === 'pending' || (value && value.status === 'pending')) {
                pending++;
                pendingItems.push({ scout: scout, req: req, key: key });
            } else if (value && value.status === 'approved') {
                done++;
            }
        }
        totalRequirementsDone += done;
    }

    const attendedThisWeek = Math.floor(totalScouts * 0.6);
    const percent = totalScouts > 0 ? Math.round((attendedThisWeek / totalScouts) * 100) : 0;

    // ─── Build pending HTML ──────────────────────────────────
    let pendingHTML = '';
    const showCount = 3;
    const visibleItems = pendingItems.slice(0, showCount);
    const remaining = pendingItems.length - showCount;

    if (pendingItems.length > 0) {
        pendingHTML = `
            <div style="background:#fef9f0; border-left:4px solid #d4a86a; border-radius:16px; padding:16px 20px; height:100%;">
                <div style="font-weight:600; color:#2d5a4a; margin-bottom:10px;">✋ ${pendingItems.length} scout(s) need your approval</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${visibleItems.map(({ scout, req }) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:white; border-radius:12px; padding:8px 12px; flex-wrap:wrap; gap:8px;">
                            <span style="font-size:14px; color:#2d5a4a;"><strong>${scout.username}</strong> — ${req}</span>
                            <button class="pending-approve-btn" data-scout="${scout.id}" data-req="${req}" style="background:#8fbcbb; color:white; border:none; padding:4px 14px; border-radius:30px; font-size:12px; cursor:pointer;">Approve</button>
                        </div>
                    `).join('')}
                    ${remaining > 0 ? `<div style="text-align:right; margin-top:4px;"><a href="#" id="pending-view-all" style="color:#8fbcbb; font-size:14px; font-weight:500; text-decoration:none;">View All ${remaining} more →</a></div>` : ''}
                </div>
            </div>
        `;
    } else {
        pendingHTML = `
            <div style="background:#e8f0ec; border-radius:16px; padding:16px 20px; height:100%; display:flex; align-items:center;">
                <span style="font-size:16px; color:#5a7c6e;">✅ No pending approvals — all caught up!</span>
            </div>
        `;
    }

    // ─── Build full HTML ─────────────────────────────────────
    let html = `
        <!-- HEADER -->
        <div class="header">
            <div class="header-left">
                <h1>Good morning, ${currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1)}! 🎉</h1>
                <p>welcome back ~</p>
            </div>
            <div class="header-right">
                <span class="avatar" id="leader-avatar">${currentUser.username.charAt(0).toUpperCase()}</span>
            </div>
        </div>

        <!-- ROW 1: STATS CARDS (3 columns) -->
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:24px;">
            <div style="background:white; border-radius:24px; padding:20px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:32px; font-weight:700; color:#8fbcbb;">${totalScouts}</div>
                <div style="font-size:14px; color:#5a7c6e; margin-top:8px;">🏕️ Total Scouts</div>
            </div>
            <div style="background:white; border-radius:24px; padding:20px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:32px; font-weight:700; color:#d4a86a;">${totalRequirementsDone} / ${totalPossible}</div>
                <div style="font-size:14px; color:#5a7c6e; margin-top:8px;">📋 Requirements Done</div>
            </div>
            <div style="background:white; border-radius:24px; padding:20px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:32px; font-weight:700; color:#b0c4b8;">0</div>
                <div style="font-size:14px; color:#5a7c6e; margin-top:8px;">⏱️ Active Scouting Hours</div>
            </div>
        </div>

        <!-- ROW 2: PENDING (spans col 1 & 2) + ATTENDANCE + SCOUT LEVELS (col 3) -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px; margin-bottom:28px;">
            <div style="grid-column: span 2;">
                ${pendingHTML}
            </div>
            <div style="display:flex; flex-direction:column; gap:16px;">
                <div style="background:white; border-radius:24px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); text-align:center;">
                    <div style="position:relative; width:100px; height:100px; margin:0 auto;">
                        <svg viewBox="0 0 120 120" style="transform:rotate(-90deg); width:100%; height:100%;">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#e8f0ec" stroke-width="12"/>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#8fbcbb" stroke-width="12" stroke-linecap="round"
                                stroke-dasharray="314.16" stroke-dashoffset="${314.16 - (percent / 100) * 314.16}" style="transition: stroke-dashoffset 1.2s ease-out;"/>
                        </svg>
                        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);">
                            <div style="font-size:20px; font-weight:700; color:#2d5a4a;">${percent}%</div>
                            <div style="font-size:10px; color:#5a7c6e;">Attendance</div>
                        </div>
                    </div>
                    <div style="font-size:12px; color:#5a7c6e; margin-top:8px;">${attendedThisWeek} of ${totalScouts} attended this week</div>
                </div>

                <div style="background:white; border-radius:24px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                    <div style="font-weight:600; color:#2d5a4a; font-size:14px; margin-bottom:12px;">📊 Scout Levels</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:14px; color:#2d5a4a; padding:6px 0; border-bottom:1px solid #e8f0ec;">
                            <span>🏅 Membership</span>
                            <span style="font-weight:600;">${totalScouts}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:14px; color:#2d5a4a; padding:6px 0; border-bottom:1px solid #e8f0ec;">
                            <span>⭐ Second Class</span>
                            <span style="font-weight:600; color:#b0c4b8;">0</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:14px; color:#2d5a4a; padding:6px 0;">
                            <span>🌟 First Class</span>
                            <span style="font-weight:600; color:#b0c4b8;">0</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ROW 3: SCOUT CARDS (3 columns) -->
        <div>
            <h2 style="color:#2d5a4a; font-size:18px; font-weight:600; margin-bottom:16px;">📋 All Scouts</h2>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px;">
                ${allScouts.length > 0 ? allScouts.map(function(scout) {
                    const status = allStatus[scout.id] || {};
                    let done = 0;
                    for (let j = 0; j < membershipReqs.length; j++) {
                        const req = membershipReqs[j];
                        const key = 'membership_' + req;
                        const value = status[key];
                        if (value && value.status === 'approved') done++;
                    }
                    const progress = membershipReqs.length > 0 ? Math.round((done / membershipReqs.length) * 100) : 0;
                    const color = getColor(scout.username);
                    return `
                        <div class="scout-card" data-id="${scout.id}" style="background:white; border-radius:20px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); cursor:pointer; transition:all 0.2s;">
                            <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                                <div style="width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:18px; color:white; background:${color};">${scout.username.charAt(0).toUpperCase()}</div>
                                <span style="font-weight:600; font-size:15px; color:#2d5a4a;">${scout.username}</span>
                            </div>
                            <div style="font-size:13px; color:#5a7c6e; margin-bottom:6px;">${progress}%</div>
                            <div style="background:#e8f0ec; border-radius:20px; height:6px; overflow:hidden;">
                                <div style="background:#8fbcbb; height:100%; width:${progress}%; border-radius:20px;"></div>
                            </div>
                        </div>
                    `;
                }).join('') : '<p style="color:#5a7c6e; text-align:center; padding:40px;">No scouts found.</p>'}
            </div>
            <p style="text-align:center; color:#b0c4b8; font-size:13px; margin-top:12px;">👆 Click any scout to view their progress</p>
        </div>
    `;

    pageContent.innerHTML = html;

    // ─── Event Listeners ──────────────────────────────────────
    document.querySelectorAll('.pending-approve-btn').forEach(function(btn) {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const scoutId = this.dataset.scout;
            const reqName = this.dataset.req;
            await approveRequirement(scoutId, reqName);
            renderView();
        });
    });

    const viewAllLink = document.getElementById('pending-view-all');
    if (viewAllLink) {
        viewAllLink.addEventListener('click', function(e) {
            e.preventDefault();
            const pendingLink = document.querySelector('.sidebar-nav a[data-view="pending"]');
            if (pendingLink) pendingLink.click();
        });
    }

    document.querySelectorAll('.scout-card').forEach(function(card) {
        card.addEventListener('click', function() {
            selectedScoutId = this.dataset.id;
            currentView = 'scout-detail';
            document.querySelectorAll('.sidebar-nav a').forEach(function(l) {
                l.classList.remove('active');
            });
            renderView();
        });
    });
}

function renderAllScouts() {
    let html = `
        <div class="header">
            <div class="header-left">
                <h1>👥 All Scouts</h1>
                <p>Manage your scout roster</p>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; gap:12px; flex:1; max-width:320px; background:white; padding:10px 18px; border-radius:40px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <span>🔍</span>
                <input type="text" id="search-input" placeholder="Search scouts..." style="border:none; background:none; outline:none; font-size:14px; color:#2d5a4a; width:100%;">
            </div>
            <select id="filter-select" style="background:white; padding:10px 18px; border-radius:40px; border:none; font-size:14px; color:#2d5a4a; box-shadow:0 2px 8px rgba(0,0,0,0.04); cursor:pointer;">
                <option value="all">All</option>
                <option value="badge-earned">Badge Earned</option>
                <option value="on-trail">On the Trail</option>
                <option value="at-trailhead">At the Trailhead</option>
            </select>
        </div>
        <div id="scout-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px;">
            ${allScouts.map(function(scout) { return scoutCardHTML(scout); }).join('')}
        </div>
    `;
    pageContent.innerHTML = html;

    const searchInput = document.getElementById('search-input');
    const filterSelect = document.getElementById('filter-select');
    if (searchInput) searchInput.addEventListener('input', filterScouts);
    if (filterSelect) filterSelect.addEventListener('change', filterScouts);

    document.querySelectorAll('.scout-card').forEach(function(card) {
        card.addEventListener('click', function() {
            selectedScoutId = this.dataset.id;
            currentView = 'scout-detail';
            document.querySelectorAll('.sidebar-nav a').forEach(function(l) {
                l.classList.remove('active');
            });
            renderView();
        });
    });
}

function filterScouts() {
    const query = document.getElementById('search-input')?.value.toLowerCase() || '';
    const filter = document.getElementById('filter-select')?.value || 'all';
    const grid = document.getElementById('scout-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.scout-card');
    cards.forEach(function(card) {
        const name = card.dataset.name.toLowerCase();
        const progress = parseFloat(card.dataset.progress);
        let show = true;
        if (query && !name.includes(query)) show = false;
        if (filter === 'badge-earned' && progress < 1) show = false;
        if (filter === 'on-trail' && (progress < 0.5 || progress === 1)) show = false;
        if (filter === 'at-trailhead' && progress >= 0.5) show = false;
        card.style.display = show ? '' : 'none';
    });
}

function renderPending() {
    const pendingItems = [];
    for (let i = 0; i < allScouts.length; i++) {
        const scout = allScouts[i];
        const status = allStatus[scout.id] || {};
        for (let j = 0; j < membershipReqs.length; j++) {
            const req = membershipReqs[j];
            const key = 'membership_' + req;
            const value = status[key];
            if (value === 'pending' || (value && value.status === 'pending')) {
                pendingItems.push({ scout: scout, req: req, key: key });
            }
        }
    }

    if (pendingItems.length === 0) {
        pageContent.innerHTML = '<p style="color:#5a7c6e;">✅ No pending approvals — you\'re all caught up!</p>';
        return;
    }

    let html = `
        <div class="header">
            <div class="header-left">
                <h1>✋ Pending Approvals</h1>
                <p>Scouts waiting for your sign-off</p>
            </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px;">
    `;
    for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        const color = getColor(item.scout.username);
        html += `
            <div style="background:white; border-radius:16px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:14px; color:white; background:${color};">${item.scout.username.charAt(0).toUpperCase()}</div>
                    <span style="font-weight:500; color:#2d5a4a;">${item.scout.username}</span>
                    <span style="color:#5a7c6e; font-size:14px;">— ${item.req}</span>
                </div>
                <button class="approve-btn" data-scout="${item.scout.id}" data-req="${item.req}" style="background:#8fbcbb; color:white; border:none; padding:6px 18px; border-radius:40px; font-weight:500; cursor:pointer;">Approve</button>
            </div>
        `;
    }
    html += '</div>';
    pageContent.innerHTML = html;

    document.querySelectorAll('.approve-btn').forEach(function(btn) {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const scoutId = this.dataset.scout;
            const reqName = this.dataset.req;
            await approveRequirement(scoutId, reqName);
            renderView();
        });
    });
}

function renderSessions() {
    let html = `
        <div class="header">
            <div class="header-left">
                <h1>📋 Sessions</h1>
                <p>Manage your scout activities and attendance</p>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <button id="sessions-new-btn" style="background:#8fbcbb; color:white; border:none; padding:8px 20px; border-radius:40px; font-weight:500; cursor:pointer;">➕ New Session</button>
        </div>
        <div id="sessions-list-container">
            <p style="color:#5a7c6e;">Loading sessions...</p>
        </div>
    `;
    pageContent.innerHTML = html;

    const newBtn = document.getElementById('sessions-new-btn');
    if (newBtn) {
        newBtn.addEventListener('click', function() {
            window.location.href = 'new-session.html';
        });
    }

    if (sessionsUnsubscribe) sessionsUnsubscribe();
    sessionsUnsubscribe = onSnapshot(collection(db, 'sessions'), function(snapshot) {
        allSessions = [];
        snapshot.forEach(function(doc) {
            allSessions.push({ id: doc.id, ...doc.data() });
        });
        renderSessionsList();
    }, function(error) {
        const container = document.getElementById('sessions-list-container');
        if (container) container.innerHTML = '<p style="color:#c47a7a;">❌ Error: ' + error.message + '</p>';
        console.error(error);
    });
}

function renderSessionsList() {
    const container = document.getElementById('sessions-list-container');
    if (!container) return;

    if (allSessions.length === 0) {
        container.innerHTML = `
            <div style="background:white; border-radius:20px; padding:40px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <p style="color:#5a7c6e; font-size:18px;">📋 No sessions yet.</p>
                <p style="color:#5a7c6e;">Click "New Session" to create your first activity.</p>
            </div>
        `;
        return;
    }

    const sorted = allSessions.slice().sort(function(a, b) {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        if (a.time > b.time) return -1;
        if (a.time < b.time) return 1;
        return 0;
    });

    let html = '<div style="display:flex; flex-direction:column; gap:16px;">';
    for (let i = 0; i < sorted.length; i++) {
        const session = sorted[i];
        const scoutCount = allScouts.length;
        let attended = 0;
        if (session.attendance) {
            for (const key in session.attendance) {
                if (session.attendance[key] === true) attended++;
            }
        }
        const percent = scoutCount > 0 ? Math.round((attended / scoutCount) * 100) : 0;
        html += `
            <div style="background:white; border-radius:20px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); cursor:pointer;" data-id="${session.id}">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <div style="font-weight:600; font-size:18px; color:#2d5a4a;">${session.name}</div>
                        <div style="color:#5a7c6e; font-size:14px;">
                            📅 ${session.date} · ${session.time} · 📍 ${session.location || 'TBD'}
                        </div>
                        <div style="color:#5a7c6e; font-size:14px; margin-top:4px;">
                            👥 ${attended}/${scoutCount} scouts attended (${percent}%)
                        </div>
                    </div>
                    <div style="font-size:14px; color:#5a7c6e; text-align:right;">
                        ${session.purpose ? '<div style="max-width:200px; font-style:italic;">' + session.purpose.substring(0, 60) + (session.purpose.length > 60 ? '...' : '') + '</div>' : ''}
                        <div style="font-size:12px; color:#b0c4b8;">Created by ${session.createdBy || 'unknown'}</div>
                    </div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;

    document.querySelectorAll('[data-id]').forEach(function(card) {
        card.addEventListener('click', function() {
            window.location.href = 'session-detail.html?id=' + this.dataset.id;
        });
    });
}

function renderScoutDetail(scoutId) {
    let scout = null;
    for (let i = 0; i < allScouts.length; i++) {
        if (allScouts[i].id === scoutId) {
            scout = allScouts[i];
            break;
        }
    }
    if (!scout) {
        currentView = 'dashboard';
        renderView();
        return;
    }

    const status = allStatus[scoutId] || {};
    let done = 0;
    for (let j = 0; j < membershipReqs.length; j++) {
        const req = membershipReqs[j];
        const key = 'membership_' + req;
        const data = status[key];
        if (data && data.status === 'approved') done++;
    }
    const progress = membershipReqs.length > 0 ? done / membershipReqs.length : 0;

    let html = `
        <div class="header">
            <div class="header-left">
                <h1>${scout.username}</h1>
                <p>Membership Badge · ${done}/${membershipReqs.length} completed</p>
            </div>
        </div>
        <span id="detail-back" style="cursor:pointer; color:#5a7c6e; font-weight:500; display:inline-block; margin-bottom:16px;">← Back</span>
        <div style="background:white; border-radius:20px; padding:20px; margin-bottom:24px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex; justify-content:space-between; font-size:14px; color:#2d5a4a; margin-bottom:8px;">
                <span>Progress</span>
                <span>${Math.round(progress * 100)}%</span>
            </div>
            <div style="background:#e8f0ec; border-radius:20px; height:8px; overflow:hidden;">
                <div style="background:#8fbcbb; height:100%; width:${progress * 100}%; border-radius:20px;"></div>
            </div>
        </div>
        <div style="background:white; border-radius:20px; padding:20px; margin-bottom:24px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <label style="font-weight:600; color:#2d5a4a;">📝 Private Note <span style="font-weight:400; color:#5a7c6e;">(only you can see this)</span></label>
            <textarea id="note-textarea" style="width:100%; padding:12px; border:1px solid #e0ece4; border-radius:16px; font-family:inherit; font-size:14px; resize:vertical; min-height:80px; margin-top:8px;">${status.leaderNote || ''}</textarea>
            <button id="save-note-btn" style="background:#7a9e8a; color:white; border:none; padding:8px 20px; border-radius:40px; font-weight:500; cursor:pointer; margin-top:10px;">💾 Save Note</button>
        </div>
        <div style="background:white; border-radius:20px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <h3 style="color:#2d5a4a; margin-bottom:12px;">Requirements</h3>
            ${membershipReqs.map(function(req) {
                const data = status['membership_' + req];
                const stat = data ? data.status : 'todo';
                const icon = stat === 'approved' ? '✅' : stat === 'pending' ? '✋' : '⭕';
                const label = stat === 'approved' ? 'Completed' : stat === 'pending' ? 'Pending' : 'Not started';
                let meta = '';
                if (stat === 'approved') {
                    meta = 'Approved by ' + (data.approvedBy || 'leader') + ' · ' + (data.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : 'recently');
                }
                return '<div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid #e8f0ec; flex-wrap:wrap; gap:8px;"><span>' + icon + ' ' + req + '</span><span style="font-weight:500; ' + (stat === 'approved' ? 'color:#8fbcbb' : stat === 'pending' ? 'color:#d4a86a' : 'color:#b0c4b8') + ';">' + label + (meta ? ' <span style="font-size:13px; color:#5a7c6e; font-weight:400;">— ' + meta + '</span>' : '') + '</span></div>';
            }).join('')}
        </div>
    `;
    pageContent.innerHTML = html;

    const backBtn = document.getElementById('detail-back');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            currentView = 'dashboard';
            const dashboardLink = document.querySelector('.sidebar-nav a[data-view="dashboard"]');
            if (dashboardLink) dashboardLink.classList.add('active');
            renderView();
        });
    }

    const saveBtn = document.getElementById('save-note-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async function() {
            const note = document.getElementById('note-textarea').value;
            const ref = doc(db, 'scoutStatus', scoutId);
            const docSnap = await getDoc(ref);
            const current = docSnap.exists() ? docSnap.data() : {};
            current.leaderNote = note;
            await setDoc(ref, current);
            alert('✅ Note saved!');
        });
    }
}

function renderExport() {
    let html = `
        <div class="header">
            <div class="header-left">
                <h1>📤 Export Reports</h1>
                <p>Download scout progress data</p>
            </div>
        </div>
        <div style="background:white; border-radius:20px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <p style="color:#5a7c6e; margin-bottom:20px;">Download scout progress as a CSV file for reports, parents, or school records.</p>
            <button id="export-all-btn" style="background:#a8c4d4; color:#2d5a4a; border:none; padding:8px 20px; border-radius:40px; font-weight:500; cursor:pointer;">📥 Export All Scouts</button>
            <button id="export-pending-btn" style="background:#a8c4d4; color:#2d5a4a; border:none; padding:8px 20px; border-radius:40px; font-weight:500; cursor:pointer; margin-left:12px;">📥 Export Pending Only</button>
            <div id="export-status" style="margin-top:16px; color:#5a7c6e;"></div>
        </div>
    `;
    pageContent.innerHTML = html;

    const allBtn = document.getElementById('export-all-btn');
    const pendingBtn = document.getElementById('export-pending-btn');
    if (allBtn) allBtn.addEventListener('click', function() { exportCSV('all'); });
    if (pendingBtn) pendingBtn.addEventListener('click', function() { exportCSV('pending'); });
}

function exportCSV(type) {
    const rows = [['Scout', 'Requirement', 'Status', 'Approved By', 'Approved At']];
    for (let i = 0; i < allScouts.length; i++) {
        const scout = allScouts[i];
        const status = allStatus[scout.id] || {};
        for (let j = 0; j < membershipReqs.length; j++) {
            const req = membershipReqs[j];
            const key = 'membership_' + req;
            const data = status[key];
            if (type === 'pending' && (!data || data.status !== 'pending')) continue;
            const stat = data ? data.status : 'todo';
            const by = data?.approvedBy || '';
            const at = data?.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : '';
            rows.push([scout.username, req, stat, by, at]);
        }
    }
    let csv = '';
    for (let i = 0; i < rows.length; i++) {
        csv += rows[i].join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scout-progress-' + type + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    const statusEl = document.getElementById('export-status');
    if (statusEl) statusEl.textContent = '✅ ' + (type === 'all' ? 'All' : 'Pending') + ' report downloaded!';
}

function getColor(name) {
    const colors = ['#7a9e8a', '#a8c4d4', '#d4a86a', '#8fbcbb', '#c47a7a', '#b0a8c4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function scoutCardHTML(scout) {
    const status = allStatus[scout.id] || {};
    let done = 0, pending = 0;
    for (let j = 0; j < membershipReqs.length; j++) {
        const req = membershipReqs[j];
        const key = 'membership_' + req;
        const value = status[key];
        if (value === 'pending' || (value && value.status === 'pending')) {
            pending++;
        } else if (value && value.status === 'approved') {
            done++;
        }
    }
    const total = membershipReqs.length;
    const progress = total > 0 ? done / total : 0;
    const hasNote = !!status.leaderNote;
    const color = getColor(scout.username);
    let html = '';
    html += '<div class="scout-card" data-id="' + scout.id + '" data-name="' + scout.username.toLowerCase() + '" data-progress="' + progress + '" style="background:white; border-radius:20px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); cursor:pointer; transition:all 0.2s;">';
    html += '<div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">';
    html += '<div style="width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:18px; color:white; background:' + color + ';">' + scout.username.charAt(0).toUpperCase() + '</div>';
    html += '<span style="font-weight:600; font-size:15px; color:#2d5a4a;">' + scout.username + '</span>';
    html += '</div>';
    html += '<div style="font-size:13px; color:#5a7c6e; margin-bottom:6px;">' + done + '/' + total + ' done</div>';
    html += '<div style="background:#e8f0ec; border-radius:20px; height:6px; overflow:hidden;"><div style="background:#8fbcbb; height:100%; width:' + (progress * 100) + '%; border-radius:20px;"></div></div>';
    html += '<div style="display:flex; gap:12px; font-size:12px; color:#5a7c6e; margin-top:8px; flex-wrap:wrap;">';
    html += '<span style="color:#8fbcbb;">🟢 ' + done + ' done</span>';
    if (pending > 0) html += '<span style="color:#d4a86a;">✋ ' + pending + ' pending</span>';
    html += '<span style="color:#c47a7a;">⚠️ ' + (total - done - pending) + ' missing</span>';
    html += '</div>';
    if (hasNote) html += '<div style="margin-top:6px; font-size:12px; color:#7a9ec4;">📝 Has private note</div>';
    html += '</div>';
    return html;
}

async function approveRequirement(scoutId, reqName) {
    const ref = doc(db, 'scoutStatus', scoutId);
    const docSnap = await getDoc(ref);
    const current = docSnap.exists() ? docSnap.data() : {};
    current['membership_' + reqName] = {
        status: 'approved',
        approvedBy: currentUser.username,
        approvedAt: new Date().toISOString()
    };
    await setDoc(ref, current);
    renderView();
}

async function init() {
    await loadScouts();
    listenToStatus();
    renderView();
}

init();
