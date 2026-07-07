import { db } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, getDocs, onSnapshot, query, where
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

// ─── LEADER ROLES ──────────────────────────────────────────
const leaderRoles = ['leader', 'Rover Leader', 'GSL', 'AGSL', 'Advisor', 'Section Head'];

// ─── CHECK USER ──────────────────────────────────────────
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

console.log('🔍 Current User:', currentUser);

if (!currentUser) {
    console.log('❌ No user found, redirecting to login');
    window.location.href = 'index.html';
    throw new Error('No user found');
}

if (currentUser.username === 'hazfar' || currentUser.username === 'iyan') {
    if (!currentUser.role || !leaderRoles.includes(currentUser.role)) {
        currentUser.role = 'leader';
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        console.log('✅ Forced leader role for:', currentUser.username);
    }
}

if (!leaderRoles.includes(currentUser.role)) {
    console.log('❌ User is not a leader. Role:', currentUser.role);
    window.location.href = 'index.html';
    throw new Error('Not authorized as leader');
}

console.log('✅ Authorized as:', currentUser.role);

// ─── DOM refs ─────────────────────────────────────────────
const pageContent = document.getElementById('page-content');
const sidebarName = document.getElementById('sidebar-name');
const sidebarRole = document.getElementById('sidebar-role');
const pageHeading = document.getElementById('page-heading');
const pageSubtitle = document.getElementById('page-subtitle');
const pendingBadge = document.getElementById('pending-badge');

let displayName = currentUser.fullName || currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
if (sidebarName) sidebarName.textContent = displayName;
if (sidebarRole) sidebarRole.textContent = currentUser.role || 'Leader';

let allScouts = [];
let allStatus = {};
let allSessions = [];
let allTickets = [];
let currentView = 'dashboard';
let selectedScout = null;
let usersUnsubscribe = null;
let statusUnsubscribe = null;
let sessionsUnsubscribe = null;
let ticketsUnsubscribe = null;

// ─── Avatar colors ──────────────────────────────────────
const avatarColors = ['#6c3b8c', '#e67e22', '#8a5aa8', '#f39c12', '#4a2a5e', '#d35400'];
function getColor(name) {
    if (!name) return avatarColors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

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
    }
    
    badges.push({ key: 'badge', reqs: [], label: 'Badges' });
    
    return badges;
}

function getLatestBadge(rank) {
    if (rank === 'First Class') return { key: 'firstClass', label: 'First Class', reqs: firstClassRequirements };
    if (rank === 'Second Class') return { key: 'secondClass', label: 'Second Class', reqs: secondClassRequirements };
    return { key: 'membership', label: 'Membership', reqs: membershipRequirements };
}

function isReadyForPromotion(username) {
    const status = allStatus[username] || {};
    const scout = allScouts.find(s => s.username === username);
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

// ─── Check for stagnant scouts ──────────────────────────
function checkStagnation() {
    const stagnantScouts = [];
    const daysThreshold = 21;
    
    const now = new Date();
    
    for (const scout of allScouts) {
        const status = allStatus[scout.username] || {};
        let lastActivity = null;
        let lastRequirement = 'No activity recorded';
        
        for (const key in status) {
            if (status[key].updatedAt) {
                const activityDate = new Date(status[key].updatedAt);
                if (!lastActivity || activityDate > lastActivity) {
                    lastActivity = activityDate;
                    let reqName = key;
                    if (key.includes('_')) {
                        reqName = key.split('_').slice(1).join('_');
                    }
                    lastRequirement = reqName;
                }
            }
            if (status[key].approvedAt && !status[key].updatedAt) {
                const activityDate = new Date(status[key].approvedAt);
                if (!lastActivity || activityDate > lastActivity) {
                    lastActivity = activityDate;
                    let reqName = key;
                    if (key.includes('_')) {
                        reqName = key.split('_').slice(1).join('_');
                    }
                    lastRequirement = reqName;
                }
            }
            if (status[key].createdAt && !status[key].updatedAt && !status[key].approvedAt) {
                const activityDate = new Date(status[key].createdAt);
                if (!lastActivity || activityDate > lastActivity) {
                    lastActivity = activityDate;
                    let reqName = key;
                    if (key.includes('_')) {
                        reqName = key.split('_').slice(1).join('_');
                    }
                    lastRequirement = reqName;
                }
            }
        }
        
        if (!lastActivity) {
            lastActivity = scout.joinDate ? new Date(scout.joinDate) : new Date();
            lastRequirement = 'Joined Scouting';
        }
        
        const daysSince = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
        
        if (daysSince >= daysThreshold) {
            stagnantScouts.push({
                scout: scout,
                daysSince: daysSince,
                lastActivity: lastActivity,
                lastRequirement: lastRequirement
            });
        }
    }
    
    stagnantScouts.sort((a, b) => b.daysSince - a.daysSince);
    return stagnantScouts;
}

// ─── Check health alerts ──────────────────────────────────
function checkHealthAlerts() {
    const healthAlerts = [];
    const now = new Date();
    
    for (const scout of allScouts) {
        const health = scout.health || {};
        if (!health.lastUpdated) {
            healthAlerts.push({
                scout: scout,
                daysSince: 999,
                message: 'Never updated'
            });
            continue;
        }
        
        const lastUpdated = new Date(health.lastUpdated);
        const daysSince = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));
        
        if (daysSince > 90) {
            healthAlerts.push({
                scout: scout,
                daysSince: daysSince,
                message: `${daysSince} days since last update`
            });
        }
    }
    
    healthAlerts.sort((a, b) => b.daysSince - a.daysSince);
    return healthAlerts;
}

// ─── UPDATE PENDING BADGE (with ticket count) ──────────────
function updatePendingBadge() {
    if (!pendingBadge) return;
    
    // Count pending from requirements
    let pendingCount = 0;
    for (const scout of allScouts) {
        const status = allStatus[scout.username] || {};
        for (const key in status) {
            if (status[key].status === 'pending') pendingCount++;
        }
    }
    
    // ─── Count active tickets ──────────────────────────────
    const activeTickets = allTickets.filter(t => 
        t.status === 'pending' || 
        t.status === 'requirements_added' || 
        t.status === 'report_submitted'
    );
    
    // Show total pending (requirements + tickets)
    const totalPending = pendingCount + activeTickets.length;
    pendingBadge.textContent = totalPending;
    
    // ─── Update ticket badge in sidebar ─────────────────────
    const ticketBadge = document.getElementById('leader-ticket-badge');
    if (ticketBadge) {
        ticketBadge.textContent = activeTickets.length;
        ticketBadge.style.display = activeTickets.length > 0 ? 'inline-block' : 'none';
    }
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
                allScouts.push({ username: doc.id, ...data });
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

// ─── LISTEN TO TICKETS ──────────────────────────────────
function listenToTickets() {
    if (ticketsUnsubscribe) {
        ticketsUnsubscribe();
        ticketsUnsubscribe = null;
    }
    
    ticketsUnsubscribe = onSnapshot(collection(db, 'tickets'), (snapshot) => {
        allTickets = [];
        snapshot.forEach(doc => {
            allTickets.push({ id: doc.id, ...doc.data() });
        });
        updatePendingBadge();
        if (currentView === 'tickets' || currentView === 'dashboard') {
            renderView();
        }
        if (selectedScout) {
            renderScoutProfile(selectedScout);
        }
    }, (error) => {
        console.error('Tickets listener error:', error);
    });
}

function updatePageHeading() {
    if (!pageHeading) return;
    
    if (currentView === 'dashboard') {
        pageHeading.innerHTML = `Good morning, <span style="color:var(--green-primary);">${displayName}</span>! 👋`;
        if (pageSubtitle) pageSubtitle.textContent = 'Welcome to your Home';
    } else if (currentView === 'scouts') {
        pageHeading.textContent = 'All Scouts';
        if (pageSubtitle) pageSubtitle.textContent = 'View and manage all scouts';
    } else if (currentView === 'pending') {
        pageHeading.textContent = 'Pending Approvals';
        if (pageSubtitle) pageSubtitle.textContent = 'Review and approve scout requirements';
    } else if (currentView === 'sessions') {
        pageHeading.textContent = 'Sessions';
        if (pageSubtitle) pageSubtitle.textContent = 'Manage scout sessions';
    } else if (currentView === 'export') {
        pageHeading.textContent = 'Export Data';
        if (pageSubtitle) pageSubtitle.textContent = 'Export scout progress data';
    } else if (currentView === 'profile') {
        pageHeading.textContent = 'My Profile';
        if (pageSubtitle) pageSubtitle.textContent = 'Manage your personal information';
    } else if (currentView === 'tickets') {
        pageHeading.textContent = '🎫 Tickets';
        if (pageSubtitle) pageSubtitle.textContent = 'Manage scout badge requests';
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
    else if (currentView === 'tickets') renderLeaderTickets();
}

// ─── Dashboard ──────────────────────────────────────────
function renderDashboard() {
    // ─── Calculate stats ──────────────────────────────────────
    const totalScouts = allScouts.length;
    let totalPending = 0;
    let totalServiceHours = 0;

    for (const scout of allScouts) {
        const status = allStatus[scout.username] || {};
        for (const key in status) {
            if (status[key].status === 'pending') totalPending++;
        }
    }
    
    // ─── Add ticket pending count ──────────────────────────
    const activeTickets = allTickets.filter(t => 
        t.status === 'pending' || 
        t.status === 'requirements_added' || 
        t.status === 'report_submitted'
    );
    totalPending += activeTickets.length;

    for (const session of allSessions) {
        totalServiceHours += session.duration || 0;
    }

    // ─── Pending items ────────────────────────────────────────
    const pendingItems = [];
    for (const scout of allScouts) {
        const status = allStatus[scout.username] || {};
        for (const key in status) {
            if (status[key].status === 'pending') {
                let reqName = key;
                let badgeType = 'membership';
                let color = '#7bcb7b';
                if (key.startsWith('membership_')) {
                    reqName = key.replace('membership_', '');
                    badgeType = 'membership';
                    color = '#7bcb7b';
                } else if (key.startsWith('secondClass_')) {
                    reqName = key.replace('secondClass_', '');
                    badgeType = 'secondClass';
                    color = '#4caf50';
                } else if (key.startsWith('firstClass_')) {
                    reqName = key.replace('firstClass_', '');
                    badgeType = 'firstClass';
                    color = '#2e7d32';
                } else if (key.startsWith('badge_')) {
                    reqName = key.replace('badge_', '');
                    badgeType = 'badge';
                    color = '#00897b';
                }
                pendingItems.push({
                    scout: scout,
                    reqName: reqName,
                    badgeType: badgeType,
                    color: color,
                    label: badgeType.charAt(0).toUpperCase() + badgeType.slice(1)
                });
            }
        }
    }
    
    // ─── Add ticket pending items ──────────────────────────
    for (const ticket of activeTickets) {
        const scout = allScouts.find(s => s.username === ticket.scoutName);
        pendingItems.push({
            scout: scout || { username: ticket.scoutName, fullName: ticket.scoutName },
            reqName: `🎫 ${ticket.badgeName} (Ticket)`,
            badgeType: 'ticket',
            color: '#e67e22',
            label: 'Badge Request'
        });
    }
    
    pendingItems.sort((a, b) => a.badgeType.localeCompare(b.badgeType));

    // ─── Patrol overview ──────────────────────────────────────
    const patrols = ['Eagle', 'Falcon', 'Wolf', 'Bear', 'Lion'];
    const patrolColors = {
        'Eagle': '#f1c40f',
        'Falcon': '#3498db',
        'Wolf': '#95a5a6',
        'Bear': '#8d6e63',
        'Lion': '#e67e22'
    };
    const patrolData = [];

    for (const patrol of patrols) {
        const scoutsInPatrol = allScouts.filter(s => s.patrol === patrol);
        if (scoutsInPatrol.length === 0) continue;

        let totalDone = 0;
        let totalReqs = 0;
        let completedScouts = 0;

        for (const scout of scoutsInPatrol) {
            const status = allStatus[scout.username] || {};
            let scoutDone = 0;
            let scoutTotal = 0;

            for (const req of membershipRequirements) {
                const key = `membership_${req}`;
                scoutTotal++;
                if (status[key]?.status === 'approved') {
                    scoutDone++;
                    totalDone++;
                }
                totalReqs++;
            }
            if (scout.rank === 'Second Class' || scout.rank === 'First Class') {
                for (const req of secondClassRequirements) {
                    const key = `secondClass_${req}`;
                    scoutTotal++;
                    if (status[key]?.status === 'approved') {
                        scoutDone++;
                        totalDone++;
                    }
                    totalReqs++;
                }
            }
            if (scout.rank === 'First Class') {
                for (const req of firstClassRequirements) {
                    const key = `firstClass_${req}`;
                    scoutTotal++;
                    if (status[key]?.status === 'approved') {
                        scoutDone++;
                        totalDone++;
                    }
                    totalReqs++;
                }
            }

            const scoutPct = scoutTotal > 0 ? Math.round((scoutDone / scoutTotal) * 100) : 0;
            if (scoutPct >= 100) completedScouts++;
        }

        const pct = totalReqs > 0 ? Math.round((totalDone / totalReqs) * 100) : 0;
        patrolData.push({
            name: patrol,
            color: patrolColors[patrol] || '#6c3b8c',
            pct: pct,
            completed: completedScouts,
            total: scoutsInPatrol.length,
            scouts: scoutsInPatrol
        });
    }

    // ─── Attendance overview ──────────────────────────────────
    let totalAttendances = 0;
    let totalPossible = 0;
    for (const scout of allScouts) {
        for (const session of allSessions) {
            totalPossible++;
            if (session.attendance && session.attendance[scout.username] === true) {
                totalAttendances++;
            }
        }
    }
    const attendancePct = totalPossible > 0 ? Math.round((totalAttendances / totalPossible) * 100) : 0;

    // ─── Stagnation ──────────────────────────────────────────
    const stagnantScouts = checkStagnation();

    // ─── Health alerts ──────────────────────────────────────
    const healthAlerts = checkHealthAlerts();
    const totalAlerts = stagnantScouts.length + healthAlerts.length;

    // ─── Build HTML ──────────────────────────────────────────
    let html = `
        <!-- ===== STATS GRID ===== -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;">
            <div style="background:white;border-radius:20px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:32px;font-weight:700;color:var(--purple);">${totalScouts}</div>
                <div style="font-size:14px;color:var(--text-muted);">Total Scouts</div>
            </div>
            <div style="background:white;border-radius:20px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:32px;font-weight:700;color:var(--orange);">${totalPending}</div>
                <div style="font-size:14px;color:var(--text-muted);">Pending Approvals</div>
            </div>
            <div style="background:white;border-radius:20px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:32px;font-weight:700;color:#8fbcbb;">${allSessions.length}</div>
                <div style="font-size:14px;color:var(--text-muted);">Total Sessions</div>
            </div>
            <div style="background:white;border-radius:20px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:32px;font-weight:700;color:#4caf50;">${totalServiceHours}</div>
                <div style="font-size:14px;color:var(--text-muted);">Service Hours</div>
            </div>
        </div>
    `;

    // ─── ALERT CARD (Health + Stagnation) ────────────────────
    if (totalAlerts > 0) {
        html += `
            <div style="background:#fff8e1;border-radius:16px;padding:16px 20px;margin-bottom:24px;border-left:4px solid #f9a825;">
                <div style="font-weight:600;color:#795548;margin-bottom:8px;font-size:15px;">⚠️ Alerts (${totalAlerts})</div>
                
                ${healthAlerts.length > 0 ? `
                    <div style="margin-bottom:8px;">
                        <div style="font-weight:500;color:#856404;font-size:13px;">🏥 Health Update Needed</div>
                        ${healthAlerts.map(item => `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:white;border-radius:6px;margin-top:4px;cursor:pointer;" onclick="window.selectScout('${item.scout.username}')">
                                <span style="font-size:13px;font-weight:500;color:var(--text-dark);">${item.scout.fullName || item.scout.username}</span>
                                <span style="font-size:12px;color:#856404;">${item.message}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${stagnantScouts.length > 0 ? `
                    <div style="${healthAlerts.length > 0 ? 'margin-top:8px;' : ''}">
                        <div style="font-weight:500;color:#856404;font-size:13px;">📉 Stagnation Alerts</div>
                        ${stagnantScouts.map(item => {
                            const name = item.scout.fullName || item.scout.username;
                            const color = item.daysSince >= 30 ? '#e74c3c' : '#f39c12';
                            return `
                                <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:white;border-radius:6px;margin-top:4px;cursor:pointer;" onclick="window.selectScout('${item.scout.username}')">
                                    <span style="font-size:13px;font-weight:500;color:var(--text-dark);">${name}</span>
                                    <span style="font-size:12px;color:${color};">${item.daysSince} days inactive</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    } else {
        html += `
            <div style="background:#d4edda;border-radius:16px;padding:12px 16px;margin-bottom:24px;border-left:4px solid #28a745;">
                <span style="color:#155724;">✅ All scouts are active and health records are up to date.</span>
            </div>
        `;
    }

    // ─── TWO COLUMN LAYOUT ──────────────────────────────────
    html += `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
            <!-- ─── LEFT COLUMN ─── -->
            <div style="display:flex;flex-direction:column;gap:20px;">

                <!-- PENDING APPROVALS -->
                <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                        <h3 style="color:var(--text-dark);font-size:17px;margin:0;">⏳ Pending Approvals</h3>
                        <span style="background:var(--orange);color:white;padding:2px 12px;border-radius:20px;font-size:12px;font-weight:600;">${pendingItems.length}</span>
                    </div>
                    ${pendingItems.length === 0 ? `
                        <p style="color:var(--text-muted);font-size:14px;text-align:center;padding:12px 0;">All caught up! 🎉</p>
                    ` : `
                        ${pendingItems.slice(0, 5).map(item => `
                            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f5f0f8;">
                                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color};flex-shrink:0;"></span>
                                <span style="font-size:13px;font-weight:500;color:var(--text-dark);">${item.reqName}</span>
                                <span style="font-size:12px;color:var(--text-muted);margin-left:auto;">${item.scout?.fullName || item.scout?.username || 'Unknown'}</span>
                            </div>
                        `).join('')}
                        ${pendingItems.length > 5 ? `<div style="text-align:center;margin-top:8px;"><a href="#" data-view="pending" style="color:var(--green-primary);font-size:13px;font-weight:500;text-decoration:none;">View all ${pendingItems.length} →</a></div>` : ''}
                    `}
                </div>
                
                <!-- ACTIVE TICKETS -->
                <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                        <h3 style="color:var(--text-dark);font-size:17px;margin:0;">🎫 Active Tickets</h3>
                        <a href="#" data-view="tickets" style="color:var(--green-primary);font-size:13px;font-weight:500;text-decoration:none;">View All →</a>
                    </div>
                    ${activeTickets.length === 0 ? `
                        <p style="color:var(--text-muted);font-size:14px;text-align:center;padding:12px 0;">No active tickets. 🎉</p>
                    ` : `
                        ${activeTickets.slice(0, 3).map(t => `
                            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f5f0f8;cursor:pointer;" onclick="window.location.href='report-viewer-ticket.html?ticketId=${t.id}'">
                                <span style="font-size:20px;">${t.badgeIcon || '🏅'}</span>
                                <div style="flex:1;">
                                    <div style="font-size:13px;font-weight:500;color:var(--text-dark);">${t.badgeName}</div>
                                    <div style="font-size:11px;color:var(--text-muted);">${t.scoutName} · ${t.status}</div>
                                </div>
                                <span style="font-size:11px;background:#fde8d0;color:#d35400;padding:2px 8px;border-radius:10px;">${t.status === 'pending' ? '⏳' : t.status === 'requirements_added' ? '📋' : '📤'}</span>
                            </div>
                        `).join('')}
                        ${activeTickets.length > 3 ? `<div style="text-align:center;margin-top:8px;color:var(--text-muted);font-size:12px;">+${activeTickets.length - 3} more</div>` : ''}
                    `}
                </div>
            </div>

            <!-- ─── RIGHT COLUMN ─── -->
            <div style="display:flex;flex-direction:column;gap:20px;">

                <!-- PATROL OVERVIEW -->
                <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                    <h3 style="color:var(--text-dark);font-size:17px;margin-bottom:16px;">🦅 Patrol Overview</h3>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:16px;">
                        ${patrolData.map(p => {
                            const circumference = 2 * Math.PI * 22;
                            const offset = circumference * (1 - p.pct / 100);
                            return `
                                <div style="text-align:center;">
                                    <div style="position:relative;width:70px;height:70px;margin:0 auto;">
                                        <svg viewBox="0 0 60 60" style="width:100%;height:100%;transform:rotate(-90deg);">
                                            <circle cx="30" cy="30" r="22" fill="none" stroke="#e8e0f0" stroke-width="5"/>
                                            <circle cx="30" cy="30" r="22" fill="none" stroke="${p.color}" stroke-width="5"
                                                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                                                stroke-linecap="round"/>
                                        </svg>
                                        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
                                            <div style="font-size:16px;font-weight:700;color:var(--text-dark);">${p.pct}%</div>
                                        </div>
                                    </div>
                                    <div style="font-size:12px;font-weight:600;color:var(--text-dark);margin-top:4px;">${p.name}</div>
                                    <div style="font-size:10px;color:var(--text-muted);">${p.completed}/${p.total} completed</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- ATTENDANCE OVERVIEW -->
                <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                    <h3 style="color:var(--text-dark);font-size:17px;margin-bottom:16px;">📊 Attendance Overview</h3>
                    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
                        <div style="position:relative;width:100px;height:100px;flex-shrink:0;">
                            <svg viewBox="0 0 120 120" style="width:100%;height:100%;transform:rotate(-90deg);">
                                <circle cx="60" cy="60" r="45" fill="none" stroke="#e8e0f0" stroke-width="10"/>
                                <circle cx="60" cy="60" r="45" fill="none" stroke="#4caf50" stroke-width="10"
                                    stroke-dasharray="282.74" stroke-dashoffset="${282.74 * (1 - attendancePct / 100)}"
                                    stroke-linecap="round"/>
                            </svg>
                            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
                                <div style="font-size:24px;font-weight:700;color:var(--text-dark);">${attendancePct}%</div>
                                <div style="font-size:10px;color:var(--text-muted);">Overall</div>
                            </div>
                        </div>
                        <div>
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                                <span style="font-weight:600;color:var(--text-dark);">${allSessions.length}</span>
                                <span style="color:var(--text-muted);font-size:14px;">total sessions</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span style="font-weight:600;color:var(--text-dark);">${allScouts.length}</span>
                                <span style="color:var(--text-muted);font-size:14px;">scouts</span>
                            </div>
                            <div style="margin-top:8px;font-size:13px;color:var(--text-muted);">
                                ${attendancePct >= 70 ? '✅ Good attendance rate' : '⚠️ Attendance needs improvement'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    pageContent.innerHTML = html;

    // ─── Event listeners ──────────────────────────────────────
    document.querySelectorAll('a[data-view]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            currentView = this.dataset.view;
            selectedScout = null;
            renderView();
        });
    });

    window.selectScout = function(username) {
        selectedScout = username;
        renderView();
    };
}

// ─── LEADER TICKETS ──────────────────────────────────────────
async function renderLeaderTickets() {
    try {
        const module = await import('./tickets.js');
        const result = await module.getAllTickets();
        
        if (!result.success) {
            pageContent.innerHTML = `<p style="color:red;">Error loading tickets: ${result.error}</p>`;
            return;
        }
        
        const tickets = result.data;
        const activeTickets = tickets.filter(t => 
            t.status === 'pending' || 
            t.status === 'requirements_added' || 
            t.status === 'report_submitted'
        );
        
        // ─── Status config ──────────────────────────────────────
        const statusConfig = {
            pending: { label: '⏳ Pending', color: '#f39c12', bg: '#fef9e7' },
            requirements_added: { label: '📋 Requirements Added', color: '#8e44ad', bg: '#f4ecf7' },
            report_submitted: { label: '📤 Report Submitted', color: '#e67e22', bg: '#fdf2e9' },
            approved: { label: '✅ Approved', color: '#27ae60', bg: '#d4edda' },
            rejected: { label: '❌ Rejected', color: '#e74c3c', bg: '#f8d7da' },
            cancelled: { label: '🚫 Cancelled', color: '#95a5a6', bg: '#e8e0f0' }
        };
        
        let html = `
            <div style="max-width:900px;margin:0 auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
                    <h2 style="color:var(--text-dark);margin:0;">🎫 Tickets <span style="font-size:14px;color:var(--text-muted);font-weight:400;">(${activeTickets.length} active)</span></h2>
                    ${activeTickets.length > 0 ? `<span style="background:#e74c3c;color:white;padding:4px 16px;border-radius:20px;font-size:14px;font-weight:600;">${activeTickets.length} pending</span>` : ''}
                </div>
                
                <div style="display:flex;flex-direction:column;gap:12px;">
        `;
        
        if (activeTickets.length === 0) {
            html += `
                <div style="background:white;border-radius:24px;padding:60px 20px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:16px;">🎫</div>
                    <p style="color:var(--text-muted);font-size:16px;">No active tickets. All caught up! 🎉</p>
                </div>
            `;
        }
        
        for (const ticket of activeTickets) {
            const status = statusConfig[ticket.status] || statusConfig.pending;
            const scoutName = ticket.scoutName || 'Unknown Scout';
            const date = ticket.createdAt?.seconds ? 
                new Date(ticket.createdAt.seconds * 1000).toLocaleDateString() : 
                'Recently';
            
            // ─── Determine action buttons based on status ──────
            let actionsHtml = '';
            
            if (ticket.status === 'pending') {
                actionsHtml = `
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid #e8e0f0;">
                        <input type="text" id="req-input-${ticket.id}" placeholder="Add requirements..." style="flex:1;min-width:150px;padding:6px 12px;border-radius:8px;border:1px solid #e0d6ec;font-size:13px;" />
                        <button class="save-req-btn" data-ticket-id="${ticket.id}" style="background:#8e44ad;color:white;border:none;padding:6px 16px;border-radius:8px;font-size:13px;cursor:pointer;">📋 Add Requirements</button>
                        <button class="reject-ticket-btn" data-ticket-id="${ticket.id}" style="background:#e74c3c;color:white;border:none;padding:6px 16px;border-radius:8px;font-size:13px;cursor:pointer;">❌ Reject</button>
                    </div>
                `;
            } else if (ticket.status === 'requirements_added') {
                actionsHtml = `
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid #e8e0f0;">
                        <button class="view-report-btn" data-ticket-id="${ticket.id}" style="background:#3498db;color:white;border:none;padding:6px 16px;border-radius:8px;font-size:13px;cursor:pointer;">📄 View Report</button>
                        <button class="approve-ticket-btn" data-ticket-id="${ticket.id}" style="background:#27ae60;color:white;border:none;padding:6px 16px;border-radius:8px;font-size:13px;cursor:pointer;">✅ Approve</button>
                        <button class="reject-ticket-btn" data-ticket-id="${ticket.id}" style="background:#e74c3c;color:white;border:none;padding:6px 16px;border-radius:8px;font-size:13px;cursor:pointer;">❌ Reject</button>
                    </div>
                `;
            } else if (ticket.status === 'report_submitted') {
                actionsHtml = `
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid #e8e0f0;">
                        <button class="view-report-btn" data-ticket-id="${ticket.id}" style="background:#3498db;color:white;border:none;padding:6px 16px;border-radius:8px;font-size:13px;cursor:pointer;">📄 View Report</button>
                        <button class="approve-ticket-btn" data-ticket-id="${ticket.id}" style="background:#27ae60;color:white;border:none;padding:6px 16px;border-radius:8px;font-size:13px;cursor:pointer;">✅ Approve</button>
                        <button class="reject-ticket-btn" data-ticket-id="${ticket.id}" style="background:#e74c3c;color:white;border:none;padding:6px 16px;border-radius:8px;font-size:13px;cursor:pointer;">❌ Reject</button>
                    </div>
                `;
            }
            
            html += `
                <div style="background:white;border-radius:16px;padding:16px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);border-left:4px solid ${status.color};cursor:pointer;" onclick="window.location.href='report-viewer-ticket.html?ticketId=${ticket.id}'">
                    <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px;">
                        <div style="flex:1;">
                            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                                <span style="font-weight:600;font-size:16px;">${ticket.badgeIcon || '🏅'} ${ticket.badgeName}</span>
                                <span style="font-size:12px;color:var(--text-muted);">— ${scoutName}</span>
                                <span style="font-size:11px;background:${status.bg};color:${status.color};padding:2px 10px;border-radius:12px;font-weight:500;">${status.label}</span>
                            </div>
                            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
                                ${ticket.requestNote ? `📝 "${ticket.requestNote}"` : ''}
                                <span style="margin-left:12px;">📅 ${date}</span>
                            </div>
                            ${ticket.requirements ? `
                                <div style="font-size:13px;color:#3d2b1f;margin-top:6px;padding:8px 12px;background:#f5f0f8;border-radius:8px;border-left:3px solid #8e44ad;">
                                    📋 ${ticket.requirements}
                                    ${ticket.requirementsImage ? ` <span style="font-size:11px;color:#8e44ad;">[has image]</span>` : ''}
                                </div>
                            ` : ''}
                            ${ticket.reportText ? `
                                <div style="font-size:13px;color:#3d2b1f;margin-top:6px;padding:8px 12px;background:#fdf2e9;border-radius:8px;border-left:3px solid #e67e22;">
                                    📤 Report: ${ticket.reportText.substring(0, 60)}${ticket.reportText.length > 60 ? '...' : ''}
                                    ${ticket.reportImages?.length ? ` <span style="font-size:11px;color:#e67e22;">(${ticket.reportImages.length} images)</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    ${actionsHtml}
                </div>
            `;
        }
        
        html += '</div></div>';
        pageContent.innerHTML = html;
        
        // ─── Event listeners ──────────────────────────────────────
        // Save Requirements
        document.querySelectorAll('.save-req-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const ticketId = this.dataset.ticketId;
                const input = document.getElementById(`req-input-${ticketId}`);
                const requirements = input.value.trim();
                
                if (!requirements) {
                    alert('Please enter requirements.');
                    return;
                }
                
                const module = await import('./tickets.js');
                const result = await module.addRequirements(ticketId, requirements, null, currentUser.username);
                if (result.success) {
                    alert('✅ Requirements saved! Scout has been notified.');
                    renderLeaderTickets();
                } else {
                    alert('Error: ' + result.error);
                }
            });
        });
        
        // View Report
        document.querySelectorAll('.view-report-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const ticketId = this.dataset.ticketId;
                window.location.href = `report-viewer-ticket.html?ticketId=${ticketId}`;
            });
        });
        
        // Approve Ticket
        document.querySelectorAll('.approve-ticket-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const ticketId = this.dataset.ticketId;
                if (!confirm('Approve this ticket? The badge will be unlocked for the scout.')) return;
                
                const module = await import('./tickets.js');
                const result = await module.approveTicket(ticketId, 'Approved by leader');
                if (result.success) {
                    // Try to unlock the badge in local storage
                    try {
                        const ticket = (await module.getTicketById(ticketId)).data;
                        if (ticket) {
                            const pouch = JSON.parse(localStorage.getItem('badgePouch') || '[]');
                            const badge = pouch.find(b => b.id === ticket.badgeId);
                            if (badge) {
                                badge.unlocked = true;
                                localStorage.setItem('badgePouch', JSON.stringify(pouch));
                            }
                        }
                    } catch (e) { console.warn('Could not update local badge state:', e); }
                    alert('🎉 Badge unlocked for scout!');
                    renderLeaderTickets();
                } else {
                    alert('Error: ' + result.error);
                }
            });
        });
        
        // Reject Ticket
        document.querySelectorAll('.reject-ticket-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const ticketId = this.dataset.ticketId;
                const reason = prompt('Why are you rejecting this ticket? (Optional)');
                if (!confirm('Reject this ticket?')) return;
                
                const module = await import('./tickets.js');
                const result = await module.rejectTicket(ticketId, reason || 'Rejected by leader');
                if (result.success) {
                    alert('Ticket rejected.');
                    renderLeaderTickets();
                } else {
                    alert('Error: ' + result.error);
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading tickets:', error);
        pageContent.innerHTML = `<p style="color:red;">Failed to load tickets. Check console.</p>`;
    }
}

// ─── All Scouts ──────────────────────────────────────────
function renderAllScouts() {
    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
            <span style="color:var(--text-muted);font-size:14px;">${allScouts.length} scouts</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    `;

    for (const scout of allScouts) {
        const status = allStatus[scout.username] || {};
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
        
        const scoutNote = scout.note || '';
        
        // ─── Get earned badges for this scout ──────────────────
        const scoutTickets = allTickets.filter(t => 
            t.scoutName === scout.username && t.status === 'approved'
        );
        const badgeCount = scoutTickets.length;

        html += `
            <div class="scout-card" data-username="${scout.username}" style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;">
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
                    <div style="background:#e8e0f0;border-radius:20px;height:8px;overflow:hidden;">
                        <div style="background:#7bcb7b;height:100%;width:${pct}%;border-radius:20px;"></div>
                    </div>
                </div>
                
                ${badgeCount > 0 ? `
                    <div style="margin-top:6px;font-size:11px;color:#00897b;">
                        🏅 ${badgeCount} badge${badgeCount > 1 ? 's' : ''} earned
                    </div>
                ` : ''}
                
                ${scoutNote ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted);font-style:italic;border-top:1px solid #e8e0f0;padding-top:8px;">${scoutNote}</div>` : ''}
            </div>
        `;
    }

    html += '</div>';
    pageContent.innerHTML = html;

    document.querySelectorAll('.scout-card').forEach(card => {
        card.addEventListener('click', function() {
            selectedScout = this.dataset.username;
            renderView();
        });
    });
}

// ─── Scout Profile ──────────────────────────────────────────
async function renderScoutProfile(username) {
    const scout = allScouts.find(s => s.username === username);
    if (!scout) {
        pageContent.innerHTML = `<p>Scout not found.</p>`;
        return;
    }

    const status = allStatus[username] || {};
    const rank = scout.rank || 'Membership';
    const badges = getBadgesForRank(rank);
    const role = scout.scoutRole || 'Scout';
    const promo = isReadyForPromotion(username);

    const attendedSessions = allSessions.filter(s => s.attendance && s.attendance[username] === true);
    const totalHours = attendedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    
    // ─── Get earned badges for this scout ──────────────────
    const scoutTickets = allTickets.filter(t => 
        t.scoutName === username && t.status === 'approved'
    );

    let html = `
        <div style="margin-bottom:24px;">
            <button id="back-to-scouts" style="background:none;border:none;color:var(--green-primary);font-size:16px;cursor:pointer;display:flex;align-items:center;gap:8px;">← Back to All Scouts</button>
        </div>

        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="color:var(--text-dark);margin:0;">${scout.fullName || scout.username}</h2>
                    <div style="color:var(--text-muted);margin-top:4px;">${scout.patrol || 'No patrol'} · ${rank}</div>
                    <div style="color:var(--text-muted);font-size:14px;margin-top:4px;">Role: ${role}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:14px;color:var(--text-muted);">DOB: ${scout.dob || 'Not set'}</div>
                    <div style="font-size:14px;color:var(--text-muted);">Joined: ${scout.joinDate || 'Not set'}</div>
                    <div style="font-size:14px;color:var(--text-muted);">${totalHours}h service</div>
                </div>
            </div>
            ${scout.emergencyContact ? `
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e8e0f0;">
                    <div style="font-weight:600;font-size:14px;">Emergency Contact</div>
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
                        <span style="color:#6b8e23;font-weight:500;">Ready for promotion: ${promo.currentRank} → ${promo.nextRank}</span>
                        <button class="promote-btn" data-username="${username}" style="background:linear-gradient(135deg,#b8860b,#6b8e23);color:white;border:none;padding:6px 20px;border-radius:20px;font-size:14px;cursor:pointer;font-weight:500;">Promote Now</button>
                    </div>
                </div>
            ` : ''}
        </div>

        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">Leadership Roles</h3>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${['Scout', 'Patrol Leader', 'Assistant Patrol Leader', 'Senior Patrol Leader', 'Quartermaster', 'Scribe', 'Treasurer'].map(r => `
                    <button class="role-btn" data-username="${username}" data-role="${r}" style="padding:6px 16px;border-radius:20px;border:2px solid ${role === r ? 'var(--green-primary)' : '#e0d6ec'};background:${role === r ? 'var(--green-primary)' : 'white'};color:${role === r ? 'white' : 'var(--text-dark)'};cursor:pointer;font-size:13px;transition:all 0.2s;">${r}</button>
                `).join('')}
            </div>
            <div id="role-message" style="margin-top:8px;font-size:13px;color:var(--text-muted);"></div>
        </div>

        <div style="margin-bottom:20px;">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">Badge Progress</h3>
    `;

    for (const badge of badges) {
        const color = badgeColors[badge.key];
        let done = 0;
        let reqHtml = '';
        for (const req of badge.reqs) {
            const key = `${badge.key}_${req}`;
            const data = status[key];
            const statusText = data ? data.status : 'todo';
            
            let statusDisplay = '';
            if (statusText === 'approved') {
                statusDisplay = `<span style="font-size:12px;color:#155724;background:#d4edda;padding:2px 8px;border-radius:12px;">Complete</span>`;
            } else if (statusText === 'pending') {
                statusDisplay = `<span style="font-size:12px;color:#856404;background:#fff3cd;padding:2px 8px;border-radius:12px;">Pending</span>`;
            } else {
                statusDisplay = `<span style="font-size:12px;color:var(--text-muted);">Todo</span>`;
            }
            
            const reportKey = `${badge.key}_${req}_report`;
            const hasReport = status[reportKey] && (status[reportKey].note || (status[reportKey].images && status[reportKey].images.length > 0));
            
            reqHtml += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f5f0f8;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:14px;">${req}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        ${hasReport ? `<a href="report-viewer.html?email=${username}&tab=${badge.key}&req=${encodeURIComponent(req)}" style="font-size:11px;color:var(--green-primary);text-decoration:underline;cursor:pointer;">View Report</a>` : ''}
                        ${statusDisplay}
                        <button class="approve-req-btn" data-username="${username}" data-field="${key}" style="background:var(--green-primary);color:white;border:none;padding:2px 12px;border-radius:12px;font-size:11px;cursor:pointer;">Approve</button>
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

    // ─── BADGES SECTION (NEW — like membership/first/second) ──
    html += `
        <div style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-weight:600;color:#00897b;">🏅 Badges</span>
                <span style="font-size:14px;color:var(--text-muted);">${scoutTickets.length} earned</span>
            </div>
            ${scoutTickets.length > 0 ? `
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:10px;">
                    ${scoutTickets.map(t => `
                        <div style="text-align:center;padding:10px;background:#f5f0f8;border-radius:12px;border:1px solid #b8a080;cursor:pointer;transition:transform 0.2s;" 
                             onclick="window.location.href='report-viewer-ticket.html?ticketId=${t.id}'"
                             onmouseover="this.style.transform='scale(1.05)'" 
                             onmouseout="this.style.transform='scale(1)'">
                            <div style="font-size:32px;">${t.badgeIcon || '🏅'}</div>
                            <div style="font-size:10px;color:#3d2b1f;font-weight:500;margin-top:4px;">${t.badgeName}</div>
                            <div style="font-size:8px;color:#27ae60;font-weight:600;">✅ Earned</div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="text-align:center;padding:16px;color:#8b7a6a;font-style:italic;font-size:13px;">
                    No badges earned yet.
                </div>
            `}
        </div>
    `;

    html += `
        </div>

        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">Leader Note</h3>
            <textarea id="leader-note" style="width:100%;padding:12px;border-radius:12px;border:1px solid #e0d6ec;font-family:inherit;font-size:14px;min-height:80px;resize:vertical;">${scout.note || ''}</textarea>
            <button id="save-leader-note" class="btn-primary" style="margin-top:12px;background:var(--green-primary);color:white;border:none;padding:10px 24px;border-radius:40px;font-size:14px;font-weight:600;cursor:pointer;">Save Note</button>
            <div id="note-message" style="margin-top:8px;font-size:13px;color:var(--text-muted);"></div>
        </div>

        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <h3 style="color:var(--text-dark);margin-bottom:16px;">Attendance & Sessions</h3>
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
            await setDoc(doc(db, 'users', username), { note: note }, { merge: true });
            const scout = allScouts.find(s => s.username === username);
            if (scout) scout.note = note;
            message.textContent = 'Note saved successfully!';
            message.style.color = '#4caf50';
        } catch (error) {
            message.textContent = 'Error saving note: ' + error.message;
            message.style.color = '#e74c3c';
        }
    });

    document.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const username = this.dataset.username;
            const scout = allScouts.find(s => s.username === username);
            if (!scout) return;
            
            const promo = isReadyForPromotion(username);
            if (!promo) return;
            
            if (confirm(`Promote ${scout.fullName || scout.username} from ${promo.currentRank} to ${promo.nextRank}?`)) {
                try {
                    await setDoc(doc(db, 'users', username), { rank: promo.nextRank }, { merge: true });
                    scout.rank = promo.nextRank;
                    alert(`${scout.fullName || scout.username} promoted to ${promo.nextRank}!`);
                } catch (error) {
                    alert('Error promoting: ' + error.message);
                }
            }
        });
    });

    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const scoutUsername = this.dataset.username;
            const newRole = this.dataset.role;
            try {
                await setDoc(doc(db, 'users', scoutUsername), { scoutRole: newRole }, { merge: true });
                document.getElementById('role-message').textContent = `Role updated to: ${newRole}`;
                document.getElementById('role-message').style.color = '#4caf50';
                const scout = allScouts.find(s => s.username === scoutUsername);
                if (scout) scout.scoutRole = newRole;
                setTimeout(() => renderScoutProfile(scoutUsername), 1000);
            } catch (error) {
                document.getElementById('role-message').textContent = 'Error: ' + error.message;
                document.getElementById('role-message').style.color = '#e74c3c';
            }
        });
    });

    document.querySelectorAll('.approve-req-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const scoutUsername = this.dataset.username;
            const field = this.dataset.field;
            
            try {
                const docRef = doc(db, 'scoutStatus', scoutUsername);
                const docSnap = await getDoc(docRef);
                const data = docSnap.data() || {};
                data[field] = { 
                    status: 'approved', 
                    approvedBy: currentUser.username,
                    approvedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await setDoc(docRef, data);
                
                allStatus = {};
                const statusSnap = await getDocs(collection(db, 'scoutStatus'));
                statusSnap.forEach(doc => {
                    allStatus[doc.id] = doc.data();
                });
                updatePendingBadge();
                renderScoutProfile(scoutUsername);
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
        const status = allStatus[scout.username] || {};
        
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
        
        const promo = isReadyForPromotion(scout.username);
        if (promo) {
            readyForPromotion.push({ scout, promo });
        }
    }
    
    // ─── Add ticket pending items ──────────────────────────
    const activeTickets = allTickets.filter(t => 
        t.status === 'pending' || 
        t.status === 'requirements_added' || 
        t.status === 'report_submitted'
    );
    for (const ticket of activeTickets) {
        const scout = allScouts.find(s => s.username === ticket.scoutName);
        pendingItems.push({
            scout: scout || { username: ticket.scoutName, fullName: ticket.scoutName },
            field: `ticket_${ticket.id}`,
            reqName: `🎫 ${ticket.badgeName}`,
            badgeType: 'ticket',
            status: { status: ticket.status }
        });
    }

    const order = { membership: 0, secondClass: 1, firstClass: 2, badge: 3, ticket: 4 };
    pendingItems.sort((a, b) => order[a.badgeType] - order[b.badgeType]);

    const totalPending = pendingItems.length + readyForPromotion.length;

    let html = `
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#7bcb7b;color:white;font-size:12px;font-weight:500;">Membership</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#4caf50;color:white;font-size:12px;font-weight:500;">Second Class</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#2e7d32;color:white;font-size:12px;font-weight:500;">First Class</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#00897b;color:white;font-size:12px;font-weight:500;">Badges</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:#e67e22;color:white;font-size:12px;font-weight:500;">🎫 Tickets</span>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:linear-gradient(135deg,#b8860b,#6b8e23);color:white;font-size:12px;font-weight:500;">Ready for Promotion</span>
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
        let color, label, border;
        if (item.badgeType === 'ticket') {
            color = { bg: '#fdf2e9', text: '#e67e22', border: '#e67e22' };
            label = 'Badge Request';
            border = '#e67e22';
        } else {
            const info = getBadgeInfo(item.field);
            color = info;
            label = getBadgeLabel(item.field);
            border = info.border;
        }
        const name = item.scout?.fullName || item.scout?.username || 'Unknown';

        let statusDisplay = '';
        if (item.badgeType === 'ticket') {
            const statusMap = {
                'pending': '⏳ Pending',
                'requirements_added': '📋 Requirements Added',
                'report_submitted': '📤 Report Submitted'
            };
            statusDisplay = statusMap[item.status.status] || item.status.status;
        } else {
            statusDisplay = item.status.status === 'pending' ? '⏳ Pending' : '';
        }

        html += `
            <div style="background:white;border-radius:16px;padding:16px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-left:4px solid ${border};">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:${border};"></span>
                    <span style="font-size:12px;font-weight:600;color:${color.text};background:${color.bg};padding:2px 10px;border-radius:8px;">${label}</span>
                    <span style="font-weight:500;">${item.reqName}</span>
                    <span style="color:var(--text-muted);font-size:14px;">— ${name}</span>
                    ${statusDisplay ? `<span style="font-size:12px;color:var(--text-muted);">${statusDisplay}</span>` : ''}
                </div>
                ${item.badgeType === 'ticket' ? `
                    <div style="display:flex;gap:8px;">
                        <button class="view-ticket-btn" data-ticket-id="${item.field.replace('ticket_', '')}" style="background:#3498db;color:white;border:none;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;cursor:pointer;">View Ticket</button>
                    </div>
                ` : `
                    <div style="display:flex;gap:8px;">
                        <button class="approve-btn" data-username="${item.scout?.username}" data-field="${item.field}" style="background:#4caf50;color:white;border:none;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;cursor:pointer;">Approve</button>
                        <button class="reject-btn" data-username="${item.scout?.username}" data-field="${item.field}" style="background:#e74c3c;color:white;border:none;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;cursor:pointer;">Reject</button>
                    </div>
                `}
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
                    <span style="font-size:12px;font-weight:600;color:white;background:${goldenGreen};padding:2px 10px;border-radius:8px;">Ready for Promotion</span>
                    <span style="font-weight:500;">${name}</span>
                    <span style="color:var(--text-muted);font-size:14px;">${item.promo.currentRank} → ${item.promo.nextRank}</span>
                </div>
                <button class="promote-btn" data-username="${item.scout.username}" style="background:${goldenGreen};color:white;border:none;padding:6px 20px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(184,134,11,0.3);">Promote Now</button>
            </div>
        `;
    }

    html += '</div>';
    pageContent.innerHTML = html;

    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const username = this.dataset.username;
            const field = this.dataset.field;
            
            const docRef = doc(db, 'scoutStatus', username);
            const docSnap = await getDoc(docRef);
            const data = docSnap.data() || {};
            data[field] = { 
                status: 'approved', 
                approvedBy: currentUser.username,
                approvedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
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
            const username = this.dataset.username;
            const field = this.dataset.field;
            const docRef = doc(db, 'scoutStatus', username);
            const docSnap = await getDoc(docRef);
            const data = docSnap.data() || {};
            data[field] = { status: 'todo', updatedAt: new Date().toISOString() };
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

    document.querySelectorAll('.view-ticket-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const ticketId = this.dataset.ticketId;
            window.location.href = `report-viewer-ticket.html?ticketId=${ticketId}`;
        });
    });

    document.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const username = this.dataset.username;
            const scout = allScouts.find(s => s.username === username);
            if (!scout) return;
            
            const promo = isReadyForPromotion(username);
            if (!promo) return;
            
            if (confirm(`Promote ${scout.fullName || scout.username} from ${promo.currentRank} to ${promo.nextRank}?`)) {
                try {
                    await setDoc(doc(db, 'users', username), { rank: promo.nextRank }, { merge: true });
                    scout.rank = promo.nextRank;
                    alert(`${scout.fullName || scout.username} promoted to ${promo.nextRank}!`);
                } catch (error) {
                    alert('Error promoting: ' + error.message);
                }
            }
        });
    });
}

// ─── Sessions View ──────────────────────────────────────
function renderSessions() {
    let totalSessions = allSessions.length;
    let totalHours = 0;

    for (const session of allSessions) {
        totalHours += session.duration || 0;
    }

    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <div></div>
            <a href="new-session.html" style="background:var(--green-primary);color:white;border:none;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;box-shadow:0 2px 8px rgba(46,125,50,0.3);transition:transform 0.2s,box-shadow 0.2s;">New Session</a>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px;">
            <div style="background:white;border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:28px;font-weight:700;color:var(--green-primary);">${totalSessions}</div>
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
        const isAttending = session.attendance ? session.attendance[currentUser.username] === true : false;
        
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
                            <span class="session-name">${session.name}</span>
                            <span style="font-size:11px;background:${statusColor};color:white;padding:2px 12px;border-radius:12px;font-weight:500;">${statusBadge}</span>
                        </div>
                        <div class="session-meta">
                            ${session.date} · ${session.time} · ${session.location || 'TBD'}
                        </div>
                        ${session.purpose ? `<div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${session.purpose}</div>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <div style="text-align:center;">
                            <div style="font-size:20px;font-weight:700;color:var(--green-primary);">${session.duration || 0}</div>
                            <div style="font-size:10px;color:var(--text-muted);">hours</div>
                        </div>
                        <div style="text-align:center;min-width:45px;">
                            <div style="font-size:18px;font-weight:600;color:#8fbcbb;">${attendeeCount}</div>
                            <div style="font-size:10px;color:var(--text-muted);">attended</div>
                        </div>
                        ${isAttending ? '<span style="background:#d4edda;color:#155724;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:500;">Attended</span>' : ''}
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

// ─── EXPORT FUNCTION ──────────────────────────────────────────
function renderExport() {
    let html = `
        <div style="max-width:700px;margin:0 auto;">
            <div style="background:white;border-radius:24px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <h2 style="color:var(--text-dark);margin:0 0 8px 0;">📤 Export Data</h2>
                <p style="color:var(--text-muted);font-size:14px;margin-bottom:24px;">Export all scout data as a CSV file.</p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
                    <div style="background:#f8f5fa;border-radius:16px;padding:16px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:var(--green-primary);">${allScouts.length}</div>
                        <div style="font-size:13px;color:var(--text-muted);">Scouts to Export</div>
                    </div>
                    <div style="background:#f8f5fa;border-radius:16px;padding:16px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:var(--gold);">${allSessions.length}</div>
                        <div style="font-size:13px;color:var(--text-muted);">Sessions</div>
                    </div>
                </div>

                <button id="export-btn" style="background:var(--green-primary);color:white;border:none;padding:14px 32px;border-radius:40px;font-size:16px;font-weight:600;cursor:pointer;width:100%;transition:background 0.2s;">
                    📥 Download CSV
                </button>
                <div id="export-message" style="margin-top:12px;font-size:14px;color:var(--text-muted);text-align:center;"></div>
            </div>
        </div>
    `;

    pageContent.innerHTML = html;

    document.getElementById('export-btn').addEventListener('click', async function() {
        const message = document.getElementById('export-message');
        message.textContent = '⏳ Generating export...';
        message.style.color = '#8a9e96';

        try {
            const csv = await generateCSV();
            downloadCSV(csv);
            message.textContent = '✅ Export complete! File downloaded.';
            message.style.color = '#4caf50';
        } catch (error) {
            message.textContent = '❌ Error: ' + error.message;
            message.style.color = '#e74c3c';
            console.error(error);
        }
    });
}

// ─── Generate CSV ──────────────────────────────────────────
async function generateCSV() {
    const rows = [];
    
    const headers = [
        'Scout Name', 'Username', 'Patrol', 'Rank', 'Role', 'DOB', 'Join Date',
        'Membership Requirements', 'Second Class Requirements', 'First Class Requirements',
        'Badges Earned', 'Total Service Hours', 'Sessions Attended',
        'Allergies', 'Medical Conditions', 'Medications', 'Health Last Updated'
    ];
    rows.push(headers.join(','));

    for (const scout of allScouts) {
        const status = allStatus[scout.username] || {};
        const health = scout.health || {};

        let membershipDone = 0;
        for (const req of membershipRequirements) {
            const key = `membership_${req}`;
            if (status[key]?.status === 'approved') membershipDone++;
        }

        let secondDone = 0;
        for (const req of secondClassRequirements) {
            const key = `secondClass_${req}`;
            if (status[key]?.status === 'approved') secondDone++;
        }

        let firstDone = 0;
        for (const req of firstClassRequirements) {
            const key = `firstClass_${req}`;
            if (status[key]?.status === 'approved') firstDone++;
        }

        // ─── Count earned badges from tickets ──────────────────
        const scoutTickets = allTickets.filter(t => 
            t.scoutName === scout.username && t.status === 'approved'
        );
        const badgesEarned = membershipDone + secondDone + firstDone + scoutTickets.length;

        let serviceHours = 0;
        let sessionsAttended = 0;
        for (const session of allSessions) {
            if (session.attendance && session.attendance[scout.username] === true) {
                sessionsAttended++;
                serviceHours += session.duration || 0;
            }
        }

        const row = [
            escapeCSV(scout.fullName || scout.username),
            scout.username,
            escapeCSV(scout.patrol || ''),
            scout.rank || 'Membership',
            scout.scoutRole || 'Scout',
            scout.dob || '',
            scout.joinDate || '',
            `${membershipDone}/${membershipRequirements.length}`,
            `${secondDone}/${secondClassRequirements.length}`,
            `${firstDone}/${firstClassRequirements.length}`,
            badgesEarned,
            serviceHours,
            sessionsAttended,
            escapeCSV(health.allergies || ''),
            escapeCSV(health.conditions || ''),
            escapeCSV(health.medications || ''),
            health.lastUpdated ? new Date(health.lastUpdated).toLocaleDateString() : ''
        ];

        rows.push(row.join(','));
    }

    return rows.join('\n');
}

// ─── Download CSV ──────────────────────────────────────────
function downloadCSV(csv) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scouts_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Escape CSV values ──────────────────────────────────────
function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// ─── LEADER PROFILE ──────────────────────────────────────────
async function renderLeaderProfile() {
    const userDoc = await getDoc(doc(db, 'users', currentUser.username));
    const data = userDoc.data();

    if (!data) {
        pageContent.innerHTML = `<p style="color:var(--text-muted);padding:40px;text-align:center;">Profile not found.</p>`;
        return;
    }

    const fullName = data.fullName || currentUser.username;
    const dob = data.dob || '';
    const role = data.role || 'Leader';
    const emergency = data.emergencyContact || {};
    const health = data.health || {};
    
    const healthLastUpdated = health.lastUpdated ? new Date(health.lastUpdated).toLocaleDateString() : 'Never';
    const healthDaysSince = health.lastUpdated ? Math.floor((new Date() - new Date(health.lastUpdated)) / (1000 * 60 * 60 * 24)) : 999;
    const healthStatus = healthDaysSince > 90 ? '⚠️ Needs update' : '✅ Up to date';
    const healthStatusColor = healthDaysSince > 90 ? '#d45a7a' : '#4caf50';

    let html = `
        <div style="max-width:600px;margin:0 auto;">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
                <span id="profile-back" style="cursor:pointer;color:var(--text-muted);font-size:18px;">←</span>
                <h2 style="color:var(--text-dark);margin:0;">My Profile</h2>
            </div>

            <div style="background:white;border-radius:24px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
                    <div class="person-avatar" style="width:80px;height:80px;background:#aed581;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;">
                        <div class="head" style="width:24px;height:24px;top:16px;"></div>
                        <div class="body" style="width:38px;height:22px;bottom:14px;"></div>
                    </div>
                    <div>
                        <div style="font-size:24px;font-weight:700;color:var(--text-dark);">${fullName}</div>
                        <div style="color:var(--text-muted);">${role}</div>
                    </div>
                </div>

                <form id="profile-form">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                        <div>
                            <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Full Name</label>
                            <input type="text" id="profile-fullname" value="${fullName}" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                        </div>
                        <div>
                            <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Date of Birth</label>
                            <input type="date" id="profile-dob" value="${dob}" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                        <div>
                            <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Role</label>
                            <select id="profile-role" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                                <option value="Leader" ${role === 'Leader' ? 'selected' : ''}>Leader</option>
                                <option value="Rover Leader" ${role === 'Rover Leader' ? 'selected' : ''}>Rover Leader</option>
                                <option value="GSL" ${role === 'GSL' ? 'selected' : ''}>GSL</option>
                                <option value="AGSL" ${role === 'AGSL' ? 'selected' : ''}>AGSL</option>
                                <option value="Advisor" ${role === 'Advisor' ? 'selected' : ''}>Advisor</option>
                                <option value="Section Head" ${role === 'Section Head' ? 'selected' : ''}>Section Head</option>
                            </select>
                        </div>
                    </div>

                    <!-- ─── HEALTH SECTION ─── -->
                    <div style="border-top:1px solid #e8e0f0;padding-top:16px;margin-top:16px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                            <div style="font-weight:600;font-size:16px;">🏥 Health Information</div>
                            <span style="font-size:12px;color:${healthStatusColor};">${healthStatus}</span>
                        </div>
                        
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                            <div>
                                <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;font-size:13px;">Allergies</label>
                                <input type="text" id="health-allergies" value="${health.allergies || ''}" placeholder="e.g., Peanuts, Shellfish" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                            </div>
                            <div>
                                <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;font-size:13px;">Medical Conditions</label>
                                <input type="text" id="health-conditions" value="${health.conditions || ''}" placeholder="e.g., Asthma, Diabetes" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
                            <div>
                                <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;font-size:13px;">Medications</label>
                                <input type="text" id="health-medications" value="${health.medications || ''}" placeholder="e.g., Inhaler" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                            </div>
                            <div>
                                <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;font-size:13px;">Additional Notes</label>
                                <input type="text" id="health-notes" value="${health.notes || ''}" placeholder="e.g., Carry inhaler at all times" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                            </div>
                        </div>
                        <div style="margin-top:8px;font-size:12px;color:var(--text-muted);">
                            Last updated: ${healthLastUpdated}
                            ${healthDaysSince > 90 ? ` ⚠️ Update needed (${healthDaysSince} days ago)` : ''}
                        </div>
                    </div>

                    <!-- ─── EMERGENCY CONTACT ─── -->
                    <div style="border-top:1px solid #e8e0f0;padding-top:16px;margin-top:16px;">
                        <div style="font-weight:600;margin-bottom:8px;">📞 Emergency Contact</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div>
                                <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Name</label>
                                <input type="text" id="profile-emergency-name" value="${emergency.name || ''}" placeholder="Full name" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                            </div>
                            <div>
                                <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Phone</label>
                                <input type="text" id="profile-emergency-phone" value="${emergency.phone || ''}" placeholder="+960 777-1234" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                            </div>
                        </div>
                        <div style="margin-top:8px;">
                            <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Relation</label>
                            <input type="text" id="profile-emergency-relation" value="${emergency.relation || ''}" placeholder="e.g., Father, Mother, Guardian" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                        </div>
                    </div>

                    <button type="submit" style="background:var(--green-primary);color:white;border:none;padding:12px 24px;border-radius:40px;font-weight:600;cursor:pointer;width:100%;margin-top:16px;">Save Profile</button>
                </form>

                <div id="profile-message" style="margin-top:16px;color:var(--text-muted);text-align:center;"></div>

                <div style="margin-top:16px;padding:12px;background:#e8f5e9;border-radius:12px;font-size:13px;color:var(--text-muted);text-align:center;">
                    Health information should be updated every 3 months.
                </div>
            </div>
        </div>
    `;

    pageContent.innerHTML = html;

    document.getElementById('profile-back').addEventListener('click', () => {
        currentView = 'dashboard';
        document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
        document.querySelector('.sidebar-nav a[data-view="dashboard"]')?.classList.add('active');
        renderView();
    });

    document.getElementById('profile-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        const fullName = document.getElementById('profile-fullname').value.trim();
        const dob = document.getElementById('profile-dob').value;
        const role = document.getElementById('profile-role').value;
        const emergencyName = document.getElementById('profile-emergency-name').value.trim();
        const emergencyPhone = document.getElementById('profile-emergency-phone').value.trim();
        const emergencyRelation = document.getElementById('profile-emergency-relation').value.trim();
        
        const allergies = document.getElementById('health-allergies').value.trim();
        const conditions = document.getElementById('health-conditions').value.trim();
        const medications = document.getElementById('health-medications').value.trim();
        const healthNotes = document.getElementById('health-notes').value.trim();

        const updateData = {
            fullName: fullName || currentUser.username,
            dob: dob || null,
            role: role,
            emergencyContact: {
                name: emergencyName || null,
                phone: emergencyPhone || null,
                relation: emergencyRelation || null
            },
            health: {
                allergies: allergies || null,
                conditions: conditions || null,
                medications: medications || null,
                notes: healthNotes || null,
                lastUpdated: new Date().toISOString()
            }
        };

        try {
            await setDoc(doc(db, 'users', currentUser.username), updateData, { merge: true });
            
            if (fullName) {
                displayName = fullName;
                if (sidebarName) sidebarName.textContent = fullName;
                if (sidebarRole) sidebarRole.textContent = role;
                if (pageHeading) {
                    pageHeading.innerHTML = `Good morning, <span style="color:var(--green-primary);">${fullName}</span>! 👋`;
                }
                const user = JSON.parse(localStorage.getItem('currentUser'));
                user.fullName = fullName;
                user.role = role;
                localStorage.setItem('currentUser', JSON.stringify(user));
            }
            
            document.getElementById('profile-message').textContent = '✅ Profile saved successfully!';
            document.getElementById('profile-message').style.color = '#4caf50';
            setTimeout(() => renderLeaderProfile(), 1200);
        } catch (error) {
            document.getElementById('profile-message').textContent = '❌ Error saving profile: ' + error.message;
            document.getElementById('profile-message').style.color = '#c47a7a';
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
    if (ticketsUnsubscribe) ticketsUnsubscribe();
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

// ─── Init ────────────────────────────────────────────────
async function init() {
    listenToUsers();
    listenToStatus();
    listenToSessions();
    listenToTickets();
    renderView();

    const hamburger = document.getElementById('hamburger-btn');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const mobileClose = document.getElementById('mobile-close-btn');

    function openMobileSidebar() {
        mobileSidebar.classList.add('open');
        mobileOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileSidebar() {
        mobileSidebar.classList.remove('open');
        mobileOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (hamburger) hamburger.addEventListener('click', openMobileSidebar);
    if (mobileClose) mobileClose.addEventListener('click', closeMobileSidebar);
    if (mobileOverlay) mobileOverlay.addEventListener('click', closeMobileSidebar);

    document.querySelectorAll('#mobile-sidebar .sidebar-nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const view = this.dataset.view;
            closeMobileSidebar();
            document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
            document.querySelector(`.sidebar-nav a[data-view="${view}"]`)?.classList.add('active');
            currentView = view;
            selectedScout = null;
            renderView();
        });
    });

    document.getElementById('mobile-profile-btn')?.addEventListener('click', () => {
        closeMobileSidebar();
        currentView = 'profile';
        document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
        renderView();
    });

    document.getElementById('mobile-logout-btn')?.addEventListener('click', () => {
        closeMobileSidebar();
        if (usersUnsubscribe) usersUnsubscribe();
        if (statusUnsubscribe) statusUnsubscribe();
        if (sessionsUnsubscribe) sessionsUnsubscribe();
        if (ticketsUnsubscribe) ticketsUnsubscribe();
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

init();
