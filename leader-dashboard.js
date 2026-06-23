import { auth, db } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, getDocs, onSnapshot, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { membershipRequirements } from './data/membership-requirements.js';
import { secondClassRequirements } from './data/secondclass-requirements.js';
import { firstClassRequirements } from './data/firstclass-requirements.js';

// ─── State ──────────────────────────────────────────────
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'leader') {
    window.location.href = 'index.html';
}

// ─── DOM refs ────────────────────────────────────────────
const pageContent = document.getElementById('page-content');
const sidebarName = document.getElementById('sidebar-name');

const displayName = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
if (sidebarName) sidebarName.textContent = displayName;

let allScouts = [];
let allStatus = {};
let allUsers = {};
let currentView = 'dashboard';

// ─── Badge color mapping ──────────────────────────────
const badgeColors = {
    membership: { bg: '#d4edda', text: '#155724', border: '#7bcb7b', label: 'Membership' },
    secondClass: { bg: '#c3e6cb', text: '#0b5e1f', border: '#4caf50', label: 'Second Class' },
    firstClass: { bg: '#a8d5a2', text: '#1b5e20', border: '#2e7d32', label: 'First Class' },
    badge: { bg: '#b2dfdb', text: '#004d40', border: '#00897b', label: 'Badge' }
};

function getBadgeInfo(fieldName) {
    if (fieldName.startsWith('membership_')) return badgeColors.membership;
    if (fieldName.startsWith('secondClass_')) return badgeColors.secondClass;
    if (fieldName.startsWith('firstClass_')) return badgeColors.firstClass;
    if (fieldName.startsWith('badge_')) return badgeColors.badge;
    return badgeColors.membership;
}

function getBadgeLabel(fieldName) {
    if (fieldName.startsWith('membership_')) return 'Membership';
    if (fieldName.startsWith('secondClass_')) return 'Second Class';
    if (fieldName.startsWith('firstClass_')) return 'First Class';
    if (fieldName.startsWith('badge_')) return 'Badge';
    return 'Membership';
}

function getBadgeIcon(fieldName) {
    if (fieldName.startsWith('membership_')) return '🏅';
    if (fieldName.startsWith('secondClass_')) return '⭐';
    if (fieldName.startsWith('firstClass_')) return '🌟';
    if (fieldName.startsWith('badge_')) return '🏆';
    return '📋';
}

// ─── Load data ──────────────────────────────────────────
async function loadData() {
    // Load all users
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.role === 'scout') {
            allUsers[doc.id] = data;
            allScouts.push({ email: doc.id, ...data });
        }
    });

    // Load all scout status
    const statusSnap = await getDocs(collection(db, 'scoutStatus'));
    statusSnap.forEach(doc => {
        allStatus[doc.id] = doc.data();
    });
}

// ─── Render Views ──────────────────────────────────────
function renderView() {
    if (!pageContent) return;
    pageContent.innerHTML = '';
    if (currentView === 'dashboard') renderDashboard();
    else if (currentView === 'scouts') renderAllScouts();
    else if (currentView === 'pending') renderPendingApprovals();
    else if (currentView === 'sessions') renderSessions();
    else if (currentView === 'export') renderExport();
}

// ─── Dashboard ──────────────────────────────────────────
function renderDashboard() {
    let totalScouts = allScouts.length;
    let totalPending = 0;
    let completedScouts = 0;

    for (const scout of allScouts) {
        const status = allStatus[scout.email] || {};
        let completed = 0;
        const allReqs = [...membershipRequirements, ...secondClassRequirements, ...firstClassRequirements];
        for (const req of allReqs) {
            const key = `${req.field || req.name}`;
            // Check all possible field formats
            const membershipKey = `membership_${req.name}`;
            const secondKey = `secondClass_${req.name}`;
            const firstKey = `firstClass_${req.name}`;
            if (status[membershipKey]?.status === 'approved') completed++;
            if (status[secondKey]?.status === 'approved') completed++;
            if (status[firstKey]?.status === 'approved') completed++;
        }
        // Count pending
        for (const key in status) {
            if (status[key].status === 'pending') totalPending++;
        }
        if (completed >= 42) completedScouts++;
    }

    let html = `
        <h2 style="color:var(--purple-dark);margin-bottom:24px;">📊 Leader Dashboard</h2>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;">
            <div style="background:white;border-radius:20px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);text-align:center;">
                <div style="font-size:32px;font-weight:700;color:var(--purple);">${totalScouts}</div>
                <div style="font-size:14px;color:var(--text-muted);">Total Scouts</div>
            </div>
            <div style="background:white;border-radius:20px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);text-align:center;">
                <div style="font-size:32px;font-weight:700;color:var(--orange);">${totalPending}</div>
                <div style="font-size:14px;color:var(--text-muted);">Pending Approvals</div>
            </div>
            <div style="background:white;border-radius:20px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);text-align:center;">
                <div style="font-size:32px;font-weight:700;color:#4caf50;">${completedScouts}</div>
                <div style="font-size:14px;color:var(--text-muted);">Completed All Badges</div>
            </div>
            <div style="background:white;border-radius:20px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);text-align:center;">
                <div style="font-size:32px;font-weight:700;color:#8fbcbb;">${allScouts.length}</div>
                <div style="font-size:14px;color:var(--text-muted);">Active Scouts</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <h3 style="color:var(--text-dark);margin-bottom:16px;">🟢 Badge Legend</h3>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:#7bcb7b;"></span>
                        <span>Membership</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:#4caf50;"></span>
                        <span>Second Class</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:#2e7d32;"></span>
                        <span>First Class</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:#00897b;"></span>
                        <span>Badges</span>
                    </div>
                </div>
            </div>
            <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <h3 style="color:var(--text-dark);margin-bottom:16px;">📋 Quick Actions</h3>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <a href="#" data-view="pending" style="background:var(--orange);color:white;padding:12px 20px;border-radius:12px;text-align:center;text-decoration:none;font-weight:500;">View Pending Approvals</a>
                    <a href="#" data-view="scouts" style="background:var(--purple);color:white;padding:12px 20px;border-radius:12px;text-align:center;text-decoration:none;font-weight:500;">View All Scouts</a>
                </div>
            </div>
        </div>
    `;

    pageContent.innerHTML = html;

    document.querySelectorAll('a[data-view]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            currentView = this.dataset.view;
            renderView();
        });
    });
}

// ─── All Scouts ──────────────────────────────────────────
function renderAllScouts() {
    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
            <h2 style="color:var(--purple-dark);">👥 All Scouts</h2>
            <span style="color:var(--text-muted);font-size:14px;">${allScouts.length} scouts</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    `;

    for (const scout of allScouts) {
        const status = allStatus[scout.email] || {};
        const name = scout.fullName || scout.username;
        const patrol = scout.patrol || 'No patrol';
        const rank = scout.rank || 'Membership';

        // Count progress for each badge
        let membershipDone = 0, secondDone = 0, firstDone = 0;
        for (const req of membershipRequirements) {
            const key = `membership_${req.name}`;
            if (status[key]?.status === 'approved') membershipDone++;
        }
        for (const req of secondClassRequirements) {
            const key = `secondClass_${req.name}`;
            if (status[key]?.status === 'approved') secondDone++;
        }
        for (const req of firstClassRequirements) {
            const key = `firstClass_${req.name}`;
            if (status[key]?.status === 'approved') firstDone++;
        }

        const totalMembership = membershipRequirements.length;
        const totalSecond = secondClassRequirements.length;
        const totalFirst = firstClassRequirements.length;
        const overall = Math.round(((membershipDone + secondDone + firstDone) / (totalMembership + totalSecond + totalFirst)) * 100);

        html += `
            <div style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-weight:600;font-size:18px;color:var(--text-dark);">${name}</div>
                    <span style="font-size:13px;color:var(--text-muted);">${patrol}</span>
                </div>
                <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">${rank}</div>
                
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
                    <div style="background:#f5f0f8;border-radius:8px;padding:8px;text-align:center;">
                        <div style="font-size:12px;color:var(--text-muted);">Membership</div>
                        <div style="font-weight:600;color:#7bcb7b;">${membershipDone}/${totalMembership}</div>
                    </div>
                    <div style="background:#f5f0f8;border-radius:8px;padding:8px;text-align:center;">
                        <div style="font-size:12px;color:var(--text-muted);">Second</div>
                        <div style="font-weight:600;color:#4caf50;">${secondDone}/${totalSecond}</div>
                    </div>
                    <div style="background:#f5f0f8;border-radius:8px;padding:8px;text-align:center;">
                        <div style="font-size:12px;color:var(--text-muted);">First</div>
                        <div style="font-weight:600;color:#2e7d32;">${firstDone}/${totalFirst}</div>
                    </div>
                </div>

                <div style="background:#e8e0f0;border-radius:20px;height:6px;overflow:hidden;">
                    <div style="background:linear-gradient(90deg,#7bcb7b,#2e7d32);height:100%;width:${overall}%;border-radius:20px;"></div>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;text-align:right;">${overall}% overall</div>
            </div>
        `;
    }

    html += '</div>';
    pageContent.innerHTML = html;
}

// ─── Pending Approvals ──────────────────────────────────
function renderPendingApprovals() {
    let pendingItems = [];

    for (const scout of allScouts) {
        const status = allStatus[scout.email] || {};
        for (const key in status) {
            if (status[key].status === 'pending') {
                // Extract requirement name from field
                let reqName = key;
                let badgeType = 'membership';
                if (key.startsWith('membership_')) {
                    reqName = key.replace('membership_', '');
                    badgeType = 'membership';
                } else if (key.startsWith('secondClass_')) {
                    reqName = key.replace('secondClass_', '');
                    badgeType = 'secondClass';
                } else if (key.startsWith('firstClass_')) {
                    reqName = key.replace('firstClass_', '');
                    badgeType = 'firstClass';
                } else if (key.startsWith('badge_')) {
                    reqName = key.replace('badge_', '');
                    badgeType = 'badge';
                }

                pendingItems.push({
                    scout: scout,
                    field: key,
                    reqName: reqName,
                    badgeType: badgeType,
                    status: status[key]
                });
            }
        }
    }

    // Sort by badge type
    const order = { membership: 0, secondClass: 1, firstClass: 2, badge: 3 };
    pendingItems.sort((a, b) => order[a.badgeType] - order[b.badgeType]);

    if (pendingItems.length === 0) {
        pageContent.innerHTML = `
            <h2 style="color:var(--purple-dark);margin-bottom:24px;">✅ Pending Approvals</h2>
            <div style="background:white;border-radius:24px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:48px;margin-bottom:16px;">🎉</div>
                <p style="color:var(--text-muted);font-size:18px;">No pending approvals! All caught up.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <h2 style="color:var(--purple-dark);">⏳ Pending Approvals</h2>
            <span style="color:var(--text-muted);font-size:14px;">${pendingItems.length} items</span>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#7bcb7b;color:white;font-size:12px;font-weight:500;">Membership</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#4caf50;color:white;font-size:12px;font-weight:500;">Second Class</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#2e7d32;color:white;font-size:12px;font-weight:500;">First Class</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#00897b;color:white;font-size:12px;font-weight:500;">Badges</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
    `;

    for (const item of pendingItems) {
        const color = getBadgeInfo(item.field);
        const label = getBadgeLabel(item.field);
        const name = item.scout.fullName || item.scout.username;

        html += `
            <div style="background:white;border-radius:16px;padding:16px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-left:4px solid ${color.border};">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:${color.border};"></span>
                    <span style="font-size:12px;font-weight:600;color:${color.text};background:${color.bg};padding:2px 10px;border-radius:8px;">${label}</span>
                    <span style="font-weight:500;">${item.reqName}</span>
                    <span style="color:var(--text-muted);font-size:14px;">— ${name}</span>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="approve-btn" data-email="${item.scout.email}" data-field="${item.field}" style="background:#4caf50;color:white;border:none;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;cursor:pointer;">Approve</button>
                    <button class="reject-btn" data-email="${item.scout.email}" data-field="${item.field}" style="background:#e74c3c;color:white;border:none;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;cursor:pointer;">Reject</button>
                </div>
            </div>
        `;
    }

    html += '</div>';
    pageContent.innerHTML = html;

    // ─── Approve ──────────────────────────────────────────
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const email = this.dataset.email;
            const field = this.dataset.field;
            const docRef = doc(db, 'scoutStatus', email);
            const docSnap = await getDoc(docRef);
            const data = docSnap.data() || {};
            data[field] = { 
                status: 'approved', 
                approvedBy: currentUser.username,
                approvedAt: new Date().toISOString()
            };
            await setDoc(docRef, data);
            // Reload and re-render
            allStatus = {};
            const statusSnap = await getDocs(collection(db, 'scoutStatus'));
            statusSnap.forEach(doc => {
                allStatus[doc.id] = doc.data();
            });
            renderPendingApprovals();
        });
    });

    // ─── Reject ───────────────────────────────────────────
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const email = this.dataset.email;
            const field = this.dataset.field;
            const docRef = doc(db, 'scoutStatus', email);
            const docSnap = await getDoc(docRef);
            const data = docSnap.data() || {};
            // Set back to todo (remove pending status)
            data[field] = { status: 'todo' };
            await setDoc(docRef, data);
            // Reload and re-render
            allStatus = {};
            const statusSnap = await getDocs(collection(db, 'scoutStatus'));
            statusSnap.forEach(doc => {
                allStatus[doc.id] = doc.data();
            });
            renderPendingApprovals();
        });
    });
}

// ─── Sessions ──────────────────────────────────────────
function renderSessions() {
    pageContent.innerHTML = `
        <h2 style="color:var(--purple-dark);margin-bottom:24px;">📋 Sessions</h2>
        <div style="background:white;border-radius:24px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="font-size:48px;margin-bottom:16px;">📅</div>
            <p style="color:var(--text-muted);font-size:16px;">Session management is in <a href="sessions.html" style="color:var(--purple);font-weight:500;">sessions.html</a></p>
        </div>
    `;
}

// ─── Export ────────────────────────────────────────────
function renderExport() {
    pageContent.innerHTML = `
        <h2 style="color:var(--purple-dark);margin-bottom:24px;">📤 Export Data</h2>
        <div style="background:white;border-radius:24px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="font-size:48px;margin-bottom:16px;">📊</div>
            <p style="color:var(--text-muted);font-size:16px;">Export feature coming soon.</p>
        </div>
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
    await loadData();
    renderView();
}

init();
