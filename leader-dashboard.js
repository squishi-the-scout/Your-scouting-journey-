import { auth, db } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, getDocs, query, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { membershipRequirements } from './data/membership-requirements.js';
import { secondClassRequirements } from './data/secondclass-requirements.js';
import { firstClassRequirements } from './data/firstclass-requirements.js';

// ─── State ──────────────────────────────────────────────
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'leader') {
    window.location.href = 'index.html';
}

const pageContent = document.getElementById('page-content');
const sidebarName = document.getElementById('sidebar-name');
const displayName = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
if (sidebarName) sidebarName.textContent = displayName;

let allScouts = [];
let allStatus = {};
let allSessions = [];
let currentView = 'dashboard';
let selectedScout = null;

// ─── Badge Colors ──────────────────────────────────────
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

function getBadgesForRank(rank) {
    const badges = [];
    if (rank === 'Membership' || rank === 'Second Class' || rank === 'First Class') {
        badges.push({ key: 'membership', reqs: membershipRequirements, label: 'Membership' });
    }
    if (rank === 'Second Class' || rank === 'First Class') {
        badges.push({ key: 'secondClass', reqs: secondClassRequirements, label: 'Second Class' });
    }
    if (rank === 'First Class') {
        badges.push({ key: 'firstClass', reqs: firstClassRequirements, label: 'First Class' });
        badges.push({ key: 'badge', reqs: [], label: 'Badges' });
    }
    return badges;
}

// ─── Load Data ──────────────────────────────────────────
async function loadData() {
    const usersSnap = await getDocs(collection(db, 'users'));
    allScouts = [];
    usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.role === 'scout') {
            allScouts.push({ email: doc.id, ...data });
        }
    });

    const statusSnap = await getDocs(collection(db, 'scoutStatus'));
    allStatus = {};
    statusSnap.forEach(doc => {
        allStatus[doc.id] = doc.data();
    });

    const sessionsSnap = await getDocs(collection(db, 'sessions'));
    allSessions = [];
    sessionsSnap.forEach(doc => {
        allSessions.push({ id: doc.id, ...doc.data() });
    });
}

// ─── Render Views ──────────────────────────────────────
function renderView() {
    if (!pageContent) return;
    pageContent.innerHTML = '';
    
    if (selectedScout) {
        renderScoutProfile(selectedScout);
        return;
    }
    
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
            const membershipKey = `membership_${req.name}`;
            const secondKey = `secondClass_${req.name}`;
            const firstKey = `firstClass_${req.name}`;
            if (status[membershipKey]?.status === 'approved') completed++;
            if (status[secondKey]?.status === 'approved') completed++;
            if (status[firstKey]?.status === 'approved') completed++;
        }
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
            selectedScout = null;
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
        const role = scout.scoutRole || 'Scout';

        // Get badges based on rank
        const badges = getBadgesForRank(rank);
        let totalDone = 0;
        let totalReqs = 0;

        let progressHtml = '';
        for (const badge of badges) {
            let done = 0;
            for (const req of badge.reqs) {
                const key = `${badge.key}_${req.name}`;
                if (status[key]?.status === 'approved') done++;
            }
            totalDone += done;
            totalReqs += badge.reqs.length;
            const pct = badge.reqs.length > 0 ? Math.round((done / badge.reqs.length) * 100) : 0;
            progressHtml += `
                <div style="margin-bottom:6px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);">
                        <span>${badge.label}</span>
                        <span>${done}/${badge.reqs.length}</span>
                    </div>
                    <div style="background:#e8e0f0;border-radius:20px;height:4px;overflow:hidden;">
                        <div style="background:#7bcb7b;height:100%;width:${pct}%;border-radius:20px;"></div>
                    </div>
                </div>
            `;
        }

        const overall = totalReqs > 0 ? Math.round((totalDone / totalReqs) * 100) : 0;

        html += `
            <div class="scout-card" data-email="${scout.email}" style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-weight:600;font-size:18px;color:var(--text-dark);">${name}</div>
                    <span style="font-size:12px;background:#e8e0f0;padding:2px 10px;border-radius:12px;color:var(--text-muted);">${role}</span>
                </div>
                <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">${patrol} · ${rank}</div>
                ${progressHtml}
                <div style="margin-top:8px;font-size:12px;color:var(--text-muted);text-align:right;">${overall}% overall</div>
            </div>
        `;
    }

    html += '</div>';
    pageContent.innerHTML = html;

    document.querySelectorAll('.scout-card').forEach(card => {
        card.addEventListener('click', function() {
            selectedScout = this.dataset.email;
            renderView();
        });
    });
}

// ─── Scout Profile ──────────────────────────────────────
async function renderScoutProfile(email) {
    const scout = allScouts.find(s => s.email === email);
    if (!scout) {
        pageContent.innerHTML = `<p>Scout not found.</p>`;
        return;
    }

    const status = allStatus[email] || {};
    const rank = scout.rank || 'Membership';
    const badges = getBadgesForRank(rank);
    const role = scout.scoutRole || 'Scout';

    // Get attended sessions
    const attendedSessions = allSessions.filter(s => s.attendance && s.attendance[email] === true);
    const totalHours = attendedSessions.reduce((sum, s) => sum + (s.serviceHours || 0), 0);

    let html = `
        <div style="margin-bottom:24px;">
            <button id="back-to-scouts" style="background:none;border:none;color:var(--purple);font-size:16px;cursor:pointer;display:flex;align-items:center;gap:8px;">← Back to All Scouts</button>
        </div>

        <!-- Personal Info -->
        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="color:var(--purple-dark);margin:0;">${scout.fullName || scout.username}</h2>
                    <div style="color:var(--text-muted);margin-top:4px;">${scout.patrol || 'No patrol'} · ${rank}</div>
                    <div style="color:var(--text-muted);font-size:14px;margin-top:4px;">Role: ${role}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:14px;color:var(--text-muted);">DOB: ${scout.dob || 'Not set'}</div>
                    <div style="font-size:14px;color:var(--text-muted);">Joined: ${scout.joinDate || 'Not set'}</div>
                </div>
            </div>
            ${scout.emergencyContact ? `
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e8e0f0;">
                    <div style="font-weight:600;font-size:14px;">📞 Emergency Contact</div>
                    <div style="font-size:14px;color:var(--text-muted);">
                        ${scout.emergencyContact.name || 'N/A'} · 
                        ${scout.emergencyContact.phone || 'N/A'} · 
                        ${scout.emergencyContact.relation || 'N/A'}
                    </div>
                </div>
            ` : ''}
        </div>

        <!-- Leadership Roles -->
        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">⭐ Leadership Roles</h3>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${['Scout', 'Patrol Leader', 'Assistant Patrol Leader', 'Senior Patrol Leader', 'Quartermaster', 'Scribe', 'Treasurer'].map(r => `
                    <button class="role-btn" data-email="${email}" data-role="${r}" style="padding:6px 16px;border-radius:20px;border:2px solid ${role === r ? 'var(--purple)' : '#e0d6ec'};background:${role === r ? 'var(--purple)' : 'white'};color:${role === r ? 'white' : 'var(--text-dark)'};cursor:pointer;font-size:13px;transition:all 0.2s;">${r}</button>
                `).join('')}
            </div>
            <div id="role-message" style="margin-top:8px;font-size:13px;color:var(--text-muted);"></div>
        </div>

        <!-- Badge Progress -->
        <div style="margin-bottom:20px;">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">🏅 Badge Progress</h3>
    `;

    for (const badge of badges) {
        const color = badgeColors[badge.key];
        let done = 0;
        let reqHtml = '';
        for (const req of badge.reqs) {
            const key = `${badge.key}_${req.name}`;
            const data = status[key];
            const statusText = data ? data.status : 'todo';
            const statusIcons = {
                'approved': '✅',
                'pending': '⏳',
                'ready': '📝',
                'todo': '🚩'
            };
            const icon = statusIcons[statusText] || '🚩';
            
            reqHtml += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f5f0f8;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span>${icon}</span>
                        <span style="font-size:14px;">${req.name}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:12px;color:var(--text-muted);">${statusText}</span>
                        <button class="approve-req-btn" data-email="${email}" data-field="${key}" style="background:${color.border};color:white;border:none;padding:2px 12px;border-radius:12px;font-size:11px;cursor:pointer;">Approve</button>
                    </div>
                </div>
            `;
            if (statusText === 'approved') done++;
        }

        const pct = badge.reqs.length > 0 ? Math.round((done / badge.reqs.length) * 100) : 0;

        html += `
            <div style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span style="font-weight:600;color:${color.text};">${color.label}</span>
                    <span style="font-size:14px;color:var(--text-muted);">${done}/${badge.reqs.length}</span>
                </div>
                <div style="background:#e8e0f0;border-radius:20px;height:6px;overflow:hidden;margin-bottom:12px;">
                    <div style="background:${color.border};height:100%;width:${pct}%;border-radius:20px;"></div>
                </div>
                ${reqHtml}
            </div>
        `;
    }

    html += `
        </div>

        <!-- Attendance & Sessions -->
        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">📋 Attendance & Sessions</h3>
            <div style="display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap;">
                <div><span style="font-weight:600;">${attendedSessions.length}</span> sessions attended</div>
                <div><span style="font-weight:600;">${totalHours}</span> total service hours</div>
            </div>
            ${attendedSessions.length === 0 ? '<p style="color:var(--text-muted);">No sessions attended yet.</p>' : ''}
            ${attendedSessions.map(s => `
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f5f0f8;font-size:14px;">
                    <span>${s.name}</span>
                    <span style="color:var(--text-muted);">${s.date} · ${s.serviceHours || 0}h</span>
                </div>
            `).join('')}
        </div>
    `;

    pageContent.innerHTML = html;

    // ─── Back button ──────────────────────────────────────
    document.getElementById('back-to-scouts').addEventListener('click', () => {
        selectedScout = null;
        renderView();
    });

    // ─── Role buttons ─────────────────────────────────────
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const scoutEmail = this.dataset.email;
            const newRole = this.dataset.role;
            try {
                await setDoc(doc(db, 'users', scoutEmail), { scoutRole: newRole }, { merge: true });
                document.getElementById('role-message').textContent = `✅ Role updated to: ${newRole}`;
                document.getElementById('role-message').style.color = '#4caf50';
                // Update local data
                const scout = allScouts.find(s => s.email === scoutEmail);
                if (scout) scout.scoutRole = newRole;
                setTimeout(() => renderScoutProfile(scoutEmail), 1000);
            } catch (error) {
                document.getElementById('role-message').textContent = `❌ Error: ${error.message}`;
                document.getElementById('role-message').style.color = '#e74c3c';
            }
        });
    });

    // ─── Approve requirement buttons ─────────────────────
    document.querySelectorAll('.approve-req-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const scoutEmail = this.dataset.email;
            const field = this.dataset.field;
            try {
                const docRef = doc(db, 'scoutStatus', scoutEmail);
                const docSnap = await getDoc(docRef);
                const data = docSnap.data() || {};
                data[field] = { 
                    status: 'approved', 
                    approvedBy: currentUser.username,
                    approvedAt: new Date().toISOString()
                };
                await setDoc(docRef, data);
                // Update local cache
                if (!allStatus[scoutEmail]) allStatus[scoutEmail] = {};
                allStatus[scoutEmail][field] = { status: 'approved', approvedBy: currentUser.username, approvedAt: new Date().toISOString() };
                renderScoutProfile(scoutEmail);
            } catch (error) {
                alert('Error approving: ' + error.message);
            }
        });
    });
}

// ─── Pending Approvals ──────────────────────────────────
function renderPendingApprovals() {
    let pendingItems = [];

    for (const scout of allScouts) {
        const status = allStatus[scout.email] || {};
        for (const key in status) {
            if (status[key].status === 'pending') {
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
            allStatus = {};
            const statusSnap = await getDocs(collection(db, 'scoutStatus'));
            statusSnap.forEach(doc => {
                allStatus[doc.id] = doc.data();
            });
            renderPendingApprovals();
        });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const email = this.dataset.email;
            const field = this.dataset.field;
            const docRef = doc(db, 'scoutStatus', email);
            const docSnap = await getDoc(docRef);
            const data = docSnap.data() || {};
            data[field] = { status: 'todo' };
            await setDoc(docRef, data);
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
        selectedScout = null;
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
