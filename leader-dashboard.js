import { auth, db } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, getDocs, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── HARDCODED REQUIREMENTS ──────────────────────────────
const membershipRequirements = [
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

const secondClassRequirements = [
    "Scouting History",
    "Pitch Strike and Store a Hike or Patrol Tent",
    "Knots and Lashing",
    "Wood Craft Signs",
    "Hand Axe, Froe and Kathi Valhi",
    "Cooking",
    "Fire Lighting",
    "Hike",
    "First Aid",
    "Rules of Health",
    "Swimming",
    "Observation Skills",
    "Common Trees, Birds and Fishes",
    "Compass and the Safety Regulations of a Sea Going Vessel",
    "Environmental Education",
    "Re-test Scout Standard"
];

const firstClassRequirements = [
    "Emergencies",
    "First Aid",
    "Common Trees, Birds and Fishes",
    "Felling Axes and Maldivian Tools Mulhoa, Odaa",
    "Mapping and Compass",
    "Estimation",
    "Knots, Lashing and Splices",
    "Tracking",
    "Swimming",
    "Cooking",
    "Camping",
    "Environmental Education",
    "Hike - Expedition",
    "Re-test Advance Scout Standard"
];

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
let usersUnsubscribe = null;
let statusUnsubscribe = null;
let sessionsUnsubscribe = null;

// ─── Badge Colors ──────────────────────────────────────
const badgeColors = {
    membership: { bg: '#d4edda', text: '#155724', border: '#7bcb7b', label: 'Membership' },
    secondClass: { bg: '#c3e6cb', text: '#0b5e1f', border: '#4caf50', label: 'Second Class' },
    firstClass: { bg: '#a8d5a2', text: '#1b5e20', border: '#2e7d32', label: 'First Class' },
    badge: { bg: '#b2dfdb', text: '#004d40', border: '#00897b', label: 'Badges' }
};

function getBadgeInfo(fieldName) {
    if (fieldName.startsWith('membership_')) return badgeColors.membership;
    if (fieldName.startsWith('secondClass_')) return badgeColors.secondClass;
    if (fieldName.startsWith('firstClass_')) return badgeColors.firstClass;
    return badgeColors.membership;
}

function getBadgeLabel(fieldName) {
    if (fieldName.startsWith('membership_')) return 'Membership';
    if (fieldName.startsWith('secondClass_')) return 'Second Class';
    if (fieldName.startsWith('firstClass_')) return 'First Class';
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

// ─── Check if scout is ready for promotion ──────────────
function isReadyForPromotion(email) {
    const status = allStatus[email] || {};
    const scout = allScouts.find(s => s.email === email);
    if (!scout) return null;
    
    const rank = scout.rank || 'Membership';
    
    if (rank === 'Membership') {
        let done = 0;
        for (const req of membershipRequirements) {
            const key = `membership_${req}`;
            if (status[key]?.status === 'approved') done++;
        }
        if (done === membershipRequirements.length) {
            return { currentRank: 'Membership', nextRank: 'Second Class' };
        }
    } else if (rank === 'Second Class') {
        let done = 0;
        for (const req of secondClassRequirements) {
            const key = `secondClass_${req}`;
            if (status[key]?.status === 'approved') done++;
        }
        if (done === secondClassRequirements.length) {
            return { currentRank: 'Second Class', nextRank: 'First Class' };
        }
    }
    return null;
}

// ─── Real-time Users Listener ──────────────────────────
function listenToUsers() {
    if (usersUnsubscribe) {
        usersUnsubscribe();
        usersUnsubscribe = null;
    }
    
    usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        allScouts = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.role === 'scout') {
                allScouts.push({ email: doc.id, ...data });
            }
        });
        if (!selectedScout) {
            renderView();
        } else {
            renderScoutProfile(selectedScout);
        }
    }, (error) => {
        console.error('Users listener error:', error);
    });
}

// ─── Real-time Status Listener ─────────────────────────
function listenToStatus() {
    if (statusUnsubscribe) {
        statusUnsubscribe();
        statusUnsubscribe = null;
    }
    
    statusUnsubscribe = onSnapshot(collection(db, 'scoutStatus'), (snapshot) => {
        allStatus = {};
        snapshot.forEach(doc => {
            allStatus[doc.id] = doc.data();
        });
        if (!selectedScout) {
            renderView();
        } else {
            renderScoutProfile(selectedScout);
        }
    }, (error) => {
        console.error('Status listener error:', error);
    });
}

// ─── Real-time Sessions Listener ──────────────────────
function listenToSessions() {
    if (sessionsUnsubscribe) {
        sessionsUnsubscribe();
        sessionsUnsubscribe = null;
    }
    
    sessionsUnsubscribe = onSnapshot(collection(db, 'sessions'), (snapshot) => {
        allSessions = [];
        snapshot.forEach(doc => {
            allSessions.push({ id: doc.id, ...doc.data() });
        });
        if (currentView === 'sessions' || currentView === 'dashboard') {
            renderView();
        }
    }, (error) => {
        console.error('Sessions listener error:', error);
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
    let readyForPromotion = [];

    for (const scout of allScouts) {
        const status = allStatus[scout.email] || {};
        for (const key in status) {
            if (status[key].status === 'pending') totalPending++;
        }
        const promo = isReadyForPromotion(scout.email);
        if (promo) readyForPromotion.push({ scout, promo });
    }

    let totalServiceHours = 0;
    for (const session of allSessions) {
        totalServiceHours += session.duration || 0;
    }

    let html = `
        <h2 style="color:var(--purple-dark);margin-bottom:24px;">📊 Leader Dashboard</h2>
        
        ${readyForPromotion.length > 0 ? `
            <div style="background:linear-gradient(135deg, #fdf8e7, #f0f7e6);border-radius:16px;padding:16px 20px;margin-bottom:24px;border-left:4px solid #b8860b;">
                <div style="font-weight:600;color:#6b8e23;">🌟 Scouts Ready for Promotion</div>
                ${readyForPromotion.map(p => `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:8px 12px;background:white;border-radius:8px;">
                        <span>${p.scout.fullName || p.scout.username} — ${p.promo.currentRank} → ${p.promo.nextRank}</span>
                        <a href="#" data-view="pending" style="background:linear-gradient(135deg,#b8860b,#6b8e23);color:white;border:none;padding:4px 16px;border-radius:20px;font-size:13px;text-decoration:none;cursor:pointer;">View in Pending</a>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div style="background:#d4edda;border-radius:16px;padding:12px 16px;margin-bottom:24px;border-left:4px solid #28a745;">
                <span style="color:#155724;">✅ No scouts ready for promotion right now.</span>
            </div>
        `}

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
                <div style="font-size:32px;font-weight:700;color:#8fbcbb;">${allSessions.length}</div>
                <div style="font-size:14px;color:var(--text-muted);">Total Sessions</div>
            </div>
            <div style="background:white;border-radius:20px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);text-align:center;">
                <div style="font-size:32px;font-weight:700;color:#4caf50;">${totalServiceHours}</div>
                <div style="font-size:14px;color:var(--text-muted);">Service Hours</div>
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
                        <span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:linear-gradient(135deg,#b8860b,#6b8e23);"></span>
                        <span>Ready for Promotion</span>
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

        const badges = getBadgesForRank(rank);
        let totalDone = 0;
        let totalReqs = 0;

        let progressHtml = '';
        for (const badge of badges) {
            let done = 0;
            for (const req of badge.reqs) {
                const key = `${badge.key}_${req}`;
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
        const promo = isReadyForPromotion(scout.email);

        html += `
            <div class="scout-card" data-email="${scout.email}" style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-weight:600;font-size:18px;color:var(--text-dark);">${name}</div>
                    <span style="font-size:12px;background:#e8e0f0;padding:2px 10px;border-radius:12px;color:var(--text-muted);">${role}</span>
                </div>
                <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">${patrol} · ${rank}</div>
                ${progressHtml}
                <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:12px;color:var(--text-muted);">${overall}% overall</span>
                    ${promo ? '<span style="font-size:11px;background:linear-gradient(135deg,#fdf8e7,#f0f7e6);padding:2px 10px;border-radius:12px;color:#6b8e23;border:1px solid #b8860b;">🌟 Ready for Promotion</span>' : ''}
                </div>
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
    const promo = isReadyForPromotion(email);

    const attendedSessions = allSessions.filter(s => s.attendance && s.attendance[email] === true);
    const totalHours = attendedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    let html = `
        <div style="margin-bottom:24px;">
            <button id="back-to-scouts" style="background:none;border:none;color:var(--purple);font-size:16px;cursor:pointer;display:flex;align-items:center;gap:8px;">← Back to All Scouts</button>
        </div>

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
                    <div style="font-size:14px;color:var(--text-muted);">⏱️ ${totalHours}h service</div>
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
            
            ${promo ? `
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e8e0f0;">
                    <div style="background:linear-gradient(135deg,#fdf8e7,#f0f7e6);border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border:1px solid #b8860b;">
                        <span style="color:#6b8e23;font-weight:500;">🌟 Ready for promotion: ${promo.currentRank} → ${promo.nextRank}</span>
                        <button class="promote-btn" data-email="${email}" style="background:linear-gradient(135deg,#b8860b,#6b8e23);color:white;border:none;padding:6px 20px;border-radius:20px;font-size:14px;cursor:pointer;font-weight:500;">Promote Now</button>
                    </div>
                </div>
            ` : ''}
        </div>

        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">⭐ Leadership Roles</h3>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${['Scout', 'Patrol Leader', 'Assistant Patrol Leader', 'Senior Patrol Leader', 'Quartermaster', 'Scribe', 'Treasurer'].map(r => `
                    <button class="role-btn" data-email="${email}" data-role="${r}" style="padding:6px 16px;border-radius:20px;border:2px solid ${role === r ? 'var(--purple)' : '#e0d6ec'};background:${role === r ? 'var(--purple)' : 'white'};color:${role === r ? 'white' : 'var(--text-dark)'};cursor:pointer;font-size:13px;transition:all 0.2s;">${r}</button>
                `).join('')}
            </div>
            <div id="role-message" style="margin-top:8px;font-size:13px;color:var(--text-muted);"></div>
        </div>

        <div style="margin-bottom:20px;">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">🏅 Badge Progress</h3>
    `;

    for (const badge of badges) {
        const color = badgeColors[badge.key];
        let done = 0;
        let reqHtml = '';
        for (const req of badge.reqs) {
            const key = `${badge.key}_${req}`;
            const data = status[key];
            const statusText = data ? data.status : 'todo';
            const statusIcons = {
                'approved': '✅',
                'pending': '⏳',
                'ready': '📝',
                'todo': '🚩'
            };
            const icon = statusIcons[statusText] || '🚩';
            
            // Check if report exists
            const reportKey = `${badge.key}_${req}_report`;
            const hasReport = status[reportKey] && (status[reportKey].note || (status[reportKey].images && status[reportKey].images.length > 0));
            
            reqHtml += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f5f0f8;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span>${icon}</span>
                        <span style="font-size:14px;">${req}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        ${hasReport ? `<a href="report-viewer.html?email=${email}&tab=${badge.key}&req=${encodeURIComponent(req)}" target="_blank" style="font-size:11px;color:var(--purple);text-decoration:underline;cursor:pointer;">📄 View Report</a>` : ''}
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
                    <span style="color:var(--text-muted);">${s.date} · ${s.duration || 0}h</span>
                </div>
            `).join('')}
        </div>
    `;

    pageContent.innerHTML = html;

    document.getElementById('back-to-scouts').addEventListener('click', () => {
        selectedScout = null;
        renderView();
    });

    document.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const email = this.dataset.email;
            const scout = allScouts.find(s => s.email === email);
            if (!scout) return;
            
            const promo = isReadyForPromotion(email);
            if (!promo) return;
            
            if (confirm(`Promote ${scout.fullName || scout.username} from ${promo.currentRank} to ${promo.nextRank}?`)) {
                try {
                    await setDoc(doc(db, 'users', email), { rank: promo.nextRank }, { merge: true });
                    scout.rank = promo.nextRank;
                    alert(`✅ ${scout.fullName || scout.username} promoted to ${promo.nextRank}!`);
                } catch (error) {
                    alert('Error promoting: ' + error.message);
                }
            }
        });
    });

    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const scoutEmail = this.dataset.email;
            const newRole = this.dataset.role;
            try {
                await setDoc(doc(db, 'users', scoutEmail), { scoutRole: newRole }, { merge: true });
                document.getElementById('role-message').textContent = `✅ Role updated to: ${newRole}`;
                document.getElementById('role-message').style.color = '#4caf50';
                const scout = allScouts.find(s => s.email === scoutEmail);
                if (scout) scout.scoutRole = newRole;
                setTimeout(() => renderScoutProfile(scoutEmail), 1000);
            } catch (error) {
                document.getElementById('role-message').textContent = `❌ Error: ${error.message}`;
                document.getElementById('role-message').style.color = '#e74c3c';
            }
        });
    });

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
                
                // Auto-refresh status without re-rendering everything
                allStatus = {};
                const statusSnap = await getDocs(collection(db, 'scoutStatus'));
                statusSnap.forEach(doc => {
                    allStatus[doc.id] = doc.data();
                });
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
    let readyForPromotion = [];

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
        
        const promo = isReadyForPromotion(scout.email);
        if (promo) {
            readyForPromotion.push({ scout, promo });
        }
    }

    const order = { membership: 0, secondClass: 1, firstClass: 2, badge: 3 };
    pendingItems.sort((a, b) => order[a.badgeType] - order[b.badgeType]);

    const totalPending = pendingItems.length + readyForPromotion.length;

    if (totalPending === 0) {
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
            <span style="color:var(--text-muted);font-size:14px;">${totalPending} items</span>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#7bcb7b;color:white;font-size:12px;font-weight:500;">Membership</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#4caf50;color:white;font-size:12px;font-weight:500;">Second Class</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#2e7d32;color:white;font-size:12px;font-weight:500;">First Class</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#00897b;color:white;font-size:12px;font-weight:500;">Badges</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:linear-gradient(135deg,#b8860b,#6b8e23);color:white;font-size:12px;font-weight:500;">🌟 Ready for Promotion</span>
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

    for (const item of readyForPromotion) {
        const name = item.scout.fullName || item.scout.username;
        const goldenGreen = 'linear-gradient(135deg, #b8860b, #6b8e23)';

        html += `
            <div style="background:linear-gradient(135deg, #fdf8e7, #f0f7e6);border-radius:16px;padding:16px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-left:4px solid #b8860b;">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:${goldenGreen};"></span>
                    <span style="font-size:12px;font-weight:600;color:white;background:${goldenGreen};padding:2px 10px;border-radius:8px;">🌟 Ready for Promotion</span>
                    <span style="font-weight:500;">${name}</span>
                    <span style="color:var(--text-muted);font-size:14px;">${item.promo.currentRank} → ${item.promo.nextRank}</span>
                </div>
                <button class="promote-btn" data-email="${item.scout.email}" style="background:${goldenGreen};color:white;border:none;padding:6px 20px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(184,134,11,0.3);">🌟 Promote Now</button>
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

    document.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const email = this.dataset.email;
            const scout = allScouts.find(s => s.email === email);
            if (!scout) return;
            
            const promo = isReadyForPromotion(email);
            if (!promo) return;
            
            if (confirm(`Promote ${scout.fullName || scout.username} from ${promo.currentRank} to ${promo.nextRank}?`)) {
                try {
                    await setDoc(doc(db, 'users', email), { rank: promo.nextRank }, { merge: true });
                    scout.rank = promo.nextRank;
                    alert(`✅ ${scout.fullName || scout.username} promoted to ${promo.nextRank}!`);
                } catch (error) {
                    alert('Error promoting: ' + error.message);
                }
            }
        });
    });
}

// ─── Sessions View ──────────────────────────────────────
function renderSessions() {
    // ─── Show loading state first ──────────────────────────
    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="color:var(--purple-dark);margin:0;">📋 Sessions</h2>
                <p style="color:var(--text-muted);margin-top:4px;">Loading sessions...</p>
            </div>
            <a href="new-session.html" style="background:var(--orange);color:white;border:none;padding:10px 24px;border-radius:40px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;box-shadow:0 2px 8px rgba(230,126,34,0.3);">➕ New Session</a>
        </div>
        <div style="text-align:center;padding:40px 0;">
            <div style="display:inline-block;width:40px;height:40px;border:4px solid #e8e0f0;border-top-color:var(--purple);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
            <p style="color:var(--text-muted);margin-top:12px;">Loading sessions...</p>
        </div>
        <style>
            @keyframes spin { to { transform: rotate(360deg); } }
        </style>
    `;
    
    pageContent.innerHTML = html;

    // ─── Calculate stats ──────────────────────────────────
    let totalSessions = allSessions.length;
    let totalHours = 0;
    let totalAttendees = new Set();

    for (const session of allSessions) {
        totalHours += session.duration || 0;
        if (session.attendance) {
            Object.keys(session.attendance).forEach(email => {
                if (session.attendance[email] === true) {
                    totalAttendees.add(email);
                }
            });
        }
    }

    // ─── Build the actual content ──────────────────────────
    let contentHtml = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="color:var(--purple-dark);margin:0;">📋 Sessions</h2>
                <p style="color:var(--text-muted);margin-top:4px;">${totalSessions} sessions · ${totalHours} hours</p>
            </div>
            <a href="new-session.html" style="background:var(--orange);color:white;border:none;padding:10px 24px;border-radius:40px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;box-shadow:0 2px 8px rgba(230,126,34,0.3);">➕ New Session</a>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
            <div style="background:white;border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:28px;font-weight:700;color:var(--purple);">${totalSessions}</div>
                <div style="font-size:13px;color:var(--text-muted);">Total Sessions</div>
            </div>
            <div style="background:white;border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:28px;font-weight:700;color:#4caf50;">${totalHours}</div>
                <div style="font-size:13px;color:var(--text-muted);">Scouting Hours</div>
            </div>
            <div style="background:white;border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:28px;font-weight:700;color:#8fbcbb;">${totalAttendees.size}</div>
                <div style="font-size:13px;color:var(--text-muted);">Total Attendees</div>
            </div>
        </div>
    `;

    if (allSessions.length === 0) {
        contentHtml += `
            <div style="background:white;border-radius:24px;padding:60px 20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:64px;margin-bottom:16px;">📅</div>
                <h3 style="color:var(--text-dark);margin-bottom:8px;">No sessions yet</h3>
                <p style="color:var(--text-muted);">Click "New Session" to create your first session!</p>
            </div>
        `;
        pageContent.innerHTML = contentHtml;
        return;
    }

    const sortedSessions = [...allSessions].sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
    });

    contentHtml += `<div style="display:flex;flex-direction:column;gap:12px;">`;

    for (const session of sortedSessions) {
        const attendeeCount = session.attendance ? Object.keys(session.attendance).filter(k => session.attendance[k] === true).length : 0;
        const isAttending = session.attendance ? session.attendance[`${currentUser.username}@gis-scout.local`] === true : false;
        
        const today = new Date().toISOString().split('T')[0];
        let statusBadge = '';
        let statusColor = '';
        if (session.date === today) {
            statusBadge = 'Today';
            statusColor = '#28a745';
        } else if (session.date > today) {
            statusBadge = 'Upcoming';
            statusColor = '#007bff';
        } else {
            statusBadge = 'Completed';
            statusColor = '#6c757d';
        }

        contentHtml += `
            <div class="session-card" data-id="${session.id}" style="background:white;border-radius:20px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;border-left:4px solid ${statusColor};">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px;">
                    <div style="flex:1;min-width:200px;">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <span style="font-size:18px;font-weight:600;color:var(--text-dark);">${session.name}</span>
                            <span style="font-size:11px;background:${statusColor};color:white;padding:2px 12px;border-radius:12px;font-weight:500;">${statusBadge}</span>
                        </div>
                        <div style="font-size:14px;color:var(--text-muted);margin-top:4px;">
                            📅 ${session.date} · ${session.time} · 📍 ${session.location || 'TBD'}
                        </div>
                        ${session.purpose ? `<div style="font-size:13px;color:var(--text-muted);margin-top:4px;">📝 ${session.purpose}</div>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <div style="text-align:center;">
                            <div style="font-size:20px;font-weight:700;color:var(--purple);">${session.duration || 0}</div>
                            <div style="font-size:10px;color:var(--text-muted);">hours</div>
                        </div>
                        <div style="text-align:center;min-width:45px;">
                            <div style="font-size:18px;font-weight:600;color:#8fbcbb;">${attendeeCount}</div>
                            <div style="font-size:10px;color:var(--text-muted);">attended</div>
                        </div>
                        ${isAttending ? '<span style="background:#d4edda;color:#155724;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:500;">✅ Attended</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    contentHtml += '</div>';
    pageContent.innerHTML = contentHtml;

    document.querySelectorAll('.session-card').forEach(card => {
        card.addEventListener('click', function() {
            const id = this.dataset.id;
            window.location.href = `session-detail-leader.html?id=${id}`;
        });
    });
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
    if (usersUnsubscribe) usersUnsubscribe();
    if (statusUnsubscribe) statusUnsubscribe();
    if (sessionsUnsubscribe) sessionsUnsubscribe();
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

// ─── Init ────────────────────────────────────────────────
async function init() {
    listenToUsers();
    listenToStatus();
    listenToSessions();
    renderView();
}

init();
