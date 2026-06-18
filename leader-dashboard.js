import { auth, db } from './firebase-config.js';
import { 
    collection, getDocs, doc, getDoc, setDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── State ──────────────────────────────────────────────
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'leader') window.location.href = 'index.html';

document.getElementById('leader-name').textContent = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
document.getElementById('leader-avatar').textContent = currentUser.username.charAt(0).toUpperCase();

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

// ─── Logout ──────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

// ─── Navigation using URL hash ──────────────────────────
function navigateTo(view) {
    window.location.hash = view;
}

function getViewFromHash() {
    const hash = window.location.hash.replace('#', '');
    return hash || 'dashboard';
}

// ─── Sidebar click handlers ─────────────────────────────
document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const view = this.dataset.view;
        if (view) navigateTo(view);
    });
});

// ─── Hash change listener ───────────────────────────────
window.addEventListener('hashchange', () => {
    const view = getViewFromHash();
    currentView = view;
    
    // Update active link
    document.querySelectorAll('.sidebar-nav a').forEach(l => {
        l.classList.toggle('active', l.dataset.view === view);
    });
    
    renderView();
});

// ─── Load Scouts ─────────────────────────────────────────
async function loadScouts() {
    const snapshot = await getDocs(collection(db, 'users'));
    allScouts = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.role === 'scout') {
            allScouts.push({ id: doc.id, username: data.username });
        }
    });
    return allScouts;
}

// ─── Live Status Listener ────────────────────────────────
function listenToStatus() {
    if (unsubscribeStatus) unsubscribeStatus();
    unsubscribeStatus = onSnapshot(collection(db, 'scoutStatus'), (snapshot) => {
        allStatus = {};
        snapshot.forEach(doc => {
            allStatus[doc.id] = doc.data();
        });
        renderView();
        updatePendingBadge();
    });
}

function updatePendingBadge() {
    let count = 0;
    for (const scout of allScouts) {
        const status = allStatus[scout.id] || {};
        for (const req of membershipReqs) {
            const key = `membership_${req}`;
            const value = status[key];
            if (value === 'pending' || (value && value.status === 'pending')) {
                count++;
                break;
            }
        }
    }
    const badge = document.getElementById('pending-badge');
    if (badge) badge.textContent = count;
}

// ─── Render Views ─────────────────────────────────────────
function renderView() {
    const container = document.getElementById('page-content');
    if (!container) return;
    
    // Dashboard renders directly into the main area
    if (currentView === 'dashboard') {
        container.style.display = 'none';
        renderDashboard();
        return;
    }
    
    // Other views render inside the container
    container.style.display = 'block';
    
    switch(currentView) {
        case 'scouts':
            renderAllScouts(container);
            break;
        case 'pending':
            renderPending(container);
            break;
        case 'sessions':
            renderSessions(container);
            break;
        case 'export':
            renderExport(container);
            break;
        case 'scout-detail':
            if (selectedScoutId) renderScoutDetail(container, selectedScoutId);
            break;
        default:
            container.innerHTML = `<p style="color:#5a7c6e;">View "${currentView}" not found.</p>`;
    }
}

// ─── Dashboard ────────────────────────────────────────────
function renderDashboard() {
    let completed = 0, onTrack = 0, needsHelp = 0, pendingCount = 0;

    for (const scout of allScouts) {
        const status = allStatus[scout.id] || {};
        let done = 0, pending = 0;
        for (const req of membershipReqs) {
            const key = `membership_${req}`;
            const value = status[key];
            if (value === 'pending' || (value && value.status === 'pending')) pending++;
            else if (value && value.status === 'approved') done++;
        }
        const progress = membershipReqs.length > 0 ? done / membershipReqs.length : 0;
        if (progress === 1) completed++;
        else if (progress >= 0.5) onTrack++;
        else needsHelp++;
        if (pending > 0) pendingCount++;
    }

    document.getElementById('stats-grid').innerHTML = `
        <div class="stat-card green">
            <div class="icon">✅</div>
            <div class="number">${completed}</div>
            <div class="label">Completed</div>
        </div>
        <div class="stat-card yellow">
            <div class="icon">🟡</div>
            <div class="number">${onTrack}</div>
            <div class="label">On Track</div>
        </div>
        <div class="stat-card red">
            <div class="icon">🔴</div>
            <div class="number">${needsHelp}</div>
            <div class="label">Needs Help</div>
        </div>
        <div class="stat-card blue">
            <div class="icon">✋</div>
            <div class="number">${pendingCount}</div>
            <div class="label">Pending</div>
        </div>
    `;

    const banner = document.getElementById('pending-banner');
    if (pendingCount > 0) {
        banner.style.display = 'block';
        document.getElementById('pending-count-text').textContent = pendingCount;
        document.getElementById('pending-banner-link').onclick = (e) => {
            e.preventDefault();
            navigateTo('pending');
        };
    } else {
        banner.style.display = 'none';
    }

    const totalScouts = allScouts.length;
    const attendedThisWeek = Math.floor(totalScouts * 0.6);
    const absentThisWeek = totalScouts - attendedThisWeek;
    const percent = totalScouts > 0 ? Math.round((attendedThisWeek / totalScouts) * 100) : 0;

    document.getElementById('attendance-percent').textContent = percent + '%';
    document.getElementById('attended-count').textContent = attendedThisWeek;
    document.getElementById('total-scouts').textContent = totalScouts;
    document.getElementById('attended-count-breakdown').textContent = attendedThisWeek;
    document.getElementById('absent-count').textContent = absentThisWeek;
    document.getElementById('total-scouts-breakdown').textContent = totalScouts;

    const ring = document.getElementById('attendance-ring');
    if (ring) {
        const circumference = 314.16;
        const offset = circumference - (percent / 100) * circumference;
        ring.style.strokeDashoffset = offset;
    }

    const grid = document.getElementById('scout-grid');
    if (allScouts.length === 0) {
        grid.innerHTML = `<p style="color:#5a7c6e; text-align:center; padding:40px;">No scouts found.</p>`;
        return;
    }
    grid.innerHTML = allScouts.map(scout => {
        const status = allStatus[scout.id] || {};
        let done = 0;
        for (const req of membershipReqs) {
            const key = `membership_${req}`;
            const value = status[key];
            if (value && value.status === 'approved') done++;
        }
        const progress = membershipReqs.length > 0 ? Math.round((done / membershipReqs.length) * 100) : 0;
        const color = getColor(scout.username);
        return `
            <div class="scout-card" data-id="${scout.id}" style="cursor:pointer;">
                <div class="scout-top">
                    <div class="scout-avatar" style="background:${color}">${scout.username.charAt(0).toUpperCase()}</div>
                    <span class="scout-name">${scout.username}</span>
                </div>
                <div class="scout-progress-text">${progress}%</div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('#scout-grid .scout-card').forEach(card => {
        card.addEventListener('click', () => {
            selectedScoutId = card.dataset.id;
            currentView = 'scout-detail';
            navigateTo('scout-detail');
        });
    });
}

// ─── All Scouts ──────────────────────────────────────────
function renderAllScouts(container) {
    container.innerHTML = `
        <div class="toolbar">
            <div class="search-box">
                <span>🔍</span>
                <input type="text" id="search-input" placeholder="Search scouts...">
            </div>
            <select class="filter-select" id="filter-select">
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="on-track">On Track</option>
                <option value="needs-help">Needs Help</option>
            </select>
        </div>
        <div class="scout-grid" id="scout-grid">
            ${allScouts.map(scout => scoutCardHTML(scout)).join('')}
        </div>
    `;

    document.getElementById('search-input').addEventListener('input', filterScouts);
    document.getElementById('filter-select').addEventListener('change', filterScouts);

    document.querySelectorAll('.scout-card').forEach(card => {
        card.addEventListener('click', () => {
            selectedScoutId = card.dataset.id;
            currentView = 'scout-detail';
            navigateTo('scout-detail');
        });
    });
}

function filterScouts() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filter = document.getElementById('filter-select').value;
    const grid = document.getElementById('scout-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.scout-card');
    cards.forEach(card => {
        const name = card.dataset.name.toLowerCase();
        const progress = parseFloat(card.dataset.progress);
        let show = true;
        if (query && !name.includes(query)) show = false;
        if (filter === 'completed' && progress < 1) show = false;
        if (filter === 'on-track' && (progress < 0.5 || progress === 1)) show = false;
        if (filter === 'needs-help' && progress >= 0.5) show = false;
        card.style.display = show ? '' : 'none';
    });
}

// ─── Pending ──────────────────────────────────────────────
function renderPending(container) {
    const pendingItems = [];
    for (const scout of allScouts) {
        const status = allStatus[scout.id] || {};
        for (const req of membershipReqs) {
            const key = `membership_${req}`;
            const value = status[key];
            if (value === 'pending' || (value && value.status === 'pending')) {
                pendingItems.push({ scout, req, key });
            }
        }
    }

    if (pendingItems.length === 0) {
        container.innerHTML = `<p style="color:#5a7c6e;">✅ No pending approvals — you're all caught up!</p>`;
        return;
    }

    container.innerHTML = `
        <div class="pending-list">
            ${pendingItems.map(({ scout, req }) => `
                <div class="pending-item" data-scout="${scout.id}" data-req="${req}">
                    <div class="pending-info">
                        <div class="avatar-small" style="background:${getColor(scout.username)}">${scout.username.charAt(0).toUpperCase()}</div>
                        <span class="pending-name">${scout.username}</span>
                        <span class="pending-req">— ${req}</span>
                    </div>
                    <button class="approve-btn">Approve</button>
                </div>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = btn.closest('.pending-item');
            const scoutId = item.dataset.scout;
            const reqName = item.dataset.req;
            await approveRequirement(scoutId, reqName);
        });
    });
}

// ─── Sessions ──────────────────────────────────────────────
function renderSessions(container) {
    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="color:#2d5a4a;">📋 Sessions</h2>
                <p style="color:#5a7c6e;">Manage your scout activities and attendance</p>
            </div>
            <button class="export-btn" id="sessions-new-btn" style="background:#8fbcbb;color:white;">➕ New Session</button>
        </div>
        <div id="sessions-list-container">
            <p style="color:#5a7c6e;">Loading sessions...</p>
        </div>
    `;

    document.getElementById('sessions-new-btn').addEventListener('click', () => {
        window.location.href = 'new-session.html';
    });

    if (sessionsUnsubscribe) sessionsUnsubscribe();
    sessionsUnsubscribe = onSnapshot(collection(db, 'sessions'), (snapshot) => {
        allSessions = [];
        snapshot.forEach(doc => {
            allSessions.push({ id: doc.id, ...doc.data() });
        });
        renderSessionsList();
    }, (error) => {
        document.getElementById('sessions-list-container').innerHTML = `<p style="color:#c47a7a;">❌ Error: ${error.message}</p>`;
        console.error(error);
    });
}

function renderSessionsList() {
    const container = document.getElementById('sessions-list-container');
    if (!container) return;

    if (allSessions.length === 0) {
        container.innerHTML = `
            <div style="background:white;border-radius:20px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <p style="color:#5a7c6e;font-size:18px;">📋 No sessions yet.</p>
                <p style="color:#5a7c6e;">Click "New Session" to create your first activity.</p>
            </div>
        `;
        return;
    }

    const sorted = [...allSessions].sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        if (a.time > b.time) return -1;
        if (a.time < b.time) return 1;
        return 0;
    });

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
            ${sorted.map(session => {
                const scoutCount = allScouts.length;
                let attended = 0;
                if (session.attendance) {
                    for (const key in session.attendance) {
                        if (session.attendance[key] === true) attended++;
                    }
                }
                const percent = scoutCount > 0 ? Math.round((attended / scoutCount) * 100) : 0;

                return `
                    <div class="scout-card" style="cursor:pointer;" data-id="${session.id}">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                            <div>
                                <div style="font-weight:600;font-size:18px;color:#2d5a4a;">${session.name}</div>
                                <div style="color:#5a7c6e;font-size:14px;">
                                    📅 ${session.date} · ${session.time} · 📍 ${session.location || 'TBD'}
                                </div>
                                <div style="color:#5a7c6e;font-size:14px;margin-top:4px;">
                                    👥 ${attended}/${scoutCount} scouts attended (${percent}%)
                                </div>
                            </div>
                            <div style="font-size:14px;color:#5a7c6e;text-align:right;">
                                ${session.purpose ? `<div style="max-width:200px;font-style:italic;">${session.purpose.substring(0,60)}${session.purpose.length > 60 ? '...' : ''}</div>` : ''}
                                <div style="font-size:12px;color:#b0c4b8;">Created by ${session.createdBy || 'unknown'}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    document.querySelectorAll('.scout-card[data-id]').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = `session-detail.html?id=${card.dataset.id}`;
        });
    });
}

// ─── Scout Detail ─────────────────────────────────────────
function renderScoutDetail(container, scoutId) {
    const scout = allScouts.find(s => s.id === scoutId);
    if (!scout) { currentView = 'dashboard'; navigateTo('dashboard'); return; }

    const status = allStatus[scoutId] || {};
    const done = membershipReqs.filter(r => status[`membership_${r}`] && status[`membership_${r}`].status === 'approved').length;
    const progress = membershipReqs.length > 0 ? done / membershipReqs.length : 0;

    container.innerHTML = `
        <div class="detail-header">
            <span class="detail-back" id="detail-back">← Back</span>
            <div class="detail-avatar" style="background:${getColor(scout.username)}">${scout.username.charAt(0).toUpperCase()}</div>
            <div class="detail-name">
                <h2>${scout.username}</h2>
                <p>Membership Badge · ${done}/${membershipReqs.length} completed</p>
            </div>
        </div>
        <div class="detail-progress">
            <div class="progress-label"><span>Progress</span><span>${Math.round(progress * 100)}%</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress * 100}%"></div></div>
        </div>
        <div class="detail-notes">
            <label><strong>📝 Private Note</strong> <span style="color:#5a7c6e;font-weight:400;">(only you can see this)</span></label>
            <textarea id="note-textarea">${status.leaderNote || ''}</textarea>
            <button id="save-note-btn">💾 Save Note</button>
        </div>
        <div class="detail-requirements">
            <h3 style="margin-bottom:12px;color:#2d5a4a;">Requirements</h3>
            ${membershipReqs.map(req => {
                const data = status[`membership_${req}`];
                const stat = data ? data.status : 'todo';
                const icon = stat === 'approved' ? '✅' : stat === 'pending' ? '✋' : '⭕';
                const label = stat === 'approved' ? 'Completed' : stat === 'pending' ? 'Pending' : 'Not started';
                const meta = stat === 'approved' ? `Approved by ${data.approvedBy || 'leader'} · ${data.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : 'recently'}` : '';
                return `<div class="req-item"><span>${icon} ${req}</span><span class="req-status ${stat}">${label} ${meta ? `<span class="req-meta">— ${meta}</span>` : ''}</span></div>`;
            }).join('')}
        </div>
    `;

    document.getElementById('detail-back').addEventListener('click', () => {
        currentView = 'dashboard';
        navigateTo('dashboard');
    });

    document.getElementById('save-note-btn').addEventListener('click', async () => {
        const note = document.getElementById('note-textarea').value;
        const ref = doc(db, 'scoutStatus', scoutId);
        const current = (await getDoc(ref)).data() || {};
        current.leaderNote = note;
        await setDoc(ref, current);
        alert('✅ Note saved!');
    });
}

// ─── Export ────────────────────────────────────────────────
function renderExport(container) {
    container.innerHTML = `
        <div style="background:white;border-radius:20px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <h2 style="color:#2d5a4a;margin-bottom:8px;">📤 Export Reports</h2>
            <p style="color:#5a7c6e;margin-bottom:20px;">Download scout progress as a CSV file for reports, parents, or school records.</p>
            <button class="export-btn" id="export-all-btn">📥 Export All Scouts</button>
            <button class="export-btn" style="margin-left:12px;" id="export-pending-btn">📥 Export Pending Only</button>
            <div id="export-status" style="margin-top:16px;color:#5a7c6e;"></div>
        </div>
    `;

    document.getElementById('export-all-btn').addEventListener('click', () => exportCSV('all'));
    document.getElementById('export-pending-btn').addEventListener('click', () => exportCSV('pending'));
}

function exportCSV(type) {
    const rows = [['Scout', 'Requirement', 'Status', 'Approved By', 'Approved At']];
    for (const scout of allScouts) {
        const status = allStatus[scout.id] || {};
        for (const req of membershipReqs) {
            const key = `membership_${req}`;
            const data = status[key];
            if (type === 'pending' && (!data || data.status !== 'pending')) continue;
            const stat = data ? data.status : 'todo';
            const by = data?.approvedBy || '';
            const at = data?.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : '';
            rows.push([scout.username, req, stat, by, at]);
        }
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scout-progress-${type}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('export-status').textContent = `✅ ${type === 'all' ? 'All' : 'Pending'} report downloaded!`;
}

// ─── Helpers ────────────────────────────────────────────────
function getColor(name) {
    const colors = ['#7a9e8a', '#a8c4d4', '#d4a86a', '#8fbcbb', '#c47a7a', '#b0a8c4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function scoutCardHTML(scout) {
    const status = allStatus[scout.id] || {};
    let done = 0, pending = 0;
    for (const req of membershipReqs) {
        const key = `membership_${req}`;
        const value = status[key];
        if (value === 'pending' || (value && value.status === 'pending')) pending++;
        else if (value && value.status === 'approved') done++;
    }
    const total = membershipReqs.length;
    const progress = total > 0 ? done / total : 0;
    const hasNote = !!status.leaderNote;
    const color = getColor(scout.username);
    return `
        <div class="scout-card" data-id="${scout.id}" data-name="${scout.username.toLowerCase()}" data-progress="${progress}">
            <div class="scout-top">
                <div class="scout-avatar" style="background:${color}">${scout.username.charAt(0).toUpperCase()}</div>
                <span class="scout-name">${scout.username}</span>
            </div>
            <div class="scout-progress-text">${done}/${total} done</div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress * 100}%"></div></div>
            <div class="scout-status">
                <span class="done">🟢 ${done} done</span>
                ${pending > 0 ? `<span class="pending">✋ ${pending} pending</span>` : ''}
                <span class="missing">⚠️ ${total - done - pending} missing</span>
            </div>
            ${hasNote ? '<div class="scout-note-indicator">📝 Has private note</div>' : ''}
        </div>
    `;
}

async function approveRequirement(scoutId, reqName) {
    const ref = doc(db, 'scoutStatus', scoutId);
    const current = (await getDoc(ref)).data() || {};
    current[`membership_${reqName}`] = {
        status: 'approved',
        approvedBy: currentUser.username,
        approvedAt: new Date().toISOString()
    };
    await setDoc(ref, current);
}

// ─── Init ──────────────────────────────────────────────────
async function init() {
    // Set initial view from URL hash
    const initialView = getViewFromHash();
    currentView = initialView;
    
    // Update active link
    document.querySelectorAll('.sidebar-nav a').forEach(l => {
        l.classList.toggle('active', l.dataset.view === initialView);
    });
    
    await loadScouts();
    listenToStatus();
    renderView();
}

init();
