import { auth, db } from './firebase-config.js';
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── State ──────────────────────────────────────────────
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'scout') {
    window.location.href = 'index.html';
}

// ─── DOM refs ────────────────────────────────────────────
const pageContent = document.getElementById('page-content');
const scoutNameEl = document.getElementById('scout-name');
const sidebarName = document.getElementById('sidebar-name');
const headerAvatar = document.getElementById('header-avatar');
const sidebarAvatar = document.getElementById('sidebar-avatar');

// ─── Set user info ──────────────────────────────────────
const displayName = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
if (scoutNameEl) scoutNameEl.textContent = displayName;
if (sidebarName) sidebarName.textContent = displayName;
if (headerAvatar) headerAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
if (sidebarAvatar) sidebarAvatar.textContent = currentUser.username.charAt(0).toUpperCase();

// ─── IMPORTANT: Use email as document ID ──────────────
const userEmail = `${currentUser.username}@gis-scout.local`;

// ─── Requirements Data ──────────────────────────────────
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

// ─── State ──────────────────────────────────────────────
let currentView = 'dashboard';
let scoutStatus = {};
let allSessions = [];

// ─── Load status ─────────────────────────────────────────
async function loadStatus() {
    const docRef = doc(db, 'scoutStatus', userEmail);
    const docSnap = await getDoc(docRef);
    scoutStatus = docSnap.exists() ? docSnap.data() : {};
}

// ─── Save status ─────────────────────────────────────────
async function saveStatus() {
    await setDoc(doc(db, 'scoutStatus', userEmail), scoutStatus);
}

// ─── Load sessions ───────────────────────────────────────
async function loadSessions() {
    const snapshot = await getDocs(collection(db, 'sessions'));
    allSessions = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.attendance && data.attendance[userEmail] === true) {
            allSessions.push({ id: doc.id, ...data });
        }
    });
}

// ─── Render Views ────────────────────────────────────────
function renderView() {
    if (!pageContent) return;
    pageContent.innerHTML = '';
    if (currentView === 'dashboard') renderDashboard();
    else if (currentView === 'membership') renderRequirements('membership', membershipReqs);
    else if (currentView === 'second') renderPlaceholder('Second Class');
    else if (currentView === 'first') renderPlaceholder('First Class');
    else if (currentView === 'badges') renderPlaceholder('Badges');
    else if (currentView === 'sessions') renderSessions();
}

// ─── Dashboard (placeholder ❤️) ─────────────────────────
function renderDashboard() {
    pageContent.innerHTML = `
        <div class="placeholder-heart">
            ❤️
        </div>
    `;
}

// ─── Requirements View ──────────────────────────────────
function renderRequirements(tab, reqs) {
    let completed = 0, pending = 0;
    for (const req of reqs) {
        const key = `${tab}_${req}`;
        const status = scoutStatus[key];
        if (status && status.status === 'approved') completed++;
        else if (status && status.status === 'pending') pending++;
    }
    const total = reqs.length;
    const progress = Math.round((completed / total) * 100);

    let html = `
        <h2 style="color:var(--purple-dark);margin-bottom:16px;">${tab.charAt(0).toUpperCase() + tab.slice(1)} Badge</h2>
        <div class="progress-section" style="margin-bottom:20px;">
            <div class="progress-header"><span>Progress</span><span>${completed}/${total}</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress}%;"></div></div>
        </div>
        <div class="requirements-grid">
            ${reqs.map(req => {
                const key = `${tab}_${req}`;
                const data = scoutStatus[key];
                const status = data ? data.status : 'todo';
                const icon = status === 'approved' ? '🏁' : status === 'pending' ? '✋' : '🚩';
                let actionHtml = '';
                if (status === 'approved') {
                    actionHtml = `<span class="approved-badge">✓ Completed</span>`;
                } else if (status === 'pending') {
                    actionHtml = `<span class="pending-badge" data-req="${req}" data-tab="${tab}">⏳ Undo</span>`;
                } else {
                    actionHtml = `<button class="ready-btn" data-req="${req}" data-tab="${tab}">Mark Ready</button>`;
                }
                return `
                    <div class="req-card">
                        <div class="req-header">
                            <span class="req-title">${req}</span>
                            <span class="req-status-icon">${icon}</span>
                        </div>
                        <div class="req-actions">
                            <a href="requirement-detail.html?name=${encodeURIComponent(req)}&tab=${tab}" class="notes-link">📖 Notes</a>
                            ${actionHtml}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    pageContent.innerHTML = html;

    document.querySelectorAll('.ready-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const reqName = this.dataset.req;
            const tabName = this.dataset.tab;
            const key = `${tabName}_${reqName}`;
            if (scoutStatus[key] && scoutStatus[key].status === 'approved') return;
            scoutStatus[key] = { status: 'pending' };
            await saveStatus();
            renderView();
        });
    });

    document.querySelectorAll('.pending-badge').forEach(badge => {
        badge.addEventListener('click', async function() {
            const reqName = this.dataset.req;
            const tabName = this.dataset.tab;
            const key = `${tabName}_${reqName}`;
            delete scoutStatus[key];
            await saveStatus();
            renderView();
        });
    });
}

// ─── Sessions View ──────────────────────────────────────
function renderSessions() {
    if (allSessions.length === 0) {
        pageContent.innerHTML = `<p style="color:var(--text-muted);padding:40px;text-align:center;">You haven't attended any sessions yet.</p>`;
        return;
    }
    let html = `<h2 style="color:var(--purple-dark);margin-bottom:16px;">📋 My Sessions</h2><div style="display:flex;flex-direction:column;gap:12px;">`;
    for (const session of allSessions) {
        html += `
            <div style="background:white;border-radius:20px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-weight:600;font-size:18px;color:var(--text-dark);">${session.name}</div>
                <div style="color:var(--text-muted);font-size:14px;">${session.date} · ${session.time} · ${session.location || 'TBD'}</div>
                <div style="margin-top:8px;"><span class="approved-badge">✅ Attended</span></div>
            </div>
        `;
    }
    html += '</div>';
    pageContent.innerHTML = html;
}

// ─── Placeholder ─────────────────────────────────────────
function renderPlaceholder(title) {
    pageContent.innerHTML = `
        <h2 style="color:var(--purple-dark);margin-bottom:16px;">${title}</h2>
        <p style="color:var(--text-muted);padding:40px;text-align:center;">Coming soon! Check back later.</p>
    `;
}

// ─── Navigation ──────────────────────────────────────────
document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        currentView = this.dataset.view;
        renderView();
    });
});

// ─── Logout ──────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

// ─── Init ────────────────────────────────────────────────
async function init() {
    await loadStatus();
    await loadSessions();
    renderView();
}

init();
