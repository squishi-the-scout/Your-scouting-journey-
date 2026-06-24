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
const sidebarRole = document.getElementById('sidebar-role');
const pageHeading = document.getElementById('page-heading');
const pageSubtitle = document.getElementById('page-subtitle');
const pendingBadge = document.getElementById('pending-badge');
const displayName = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
if (sidebarName) sidebarName.textContent = displayName;
if (sidebarRole) sidebarRole.textContent = currentUser.role || 'Leader';

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

function getLatestBadge(rank) {
    if (rank === 'First Class') return { key: 'firstClass', label: 'First Class', reqs: firstClassRequirements };
    if (rank === 'Second Class') return { key: 'secondClass', label: 'Second Class', reqs: secondClassRequirements };
    return { key: 'membership', label: 'Membership', reqs: membershipRequirements };
}

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

function updatePendingBadge() {
    if (!pendingBadge) return;
    let count = 0;
    for (const scout of allScouts) {
        const status = allStatus[scout.email] || {};
        for (const key in status) {
            if (status[key].status === 'pending') count++;
        }
    }
    pendingBadge.textContent = count;
}

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
        updatePendingBadge();
        if (!selectedScout) {
            renderView();
        } else {
            renderScoutProfile(selectedScout);
        }
    }, (error) => {
        console.error('Users listener error:', error);
    });
}

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
        updatePendingBadge();
        if (!selectedScout) {
            renderView();
        } else {
            renderScoutProfile(selectedScout);
        }
    }, (error) => {
        console.error('Status listener error:', error);
    });
}

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

function updatePageHeading() {
    if (!pageHeading) return;
    
    if (currentView === 'dashboard') {
        pageHeading.innerHTML = `Good morning, <span id="leader-name">${displayName}</span>! 👋`;
        if (pageSubtitle) pageSubtitle.textContent = 'Welcome to your Home';
    } else if (currentView === 'scouts') {
        pageHeading.textContent = '👥 All Scouts';
        if (pageSubtitle) pageSubtitle.textContent = 'View and manage all scouts';
    } else if (currentView === 'pending') {
        pageHeading.textContent = '⏳ Pending Approvals';
        if (pageSubtitle) pageSubtitle.textContent = 'Review and approve scout requirements';
    } else if (currentView === 'sessions') {
        pageHeading.textContent = '📋 Sessions';
        if (pageSubtitle) pageSubtitle.textContent = 'Manage scout sessions';
    } else if (currentView === 'export') {
        pageHeading.textContent = '📤 Export Data';
        if (pageSubtitle) pageSubtitle.textContent = 'Export scout progress data';
    } else if (currentView === 'profile') {
        pageHeading.textContent = '👤 My Profile';
        if (pageSubtitle) pageSubtitle.textContent = 'Manage your personal information';
    }
}

function renderView() {
    if (!pageContent) return;
    pageContent.innerHTML = '';
    updatePageHeading();
    
    if (selectedScout) {
        renderScoutProfile(selectedScout);
        return;
    }
    
    if (currentView === 'dashboard') renderDashboard();
    else if (currentView === 'scouts') renderAllScouts();
    else if (currentView === 'pending') renderPendingApprovals();
    else if (currentView === 'sessions') renderSessions();
    else if (currentView === 'export') renderExport();
    else if (currentView === 'profile') renderLeaderProfile();
}

function renderDashboard() {
    let html = `
        <div style="max-width:700px;margin:0 auto;text-align:center;padding:20px 0;">
            <div style="font-size:48px;margin-bottom:16px;">💜</div>
            <p style="color:var(--text-muted);font-size:16px;margin-bottom:32px;">Your Home is under construction. Check back soon!</p>
        </div>
    `;
    pageContent.innerHTML = html;
}

function renderAllScouts() {
    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
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

        const latestBadge = getLatestBadge(rank);
        let done = 0;
        for (const req of latestBadge.reqs) {
            const key = `${latestBadge.key}_${req}`;
            if (status[key]?.status === 'approved') done++;
        }
        const total = latestBadge.reqs.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        
        const noteKey = `${scout.email}_note`;
        const scoutNote = scout.note || '';

        html += `
            <div class="scout-card" data-email="${scout.email}" style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-weight:600;font-size:18px;color:var(--text-dark);">${name}</div>
                    <span style="font-size:12px;background:#e8e0f0;padding:2px 10px;border-radius:12px;color:var(--text-muted);">${role}</span>
                </div>
                <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">${patrol} · ${rank}</div>
                
                <div style="margin-bottom:6px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);">
                        <span>${latestBadge.label}</span>
                        <span>${done}/${total}</span>
                    </div>
                    <div style="background:#e8e0f0;border-radius:20px;height:4px;overflow:hidden;">
                        <div style="background:#7bcb7b;height:100%;width:${pct}%;border-radius:20px;"></div>
                    </div>
                </div>
                
                ${scoutNote ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted);font-style:italic;border-top:1px solid #e8e0f0;padding-top:8px;">📝 ${scoutNote}</div>` : ''}
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

        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">📝 Leader Note</h3>
            <textarea id="leader-note" style="width:100%;padding:12px;border-radius:12px;border:1px solid #e0d6ec;font-family:inherit;font-size:14px;min-height:80px;resize:vertical;">${scout.note || ''}</textarea>
            <button id="save-leader-note" class="btn-primary" style="margin-top:12px;background:var(--purple);color:white;border:none;padding:10px 24px;border-radius:40px;font-size:14px;font-weight:600;cursor:pointer;">💾 Save Note</button>
            <div id="note-message" style="margin-top:8px;font-size:13px;color:var(--text-muted);"></div>
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

    document.getElementById('save-leader-note').addEventListener('click', async function() {
        const note = document.getElementById('leader-note').value.trim();
        const message = document.getElementById('note-message');
        
        try {
            await setDoc(doc(db, 'users', email), { note: note }, { merge: true });
            const scout = allScouts.find(s => s.email === email);
            if (scout) scout.note = note;
            message.textContent = '✅ Note saved successfully!';
            message.style.color = '#4caf50';
        } catch (error) {
            message.textContent = '❌ Error saving note: ' + error.message;
            message.style.color = '#e74c3c';
        }
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
                
                allStatus = {};
                const statusSnap = await getDocs(collection(db, 'scoutStatus'));
                statusSnap.forEach(doc => {
                    allStatus[doc.id] = doc.data();
                });
                updatePendingBadge();
                renderScoutProfile(scoutEmail);
            } catch (error) {
                alert('Error approving: ' + error.message);
            }
        });
    });
}

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

    let html = `
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#7bcb7b;color:white;font-size:12px;font-weight:500;">Membership</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#4caf50;color:white;font-size:12px;font-weight:500;">Second Class</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#2e7d32;color:white;font-size:12px;font-weight:500;">First Class</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#00897b;color:white;font-size:12px;font-weight:500;">Badges</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:linear-gradient(135deg,#b8860b,#6b8e23);color:white;font-size:12px;font-weight:500;">🌟 Ready for Promotion</span>
        </div>
    `;

    if (totalPending === 0) {
        html += `
            <div style="background:white;border-radius:24px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:48px;margin-bottom:16px;">🎉</div>
                <p style="color:var(--text-muted);font-size:18px;">No pending approvals! All caught up.</p>
            </div>
        `;
        pageContent.innerHTML = html;
        return;
    }

    html += `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
            <span style="color:var(--text-muted);font-size:14px;">${totalPending} items</span>
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
            updatePendingBadge();
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
            updatePendingBadge();
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

function renderSessions() {
    let totalSessions = allSessions.length;
    let totalHours = 0;

    for (const session of allSessions) {
        totalHours += session.duration || 0;
    }

    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <div></div>
            <a href="new-session.html" style="background:#007bff;color:white;border:none;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;box-shadow:0 2px 8px rgba(0,123,255,0.3);transition:transform 0.2s,box-shadow 0.2s;" 
               onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 16px rgba(0,123,255,0.4)';"
               onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 2px 8px rgba(0,123,255,0.3)';">➕ New Session</a>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px;">
            <div style="background:white;border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:28px;font-weight:700;color:var(--purple);">${totalSessions}</div>
                <div style="font-size:13px;color:var(--text-muted);">Total Sessions</div>
            </div>
            <div style="background:white;border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:28px;font-weight:700;color:#4caf50;">${totalHours}</div>
                <div style="font-size:13px;color:var(--text-muted);">Scouting Hours</div>
            </div>
        </div>
    `;

    if (allSessions.length === 0) {
        html += `
            <div style="background:white;border-radius:24px;padding:60px 20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:64px;margin-bottom:16px;">📅</div>
                <h3 style="color:var(--text-dark);margin-bottom:8px;">No sessions yet</h3>
                <p style="color:var(--text-muted);">Click "New Session" to create your first session!</p>
            </div>
        `;
        pageContent.innerHTML = html;
        return;
    }

    const sortedSessions = [...allSessions].sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
    });

    html += `<div style="display:flex;flex-direction:column;gap:12px;">`;

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

        html += `
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

    html += '</div>';
    pageContent.innerHTML = html;

    document.querySelectorAll('.session-card').forEach(card => {
        card.addEventListener('click', function() {
            const id = this.dataset.id;
            window.location.href = `session-detail-leader.html?id=${id}`;
        });
    });
}

function renderExport() {
    pageContent.innerHTML = `
        <h2 style="color:var(--purple-dark);margin-bottom:24px;">📤 Export Data</h2>
        <div style="background:white;border-radius:24px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="font-size:48px;margin-bottom:16px;">📊</div>
            <p style="color:var(--text-muted);font-size:16px;">Export feature coming soon.</p>
        </div>
    `;
}

// ─── Leader Profile ──────────────────────────────────────
function renderLeaderProfile() {
    let html = `
        <div style="max-width:600px;margin:0 auto;">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
                <span id="profile-back" style="cursor:pointer;color:var(--text-muted);font-size:18px;">←</span>
                <h2 style="color:var(--purple-dark);margin:0;">👤 My Profile</h2>
            </div>
            <div style="background:white;border-radius:24px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
                    <div class="person-avatar" style="width:80px;height:80px;background:#3498db;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;">
                        <div class="head" style="width:24px;height:24px;border-radius:50%;background:white;position:absolute;top:16px;"></div>
                        <div class="body" style="width:38px;height:22px;border-radius:50% 50% 0 0;background:white;position:absolute;bottom:14px;"></div>
                    </div>
                    <div>
                        <div style="font-size:24px;font-weight:700;color:var(--text-dark);">${currentUser.fullName || displayName}</div>
                        <div style="color:var(--text-muted);">${currentUser.role || 'Leader'}</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div>
                        <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Full Name</label>
                        <input type="text" id="leader-fullname" value="${currentUser.fullName || ''}" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                    </div>
                    <div>
                        <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Date of Birth</label>
                        <input type="date" id="leader-dob" value="${currentUser.dob || ''}" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                    </div>
                    <div>
                        <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Role</label>
                        <select id="leader-role" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                            <option value="Leader" ${currentUser.role === 'Leader' ? 'selected' : ''}>Leader</option>
                            <option value="Rover Leader" ${currentUser.role === 'Rover Leader' ? 'selected' : ''}>Rover Leader</option>
                            <option value="GSL" ${currentUser.role === 'GSL' ? 'selected' : ''}>GSL</option>
                            <option value="AGSL" ${currentUser.role === 'AGSL' ? 'selected' : ''}>AGSL</option>
                            <option value="Advisor" ${currentUser.role === 'Advisor' ? 'selected' : ''}>Advisor</option>
                            <option value="Section Head" ${currentUser.role === 'Section Head' ? 'selected' : ''}>Section Head</option>
                        </select>
                    </div>
                </div>
                <button id="save-leader-profile" style="margin-top:16px;background:var(--purple);color:white;border:none;padding:12px 24px;border-radius:40px;font-weight:600;cursor:pointer;width:100%;">💾 Save Profile</button>
                <div id="profile-message" style="margin-top:12px;text-align:center;color:var(--text-muted);"></div>
            </div>
        </div>
    `;
    
    pageContent.innerHTML = html;
    
    document.getElementById('profile-back').addEventListener('click', () => {
        currentView = 'dashboard';
        renderView();
    });
    
    document.getElementById('save-leader-profile').addEventListener('click', async function() {
        const fullName = document.getElementById('leader-fullname').value.trim();
        const dob = document.getElementById('leader-dob').value;
        const role = document.getElementById('leader-role').value;
        const message = document.getElementById('profile-message');
        
        if (!fullName) {
            message.textContent = '⚠️ Please enter your full name.';
            message.style.color = '#e67e22';
            return;
        }
        
        try {
            await setDoc(doc(db, 'users', currentUser.email), {
                fullName: fullName,
                dob: dob || null,
                role: role
            }, { merge: true });
            message.textContent = '✅ Profile saved successfully!';
            message.style.color = '#4caf50';
            currentUser.fullName = fullName;
            currentUser.dob = dob;
            currentUser.role = role;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            if (sidebarName) sidebarName.textContent = fullName;
            if (sidebarRole) sidebarRole.textContent = role;
            setTimeout(() => {
                currentView = 'dashboard';
                renderView();
            }, 1200);
        } catch (error) {
            message.textContent = '❌ Error: ' + error.message;
            message.style.color = '#e74c3c';
        }
    });
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

document.getElementById('sidebar-profile-btn')?.addEventListener('click', () => {
    currentView = 'profile';
    document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
    renderView();
});

document.getElementById('logout-btn').addEventListener('click', () => {
    if (usersUnsubscribe) usersUnsubscribe();
    if (statusUnsubscribe) statusUnsubscribe();
    if (sessionsUnsubscribe) sessionsUnsubscribe();
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

async function init() {
    listenToUsers();
    listenToStatus();
    listenToSessions();
    renderView();
}

init();
