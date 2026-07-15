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

// ─── UPDATE PENDING BADGE ──────────────────────────────
function updatePendingBadge() {
    // Count pending requirements
    let pendingCount = 0;
    for (const scout of allScouts) {
        const status = allStatus[scout.username] || {};
        for (const key in status) {
            if (status[key].status === 'pending') {
                if (key.startsWith('ticket_')) continue;
                pendingCount++;
            }
        }
    }
    
    // Count active tickets
    const activeTickets = allTickets.filter(t => 
        t.status === 'pending' || 
        t.status === 'requirements_added' || 
        t.status === 'report_submitted'
    );
    
    // ─── Update pending badge ──────────────────────────────
    const pendingBadge = document.getElementById('pending-badge');
    if (pendingBadge) {
        pendingBadge.textContent = pendingCount;
        pendingBadge.classList.toggle('visible', pendingCount > 0);
    }
    
    // ─── Update ticket badge ────────────────────────────────
    const ticketBadge = document.getElementById('leader-ticket-badge');
    if (ticketBadge) {
        ticketBadge.textContent = activeTickets.length;
        ticketBadge.classList.toggle('visible', activeTickets.length > 0);
    }
    
    // ─── Also update mobile badges ──────────────────────────
    const mobilePending = document.getElementById('mobile-pending-badge');
    if (mobilePending) {
        mobilePending.textContent = pendingCount;
        mobilePending.classList.toggle('visible', pendingCount > 0);
    }
    
    const mobileTicket = document.getElementById('mobile-ticket-badge');
    if (mobileTicket) {
        mobileTicket.textContent = activeTickets.length;
        mobileTicket.classList.toggle('visible', activeTickets.length > 0);
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
        pageHeading.textContent = '';
        if (pageSubtitle) pageSubtitle.textContent = '';
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
        pageHeading.textContent = 'Profile';
        if (pageSubtitle) pageSubtitle.textContent = 'Manage your personal information';
    } else if (currentView === 'tickets') {
        pageHeading.textContent = 'Tickets';
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
    
    if (currentView === 'dashboard') {
        renderDashboard();
    } else if (currentView === 'scouts') {
        renderAllScouts();
    } else if (currentView === 'pending') {
        renderPendingApprovals();
    } else if (currentView === 'sessions') {
        renderSessions();
    } else if (currentView === 'export') {
        renderExport();
    } else if (currentView === 'profile') {
        renderLeaderProfile();
    } else if (currentView === 'tickets') {
        renderLeaderTickets();
    }
}

// ─── RENDER DASHBOARD ──────────────────────────────────
function renderDashboard() {
    // ─── Calculate stats ──────────────────────────────────────
    const totalScouts = allScouts.length;
    let totalPending = 0;
    let totalServiceHours = 0;

    for (const scout of allScouts) {
        const status = allStatus[scout.username] || {};
        for (const key in status) {
            if (status[key].status === 'pending') {
                if (key.startsWith('ticket_')) continue;
                totalPending++;
            }
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

    // ─── Pending items (requirements only) ────────────────────
    const pendingItems = [];
    for (const scout of allScouts) {
        const status = allStatus[scout.username] || {};
        for (const key in status) {
            if (status[key].status === 'pending') {
                if (key.startsWith('ticket_')) continue;
                
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
    pendingItems.sort((a, b) => a.badgeType.localeCompare(b.badgeType));

    // ─── Patrol overview ──────────────────────────────────────
    const patrols = ['Eagle', 'Falcon', 'Wolf', 'Bear', 'Lion'];
    const patrolColors = {
        'Eagle': '#d4a017',
        'Falcon': '#2980b9',
        'Wolf': '#7f8c8d',
        'Bear': '#8d6e63',
        'Lion': '#d35400'
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
        <style>
            .campsite {
                max-width: 100%;
                padding: 0;
                font-family: 'Georgia', 'Times New Roman', serif;
                background: #f5ede0;
            }

            /* ─── STATS GRID ─── */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
                margin-bottom: 24px;
            }
            .stat-card {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 16px;
                text-align: center;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
                transition: transform 0.25s ease, box-shadow 0.25s ease;
            }
            .stat-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 24px rgba(91,46,122,0.10);
            }
            .stat-card .number {
                font-size: 28px;
                font-weight: 700;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .stat-card .label {
                font-size: 13px;
                color: #8b7a6a;
                font-family: 'Georgia', serif;
                margin-top: 4px;
            }
            .stat-card .stat-icon {
                font-size: 28px;
                margin-bottom: 4px;
                display: block;
            }

            /* ─── ALERT BANNER ─── */
            .alert-banner {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 16px 20px;
                margin-bottom: 24px;
                border: 1px solid #e0d4c0;
                border-left: 4px solid #d35400;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
            }
            .alert-banner .alert-header {
                font-weight: 600;
                color: #2d2a1e;
                margin-bottom: 8px;
                font-size: 15px;
            }
            .alert-banner .alert-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 12px;
                background: #f5ede0;
                border-radius: 8px;
                margin-top: 4px;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            .alert-banner .alert-item:hover {
                background: #e8dcc8;
            }
            .alert-banner .alert-item .name {
                font-size: 13px;
                font-weight: 500;
                color: #2d2a1e;
            }
            .alert-banner .alert-item .detail {
                font-size: 12px;
                color: #8b7a6a;
            }
            .alert-banner .alert-item .detail.critical {
                color: #d35400;
            }
            .alert-banner .alert-item .detail.warning {
                color: #f39c12;
            }
            .alert-banner .success-msg {
                color: #27ae60;
                font-size: 14px;
                padding: 4px 0;
            }

            /* ─── TWO COLUMN ─── */
            .two-col {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 24px;
            }

            /* ─── CARDS ─── */
            .card {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 20px 24px;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
                transition: transform 0.25s ease, box-shadow 0.25s ease;
            }
            .card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 24px rgba(91,46,122,0.10);
            }
            .card .card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .card .card-header .title {
                font-size: 16px;
                font-weight: 600;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .card .card-header .link {
                font-size: 13px;
                color: #5b2e7a;
                text-decoration: none;
                font-weight: 500;
                cursor: pointer;
                transition: color 0.2s ease;
            }
            .card .card-header .link:hover {
                color: #7d4a9e;
                text-decoration: underline;
            }
            .card .empty {
                text-align: center;
                padding: 16px 0;
                color: #8b7a6a;
                font-style: italic;
                font-size: 14px;
                font-family: 'Georgia', serif;
            }

            /* ─── PENDING ITEM ─── */
            .pending-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #e0d4c0;
            }
            .pending-item:last-child {
                border-bottom: none;
            }
            .pending-item .left {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .pending-item .left .color-dot {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .pending-item .left .req-name {
                font-size: 13px;
                font-weight: 500;
                color: #2d2a1e;
            }
            .pending-item .left .scout-name {
                font-size: 12px;
                color: #8b7a6a;
            }
            .pending-item .status-badge {
                font-size: 12px;
                color: #8b7a6a;
                font-weight: 500;
            }

            /* ─── TICKET ITEM ─── */
            .ticket-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #e0d4c0;
                cursor: pointer;
                transition: background 0.2s ease, padding 0.2s ease, border-radius 0.2s ease;
            }
            .ticket-item:hover {
                background: #f5ede0;
                margin: 0 -8px;
                padding: 8px 8px;
                border-radius: 8px;
            }
            .ticket-item:last-child {
                border-bottom: none;
            }
            .ticket-item .left {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .ticket-item .left .icon {
                font-size: 20px;
            }
            .ticket-item .left .info .name {
                font-size: 13px;
                font-weight: 500;
                color: #2d2a1e;
            }
            .ticket-item .left .info .meta {
                font-size: 11px;
                color: #8b7a6a;
            }
            .ticket-item .status-tag {
                font-size: 11px;
                font-weight: 600;
                padding: 2px 10px;
                border-radius: 20px;
                background: #fde8d0;
                color: #d35400;
            }
            .ticket-item .status-tag.requirements {
                background: #f4ecf7;
                color: #8e44ad;
            }
            .ticket-item .status-tag.report {
                background: #fdf2e9;
                color: #e67e22;
            }

            /* ─── PATROL RING ─── */
            .patrol-ring-wrapper {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
                gap: 16px;
            }
            .patrol-ring {
                text-align: center;
            }
            .patrol-ring .ring-container {
                position: relative;
                width: 70px;
                height: 70px;
                margin: 0 auto;
            }
            .patrol-ring .ring-container svg {
                transform: rotate(-90deg);
            }
            .patrol-ring .ring-container .ring-bg {
                fill: none;
                stroke: #e0d4c0;
                stroke-width: 5;
            }
            .patrol-ring .ring-container .ring-fill {
                fill: none;
                stroke-width: 5;
                stroke-linecap: round;
            }
            .patrol-ring .ring-container .center-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 16px;
                font-weight: 700;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .patrol-ring .ring-label {
                font-size: 12px;
                font-weight: 600;
                color: #2d2a1e;
                margin-top: 4px;
                font-family: 'Georgia', serif;
            }
            .patrol-ring .ring-sub {
                font-size: 10px;
                color: #8b7a6a;
                font-family: 'Georgia', serif;
            }

            /* ─── ATTENDANCE ─── */
            .attendance-ring {
                position: relative;
                width: 100px;
                height: 100px;
                flex-shrink: 0;
            }
            .attendance-ring svg {
                transform: rotate(-90deg);
            }
            .attendance-ring .ring-bg {
                fill: none;
                stroke: #e0d4c0;
                stroke-width: 8;
            }
            .attendance-ring .ring-fill {
                fill: none;
                stroke: #2d5a4a;
                stroke-width: 8;
                stroke-linecap: round;
            }
            .attendance-ring .center-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                font-family: 'Georgia', serif;
            }
            .attendance-ring .center-text .number {
                font-size: 22px;
                font-weight: 700;
                color: #2d2a1e;
            }
            .attendance-ring .center-text .label {
                font-size: 10px;
                color: #8b7a6a;
            }

            /* ─── RESPONSIVE ─── */
            @media (max-width: 992px) {
                .stats-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .two-col {
                    grid-template-columns: 1fr;
                }
                .patrol-ring-wrapper {
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                }
            }
            @media (max-width: 480px) {
                .stats-grid {
                    grid-template-columns: 1fr;
                    gap: 12px;
                }
                .stat-card {
                    padding: 12px;
                }
                .stat-card .number {
                    font-size: 22px;
                }
                .card {
                    padding: 16px;
                }
                .two-col {
                    gap: 12px;
                }
                .patrol-ring-wrapper {
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }
                .alert-banner {
                    padding: 12px 16px;
                }
                .alert-banner .alert-item {
                    flex-wrap: wrap;
                }
                .attendance-ring {
                    width: 80px;
                    height: 80px;
                }
                .attendance-ring .center-text .number {
                    font-size: 18px;
                }
            }
        </style>

        <div class="campsite">
            <!-- ─── STATS GRID ─── -->
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-icon">👥</span>
                    <div class="number">${totalScouts}</div>
                    <div class="label">Total Scouts</div>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">⏳</span>
                    <div class="number">${totalPending}</div>
                    <div class="label">Pending</div>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">📅</span>
                    <div class="number">${allSessions.length}</div>
                    <div class="label">Sessions</div>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">⏱️</span>
                    <div class="number">${totalServiceHours}</div>
                    <div class="label">Service Hours</div>
                </div>
            </div>

            <!-- ─── ALERT BANNER ─── -->
            ${totalAlerts > 0 ? `
                <div class="alert-banner">
                    <div class="alert-header">⚠️ Alerts (${totalAlerts})</div>
                    
                    ${healthAlerts.length > 0 ? `
                        <div style="margin-bottom:8px;">
                            <div style="font-weight:500;color:#8b7a6a;font-size:13px;margin-bottom:4px;">🏥 Health Update Needed</div>
                            ${healthAlerts.map(item => `
                                <div class="alert-item" onclick="window.selectScout('${item.scout.username}')">
                                    <span class="name">${item.scout.fullName || item.scout.username}</span>
                                    <span class="detail critical">${item.message}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${stagnantScouts.length > 0 ? `
                        <div style="${healthAlerts.length > 0 ? 'margin-top:8px;' : ''}">
                            <div style="font-weight:500;color:#8b7a6a;font-size:13px;margin-bottom:4px;">📉 Stagnation Alerts</div>
                            ${stagnantScouts.map(item => {
                                const name = item.scout.fullName || item.scout.username;
                                const color = item.daysSince >= 30 ? 'critical' : 'warning';
                                return `
                                    <div class="alert-item" onclick="window.selectScout('${item.scout.username}')">
                                        <span class="name">${name}</span>
                                        <span class="detail ${color}">${item.daysSince} days inactive</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div class="alert-banner" style="border-left-color: #27ae60;">
                    <div class="success-msg">✅ All scouts are active and health records are up to date.</div>
                </div>
            `}

            <!-- ─── TWO COLUMN ─── -->
            <div class="two-col">
                <!-- ─── PENDING APPROVALS ─── -->
                <div class="card">
                    <div class="card-header">
                        <span class="title">⏳ Pending Approvals</span>
                        <a href="#" data-view="pending" class="link">View All →</a>
                    </div>
                    ${pendingItems.length === 0 ? `
                        <div class="empty">All caught up! 🎉</div>
                    ` : `
                        ${pendingItems.slice(0, 5).map(item => `
                            <div class="pending-item">
                                <div class="left">
                                    <span class="color-dot" style="background:${item.color};"></span>
                                    <span class="req-name">${item.reqName}</span>
                                    <span class="scout-name">— ${item.scout?.fullName || item.scout?.username || 'Unknown'}</span>
                                </div>
                                <span class="status-badge">⏳</span>
                            </div>
                        `).join('')}
                        ${pendingItems.length > 5 ? `
                            <div style="text-align:center;padding-top:8px;font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;">
                                +${pendingItems.length - 5} more
                            </div>
                        ` : ''}
                    `}
                </div>

                <!-- ─── ACTIVE TICKETS ─── -->
                <div class="card">
                    <div class="card-header">
                        <span class="title">🎫 Active Tickets</span>
                        <a href="#" data-view="tickets" class="link">View All →</a>
                    </div>
                    ${activeTickets.length === 0 ? `
                        <div class="empty">No active tickets. 🎉</div>
                    ` : `
                        ${activeTickets.slice(0, 4).map(t => {
                            const statusMap = {
                                'pending': { label: 'Pending', class: '' },
                                'requirements_added': { label: 'Requirements', class: 'requirements' },
                                'report_submitted': { label: 'Report', class: 'report' }
                            };
                            const s = statusMap[t.status] || { label: t.status, class: '' };
                            return `
                                <div class="ticket-item" onclick="window.location.href='report-viewer-ticket.html?ticketId=${t.id}'">
                                    <div class="left">
                                        <span class="icon">${t.badgeIcon || '🏅'}</span>
                                        <div class="info">
                                            <div class="name">${t.badgeName}</div>
                                            <div class="meta">${t.scoutName}</div>
                                        </div>
                                    </div>
                                    <span class="status-tag ${s.class}">${s.label}</span>
                                </div>
                            `;
                        }).join('')}
                        ${activeTickets.length > 4 ? `
                            <div style="text-align:center;padding-top:8px;font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;">
                                +${activeTickets.length - 4} more
                            </div>
                        ` : ''}
                    `}
                </div>
            </div>

            <!-- ─── PATROL OVERVIEW ─── -->
            <div class="card" style="margin-bottom:24px;">
                <div class="card-header">
                    <span class="title">🦅 Patrol Overview</span>
                </div>
                <div class="patrol-ring-wrapper">
                    ${patrolData.map(p => {
                        const circumference = 2 * Math.PI * 22;
                        const offset = circumference * (1 - p.pct / 100);
                        return `
                            <div class="patrol-ring">
                                <div class="ring-container">
                                    <svg viewBox="0 0 60 60" style="width:100%;height:100%;">
                                        <circle class="ring-bg" cx="30" cy="30" r="22"/>
                                        <circle class="ring-fill" cx="30" cy="30" r="22" stroke="${p.color}"
                                            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
                                    </svg>
                                    <div class="center-text">${p.pct}%</div>
                                </div>
                                <div class="ring-label">${p.name}</div>
                                <div class="ring-sub">${p.completed}/${p.total}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- ─── ATTENDANCE OVERVIEW ─── -->
            <div class="card" style="margin-bottom:24px;">
                <div class="card-header">
                    <span class="title">📊 Attendance Overview</span>
                </div>
                <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
                    <div class="attendance-ring">
                        <svg viewBox="0 0 120 120" style="width:100%;height:100%;">
                            <circle class="ring-bg" cx="60" cy="60" r="45"/>
                            <circle class="ring-fill" cx="60" cy="60" r="45"
                                stroke-dasharray="282.74" stroke-dashoffset="${282.74 * (1 - attendancePct / 100)}"/>
                        </svg>
                        <div class="center-text">
                            <div class="number">${attendancePct}%</div>
                            <div class="label">Overall</div>
                        </div>
                    </div>
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-family:'Georgia',serif;">
                            <span style="font-weight:600;color:#2d2a1e;">${allSessions.length}</span>
                            <span style="color:#8b7a6a;">total sessions</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;font-family:'Georgia',serif;">
                            <span style="font-weight:600;color:#2d2a1e;">${allScouts.length}</span>
                            <span style="color:#8b7a6a;">scouts</span>
                        </div>
                        <div style="margin-top:8px;font-size:13px;color:#8b7a6a;font-family:'Georgia',serif;">
                            ${attendancePct >= 70 ? '✅ Good attendance rate' : '⚠️ Attendance needs improvement'}
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
                    <h2 style="color:#2d2a1e;margin:0;font-family:'Georgia',serif;">🎫 Tickets <span style="font-size:14px;color:#8b7a6a;font-weight:400;">(${activeTickets.length} active)</span></h2>
                    ${activeTickets.length > 0 ? `<span style="background:#e74c3c;color:white;padding:4px 16px;border-radius:20px;font-size:14px;font-weight:600;">${activeTickets.length} pending</span>` : ''}
                </div>
                
                <div style="display:flex;flex-direction:column;gap:12px;">
        `;
        
        if (activeTickets.length === 0) {
            html += `
                <div style="background:#fcf8f0;border-radius:24px;padding:60px 20px;text-align:center;border:1px solid #e0d4c0;">
                    <div style="font-size:48px;margin-bottom:16px;">🎫</div>
                    <p style="color:#8b7a6a;font-size:16px;font-family:'Georgia',serif;">No active tickets. All caught up! 🎉</p>
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
                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e0d4c0;">
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <input type="text" id="req-input-${ticket.id}" placeholder="Enter requirements..." style="flex:1;min-width:200px;padding:10px 14px;border-radius:8px;border:2px solid #b8a080;font-size:14px;background:#f8f0e0;box-sizing:border-box;font-family:'Georgia',serif;" />
                                <button class="save-req-btn" data-ticket-id="${ticket.id}" style="background:#5b2e7a;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Georgia',serif;">📋 Add Requirements</button>
                            </div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                                <input type="file" id="req-image-${ticket.id}" accept="image/*" style="display:none;" />
                                <button class="upload-req-image-btn" data-ticket-id="${ticket.id}" style="background:#8b7a6a;color:white;border:none;padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'Georgia',serif;">📷 Add Image</button>
                                <span id="req-image-name-${ticket.id}" style="font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;"></span>
                                <button class="reject-ticket-btn" data-ticket-id="${ticket.id}" style="margin-left:auto;background:#e74c3c;color:white;border:none;padding:8px 20px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:500;font-family:'Georgia',serif;">❌ Reject</button>
                            </div>
                            <div id="req-message-${ticket.id}" style="font-size:13px;color:#8b7a6a;font-family:'Georgia',serif;"></div>
                        </div>
                    </div>
                `;
            } else if (ticket.status === 'requirements_added') {
                actionsHtml = `
                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e0d4c0;">
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            <button class="view-report-btn" data-ticket-id="${ticket.id}" style="background:#3498db;color:white;border:none;padding:8px 20px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'Georgia',serif;">📄 View Report</button>
                            <button class="approve-ticket-btn" data-ticket-id="${ticket.id}" style="background:#27ae60;color:white;border:none;padding:8px 20px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'Georgia',serif;">✅ Approve</button>
                            <button class="reject-ticket-btn" data-ticket-id="${ticket.id}" style="background:#e74c3c;color:white;border:none;padding:8px 20px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'Georgia',serif;">❌ Reject</button>
                        </div>
                    </div>
                `;
            } else if (ticket.status === 'report_submitted') {
                actionsHtml = `
                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e0d4c0;">
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            <button class="view-report-btn" data-ticket-id="${ticket.id}" style="background:#3498db;color:white;border:none;padding:8px 20px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'Georgia',serif;">📄 View Report</button>
                            <button class="approve-ticket-btn" data-ticket-id="${ticket.id}" style="background:#27ae60;color:white;border:none;padding:8px 20px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'Georgia',serif;">✅ Approve</button>
                            <button class="reject-ticket-btn" data-ticket-id="${ticket.id}" style="background:#e74c3c;color:white;border:none;padding:8px 20px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'Georgia',serif;">❌ Reject</button>
                        </div>
                    </div>
                `;
            }
            
            html += `
                <div style="background:#fcf8f0;border-radius:16px;padding:16px 20px;box-shadow:0 2px 12px rgba(91,46,122,0.06);border:1px solid #e0d4c0;border-left:4px solid ${status.color};cursor:pointer;transition:transform 0.25s ease,box-shadow 0.25s ease;" 
                     onclick="window.location.href='report-viewer-ticket.html?ticketId=${ticket.id}'"
                     onmouseover="this.style.transform='translateY(-2px)'" 
                     onmouseout="this.style.transform='translateY(0)'">
                    <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px;">
                        <div style="flex:1;">
                            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:'Georgia',serif;">
                                <span style="font-weight:600;font-size:16px;color:#2d2a1e;">${ticket.badgeIcon || '🏅'} ${ticket.badgeName}</span>
                                <span style="font-size:12px;color:#8b7a6a;">— ${scoutName}</span>
                                <span style="font-size:11px;background:${status.bg};color:${status.color};padding:2px 10px;border-radius:12px;font-weight:500;">${status.label}</span>
                            </div>
                            <div style="font-size:13px;color:#8b7a6a;margin-top:4px;font-family:'Georgia',serif;">
                                ${ticket.requestNote ? `📝 "${ticket.requestNote}"` : ''}
                                <span style="margin-left:12px;">📅 ${date}</span>
                            </div>
                            ${ticket.requirements ? `
                                <div style="font-size:13px;color:#2d2a1e;margin-top:6px;padding:8px 12px;background:#f5ede0;border-radius:8px;border-left:3px solid #8e44ad;font-family:'Georgia',serif;">
                                    📋 ${ticket.requirements}
                                    ${ticket.requirementsImage ? ` <span style="font-size:11px;color:#8e44ad;">[has image]</span>` : ''}
                                    ${ticket.leaderName ? `<span style="font-size:11px;color:#8b7a6a;margin-left:8px;">— ${ticket.leaderName}</span>` : ''}
                                </div>
                            ` : ''}
                            ${ticket.reportText ? `
                                <div style="font-size:13px;color:#2d2a1e;margin-top:6px;padding:8px 12px;background:#fdf2e9;border-radius:8px;border-left:3px solid #e67e22;font-family:'Georgia',serif;">
                                    📤 ${ticket.reportText.substring(0, 60)}${ticket.reportText.length > 60 ? '...' : ''}
                                    ${ticket.reportImages?.length ? ` <span style="font-size:11px;color:#e67e22;">(${ticket.reportImages.length} images)</span>` : ''}
                                </div>
                            ` : ''}
                            ${ticket.decisionNote ? `
                                <div style="font-size:13px;color:#2d2a1e;margin-top:6px;padding:8px 12px;background:${ticket.status === 'approved' ? '#d4edda' : '#f8d7da'};border-radius:8px;border-left:3px solid ${ticket.status === 'approved' ? '#27ae60' : '#e74c3c'};font-family:'Georgia',serif;">
                                    ${ticket.status === 'approved' ? '✅' : '❌'} ${ticket.decisionNote}
                                    ${ticket.decidedBy ? `<span style="font-size:11px;color:#8b7a6a;margin-left:8px;">— ${ticket.decidedBy}</span>` : ''}
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
        // Upload image button
        document.querySelectorAll('.upload-req-image-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const ticketId = this.dataset.ticketId;
                document.getElementById(`req-image-${ticketId}`).click();
            });
        });
        
        // File input change
        document.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    const ticketId = this.id.replace('req-image-', '');
                    window._reqImageFiles = window._reqImageFiles || {};
                    window._reqImageFiles[ticketId] = file;
                    document.getElementById(`req-image-name-${ticketId}`).textContent = `📎 ${file.name}`;
                }
            });
        });
        
        // Save Requirements
        document.querySelectorAll('.save-req-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const ticketId = this.dataset.ticketId;
                const input = document.getElementById(`req-input-${ticketId}`);
                const requirements = input.value.trim();
                const messageEl = document.getElementById(`req-message-${ticketId}`);
                
                if (!requirements) {
                    messageEl.textContent = '⚠️ Please enter requirements.';
                    messageEl.style.color = '#e74c3c';
                    return;
                }
                
                const imageFile = window._reqImageFiles ? window._reqImageFiles[ticketId] : null;
                
                const module = await import('./tickets.js');
                const result = await module.addRequirements(ticketId, requirements, imageFile);
                
                if (result.success) {
                    messageEl.textContent = '✅ Requirements saved! Scout has been notified.';
                    messageEl.style.color = '#27ae60';
                    input.value = '';
                    if (window._reqImageFiles) delete window._reqImageFiles[ticketId];
                    document.getElementById(`req-image-name-${ticketId}`).textContent = '';
                    renderLeaderTickets();
                } else {
                    messageEl.textContent = '❌ Error: ' + result.error;
                    messageEl.style.color = '#e74c3c';
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
                const result = await module.approveTicket(ticketId);
                if (result.success) {
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
            <span style="color:#8b7a6a;font-size:14px;font-family:'Georgia',serif;">${allScouts.length} scouts</span>
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
            <div class="scout-card" data-username="${scout.username}" style="background:#fcf8f0;border-radius:16px;padding:20px;border:1px solid #e0d4c0;box-shadow:0 2px 12px rgba(91,46,122,0.06);cursor:pointer;transition:transform 0.25s ease,box-shadow 0.25s ease;" 
                 onmouseover="this.style.transform='translateY(-4px)'" 
                 onmouseout="this.style.transform='translateY(0)'">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-weight:600;font-size:18px;color:#2d2a1e;font-family:'Georgia',serif;">${name}</div>
                    <span style="font-size:12px;background:#f5ede0;padding:2px 10px;border-radius:12px;color:#8b7a6a;font-family:'Georgia',serif;">${role}</span>
                </div>
                <div style="font-size:14px;color:#8b7a6a;margin-bottom:12px;font-family:'Georgia',serif;">${patrol} · ${rank}</div>
                
                <div style="margin-bottom:6px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;">
                        <span>${latestBadge.label}</span>
                        <span>${done}/${total}</span>
                    </div>
                    <div style="background:#e8dcc8;border-radius:20px;height:8px;overflow:hidden;">
                        <div style="background:#5b2e7a;height:100%;width:${pct}%;border-radius:20px;transition:width 0.8s ease;"></div>
                    </div>
                </div>
                
                ${badgeCount > 0 ? `
                    <div style="margin-top:6px;font-size:11px;color:#5b2e7a;font-family:'Georgia',serif;">
                        🏅 ${badgeCount} badge${badgeCount > 1 ? 's' : ''} earned
                    </div>
                ` : ''}
                
                ${scoutNote ? `<div style="margin-top:8px;font-size:12px;color:#8b7a6a;font-style:italic;border-top:1px solid #e0d4c0;padding-top:8px;font-family:'Georgia',serif;">${scoutNote}</div>` : ''}
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
        pageContent.innerHTML = `<p style="color:#8b7a6a;font-family:'Georgia',serif;">Scout not found.</p>`;
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
        <style>
            .profile-container {
                max-width: 100%;
                padding: 0;
                font-family: 'Georgia', 'Times New Roman', serif;
            }
            .profile-back {
                cursor: pointer;
                color: #8b7a6a;
                font-size: 16px;
                margin-bottom: 16px;
                display: inline-block;
                font-family: 'Georgia', serif;
            }
            .profile-back:hover {
                color: #5b2e7a;
            }
            .profile-card {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 24px;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
                margin-bottom: 20px;
            }
            .profile-card .header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                flex-wrap: wrap;
                gap: 12px;
            }
            .profile-card .header .name {
                font-size: 24px;
                font-weight: 700;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .profile-card .header .meta {
                color: #8b7a6a;
                font-family: 'Georgia', serif;
            }
            .profile-card .header .right {
                text-align: right;
                color: #8b7a6a;
                font-family: 'Georgia', serif;
            }
            .profile-card .promo-box {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid #e0d4c0;
                background: #fdf8e7;
                border-radius: 12px;
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border: 1px solid #d4a017;
            }
            .profile-card .promo-box .promo-text {
                color: #6b8e23;
                font-weight: 500;
                font-family: 'Georgia', serif;
            }
            .profile-card .promo-box .promo-btn {
                background: linear-gradient(135deg, #b8860b, #6b8e23);
                color: white;
                border: none;
                padding: 6px 20px;
                border-radius: 20px;
                font-size: 14px;
                cursor: pointer;
                font-weight: 500;
                font-family: 'Georgia', serif;
            }
            .profile-card .promo-box .promo-btn:hover {
                opacity: 0.9;
                transform: scale(1.02);
            }
            .profile-badge-section {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 20px;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
                margin-bottom: 16px;
            }
            .profile-badge-section .badge-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .profile-badge-section .badge-header .title {
                font-weight: 600;
                color: #00897b;
                font-family: 'Georgia', serif;
            }
            .profile-badge-section .badge-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                gap: 10px;
            }
            .profile-badge-section .badge-item {
                text-align: center;
                padding: 10px;
                background: #f5ede0;
                border-radius: 12px;
                border: 1px solid #b8a080;
                cursor: pointer;
                transition: transform 0.2s;
            }
            .profile-badge-section .badge-item:hover {
                transform: scale(1.05);
            }
            .profile-badge-section .badge-item .icon {
                font-size: 32px;
            }
            .profile-badge-section .badge-item .name {
                font-size: 10px;
                color: #2d2a1e;
                font-weight: 500;
                margin-top: 4px;
                font-family: 'Georgia', serif;
            }
            .profile-badge-section .badge-item .status {
                font-size: 8px;
                color: #27ae60;
                font-weight: 600;
                font-family: 'Georgia', serif;
            }
            .profile-badge-section .empty {
                text-align: center;
                padding: 16px;
                color: #8b7a6a;
                font-style: italic;
                font-size: 13px;
                font-family: 'Georgia', serif;
            }
            .profile-role-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .profile-role-grid .role-btn {
                padding: 6px 16px;
                border-radius: 20px;
                border: 2px solid #e0d4c0;
                background: white;
                color: #2d2a1e;
                cursor: pointer;
                font-size: 13px;
                font-family: 'Georgia', serif;
                transition: all 0.2s;
            }
            .profile-role-grid .role-btn.active {
                background: #5b2e7a;
                color: white;
                border-color: #5b2e7a;
            }
            .profile-role-grid .role-btn:hover {
                transform: scale(1.05);
            }
            .profile-req-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }
            .profile-req-item {
                background: #fcf8f0;
                border-radius: 12px;
                padding: 12px 16px;
                border-left: 3px solid #e0d4c0;
            }
            .profile-req-item .req-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 4px;
            }
            .profile-req-item .req-header .req-name {
                font-weight: 600;
                font-size: 13px;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .profile-req-item .req-header .status-pill {
                font-size: 11px;
                font-weight: 500;
                padding: 2px 12px;
                border-radius: 40px;
                font-family: 'Georgia', serif;
            }
            .profile-req-item .req-header .status-pill.complete {
                background: #d4edda;
                color: #155724;
            }
            .profile-req-item .req-header .status-pill.pending {
                background: #fde8d0;
                color: #d35400;
            }
            .profile-req-item .req-header .status-pill.todo {
                background: #e8e0f0;
                color: #6b5f7a;
            }
            .profile-req-item .req-actions {
                margin-top: 6px;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .profile-req-item .req-actions .action-link {
                font-size: 11px;
                color: #5b2e7a;
                text-decoration: underline;
                cursor: pointer;
                font-family: 'Georgia', serif;
            }
            .profile-req-item .req-actions .action-btn {
                font-size: 11px;
                font-weight: 500;
                padding: 2px 12px;
                border-radius: 40px;
                border: none;
                cursor: pointer;
                font-family: 'Georgia', serif;
            }
            .profile-req-item .req-actions .action-btn.approve {
                background: #4caf50;
                color: white;
            }
            .profile-req-item .req-actions .action-btn.reject {
                background: #e74c3c;
                color: white;
            }
            .profile-req-item .req-info {
                font-size: 10px;
                color: #8b7a6a;
                margin-top: 4px;
                font-family: 'Georgia', serif;
            }
            .profile-note-area {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 24px;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
                margin-bottom: 20px;
            }
            .profile-note-area textarea {
                width: 100%;
                padding: 12px;
                border-radius: 12px;
                border: 1px solid #e0d4c0;
                font-family: 'Georgia', serif;
                font-size: 14px;
                min-height: 80px;
                resize: vertical;
                background: #f5ede0;
            }
            .profile-note-area textarea:focus {
                outline: none;
                border-color: #5b2e7a;
            }
            .profile-note-area .save-btn {
                margin-top: 12px;
                background: #5b2e7a;
                color: white;
                border: none;
                padding: 10px 24px;
                border-radius: 40px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                font-family: 'Georgia', serif;
            }
            .profile-note-area .save-btn:hover {
                background: #4a2a5e;
            }
            .profile-note-area .note-message {
                margin-top: 8px;
                font-size: 13px;
                color: #8b7a6a;
                font-family: 'Georgia', serif;
            }
            .profile-sessions {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 24px;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
            }
            .profile-sessions .sess-header {
                display: flex;
                gap: 24px;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }
            .profile-sessions .sess-header .stat {
                font-family: 'Georgia', serif;
                color: #8b7a6a;
            }
            .profile-sessions .sess-header .stat span {
                font-weight: 600;
                color: #2d2a1e;
            }
            .profile-sessions .sess-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #e8dcc8;
                font-family: 'Georgia', serif;
                font-size: 14px;
                color: #2d2a1e;
            }
            .profile-sessions .sess-item .sess-meta {
                color: #8b7a6a;
            }

            @media (max-width: 768px) {
                .profile-req-grid {
                    grid-template-columns: 1fr;
                }
                .profile-card .header {
                    flex-direction: column;
                }
                .profile-card .header .right {
                    text-align: left;
                }
                .profile-badge-section .badge-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
            @media (max-width: 480px) {
                .profile-badge-section .badge-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .profile-card {
                    padding: 16px;
                }
                .profile-note-area {
                    padding: 16px;
                }
                .profile-sessions {
                    padding: 16px;
                }
                .profile-req-item {
                    padding: 10px 12px;
                }
            }
        </style>

        <div class="profile-container">
            <span class="profile-back" id="back-to-scouts">← Back to All Scouts</span>

            <!-- ─── PROFILE CARD ─── -->
            <div class="profile-card">
                <div class="header">
                    <div>
                        <div class="name">${scout.fullName || scout.username}</div>
                        <div class="meta">${scout.patrol || 'No patrol'} · ${rank}</div>
                        <div class="meta">Role: ${role}</div>
                    </div>
                    <div class="right">
                        <div>DOB: ${scout.dob || 'Not set'}</div>
                        <div>Joined: ${scout.joinDate || 'Not set'}</div>
                        <div>${totalHours}h service</div>
                    </div>
                </div>
                ${scout.emergencyContact ? `
                    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e0d4c0;">
                        <div style="font-weight:600;font-size:14px;font-family:'Georgia',serif;color:#2d2a1e;">Emergency Contact</div>
                        <div style="font-size:14px;color:#8b7a6a;font-family:'Georgia',serif;">
                            ${scout.emergencyContact.name || 'N/A'} · 
                            ${scout.emergencyContact.phone || 'N/A'} · 
                            ${scout.emergencyContact.relation || 'N/A'}
                        </div>
                    </div>
                ` : ''}
                
                ${promo ? `
                    <div class="promo-box">
                        <span class="promo-text">Ready for promotion: ${promo.currentRank} → ${promo.nextRank}</span>
                        <button class="promo-btn" data-username="${username}">Promote Now</button>
                    </div>
                ` : ''}
            </div>

            <!-- ─── LEADERSHIP ROLES ─── -->
            <div class="profile-card">
                <h3 style="color:#2d2a1e;margin-bottom:16px;font-family:'Georgia',serif;">Leadership Roles</h3>
                <div class="profile-role-grid">
                    ${['Scout', 'Patrol Leader', 'Assistant Patrol Leader', 'Senior Patrol Leader', 'Quartermaster', 'Scribe', 'Treasurer'].map(r => `
                        <button class="role-btn ${role === r ? 'active' : ''}" data-username="${username}" data-role="${r}">${r}</button>
                    `).join('')}
                </div>
                <div id="role-message" style="margin-top:8px;font-size:13px;color:#8b7a6a;font-family:'Georgia',serif;"></div>
            </div>

            <!-- ─── BADGE PROGRESS ─── -->
            <div style="margin-bottom:20px;">
                <h3 style="color:#2d2a1e;margin-bottom:16px;font-family:'Georgia',serif;">Badge Progress</h3>
                ${badges.map(badge => {
                    const color = badgeColors[badge.key];
                    let done = 0;
                    let reqHtml = '';
                    for (const req of badge.reqs) {
                        const key = `${badge.key}_${req}`;
                        const data = status[key];
                        const statusText = data ? data.status : 'todo';
                        
                        let statusDisplay = '';
                        if (statusText === 'approved') {
                            statusDisplay = `<span class="status-pill complete">Complete</span>`;
                        } else if (statusText === 'pending') {
                            statusDisplay = `<span class="status-pill pending">Pending</span>`;
                        } else {
                            statusDisplay = `<span class="status-pill todo">Todo</span>`;
                        }
                        
                        const reportKey = `${badge.key}_${req}_report`;
                        const hasReport = status[reportKey] && (status[reportKey].note || (status[reportKey].images && status[reportKey].images.length > 0));
                        
                        reqHtml += `
                            <div class="profile-req-item">
                                <div class="req-header">
                                    <span class="req-name">${req}</span>
                                    ${statusDisplay}
                                </div>
                                <div class="req-actions">
                                    ${hasReport ? `<a href="report-viewer.html?email=${username}&tab=${badge.key}&req=${encodeURIComponent(req)}" class="action-link">View Report</a>` : ''}
                                    <button class="action-btn approve-req-btn" data-username="${username}" data-field="${key}">Approve</button>
                                </div>
                                ${statusText === 'approved' && data ? `<div class="req-info">Approved by ${data.approvedBy || 'Unknown'} · ${data.approvedAt ? new Date(data.approvedAt).toLocaleString() : ''}</div>` : ''}
                            </div>
                        `;
                        if (statusText === 'approved') done++;
                    }
                    const pct = badge.reqs.length > 0 ? Math.round((done / badge.reqs.length) * 100) : 0;
                    return `
                        <div class="profile-badge-section" style="margin-bottom:16px;">
                            <div class="badge-header">
                                <span class="title" style="color:${color.text};">${color.label}</span>
                                <span style="font-size:14px;color:#8b7a6a;font-family:'Georgia',serif;">${done}/${badge.reqs.length}</span>
                            </div>
                            <div style="background:#e8dcc8;border-radius:20px;height:6px;overflow:hidden;margin-bottom:12px;">
                                <div style="background:${color.border};height:100%;width:${pct}%;border-radius:20px;transition:width 0.8s ease;"></div>
                            </div>
                            <div class="profile-req-grid">
                                ${reqHtml}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- ─── BADGES SECTION ─── -->
            <div class="profile-badge-section">
                <div class="badge-header">
                    <span class="title">🏅 Badges</span>
                    <span style="font-size:14px;color:#8b7a6a;font-family:'Georgia',serif;">${scoutTickets.length} earned</span>
                </div>
                ${scoutTickets.length > 0 ? `
                    <div class="badge-grid">
                        ${scoutTickets.map(t => `
                            <div class="badge-item" onclick="window.location.href='report-viewer-ticket.html?ticketId=${t.id}'">
                                <div class="icon">${t.badgeIcon || '🏅'}</div>
                                <div class="name">${t.badgeName}</div>
                                <div class="status">Earned</div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty">No badges earned yet.</div>
                `}
            </div>

            <!-- ─── LEADER NOTE ─── -->
            <div class="profile-note-area">
                <h3 style="color:#2d2a1e;margin-bottom:16px;font-family:'Georgia',serif;">Leader Note</h3>
                <textarea id="leader-note">${scout.note || ''}</textarea>
                <button class="save-btn" id="save-leader-note">Save Note</button>
                <div id="note-message" class="note-message"></div>
            </div>

            <!-- ─── SESSIONS ─── -->
            <div class="profile-sessions">
                <h3 style="color:#2d2a1e;margin-bottom:16px;font-family:'Georgia',serif;">Attendance & Sessions</h3>
                <div class="sess-header">
                    <div class="stat"><span>${attendedSessions.length}</span> sessions attended</div>
                    <div class="stat"><span>${totalHours}</span> total service hours</div>
                </div>
                ${attendedSessions.length === 0 ? '<p style="color:#8b7a6a;font-family:\'Georgia\',serif;">No sessions attended yet.</p>' : ''}
                ${attendedSessions.map(s => `
                    <div class="sess-item">
                        <span>${s.name}</span>
                        <span class="sess-meta">${s.date} · ${s.duration || 0}h</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    pageContent.innerHTML = html;

    // ─── Event listeners ──────────────────────────────────────
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
            message.textContent = '✅ Note saved successfully!';
            message.style.color = '#27ae60';
        } catch (error) {
            message.textContent = '❌ Error saving note: ' + error.message;
            message.style.color = '#e74c3c';
        }
    });

    document.querySelectorAll('.promo-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const scoutUsername = this.dataset.username;
            const scout = allScouts.find(s => s.username === scoutUsername);
            if (!scout) return;
            
            const promo = isReadyForPromotion(scoutUsername);
            if (!promo) return;
            
            if (confirm(`Promote ${scout.fullName || scout.username} from ${promo.currentRank} to ${promo.nextRank}?`)) {
                try {
                    await setDoc(doc(db, 'users', scoutUsername), { rank: promo.nextRank }, { merge: true });
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
                document.getElementById('role-message').textContent = `✅ Role updated to: ${newRole}`;
                document.getElementById('role-message').style.color = '#27ae60';
                const scout = allScouts.find(s => s.username === scoutUsername);
                if (scout) scout.scoutRole = newRole;
                setTimeout(() => renderScoutProfile(scoutUsername), 1000);
            } catch (error) {
                document.getElementById('role-message').textContent = '❌ Error: ' + error.message;
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
                if (key.startsWith('ticket_')) continue;
                
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

    const order = { membership: 0, secondClass: 1, firstClass: 2, badge: 3 };
    pendingItems.sort((a, b) => order[a.badgeType] - order[b.badgeType]);

    const totalPending = pendingItems.length + readyForPromotion.length;

    let html = `
        <style>
            .pending-container {
                max-width: 100%;
                padding: 0;
                font-family: 'Georgia', 'Times New Roman', serif;
            }
            .color-key {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 20px;
            }
            .color-key .key-item {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
                color: white;
                font-family: 'Georgia', serif;
            }
            .color-key .key-item.membership { background: #7bcb7b; }
            .color-key .key-item.second { background: #4caf50; }
            .color-key .key-item.first { background: #2e7d32; }
            .color-key .key-item.badges { background: #00897b; }
            .color-key .key-item.promo { background: linear-gradient(135deg, #b8860b, #6b8e23); }
            .pending-item {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 16px 20px;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
                transition: transform 0.25s ease, box-shadow 0.25s ease;
            }
            .pending-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(91,46,122,0.10);
            }
            .pending-item .left {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }
            .pending-item .left .color-dot {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 4px;
                flex-shrink: 0;
            }
            .pending-item .left .badge-label {
                font-size: 12px;
                font-weight: 600;
                padding: 2px 10px;
                border-radius: 8px;
                font-family: 'Georgia', serif;
            }
            .pending-item .left .req-name {
                font-weight: 500;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .pending-item .left .scout-name {
                color: #8b7a6a;
                font-size: 14px;
                font-family: 'Georgia', serif;
            }
            .pending-item .actions {
                display: flex;
                gap: 8px;
            }
            .pending-item .actions .approve-btn {
                background: #4caf50;
                color: white;
                border: none;
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                font-family: 'Georgia', serif;
            }
            .pending-item .actions .approve-btn:hover {
                background: #388e3c;
            }
            .pending-item .actions .reject-btn {
                background: #e74c3c;
                color: white;
                border: none;
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                font-family: 'Georgia', serif;
            }
            .pending-item .actions .reject-btn:hover {
                background: #c0392b;
            }
            .promo-item {
                background: linear-gradient(135deg, #fdf8e7, #f0f7e6);
                border-radius: 16px;
                padding: 16px 20px;
                border: 1px solid #b8860b;
                box-shadow: 0 2px 12px rgba(184,134,11,0.08);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
            }
            .promo-item .left {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }
            .promo-item .left .promo-label {
                font-size: 12px;
                font-weight: 600;
                color: white;
                background: linear-gradient(135deg, #b8860b, #6b8e23);
                padding: 2px 10px;
                border-radius: 8px;
                font-family: 'Georgia', serif;
            }
            .promo-item .left .name {
                font-weight: 500;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .promo-item .left .detail {
                color: #8b7a6a;
                font-size: 14px;
                font-family: 'Georgia', serif;
            }
            .promo-item .promo-btn {
                background: linear-gradient(135deg, #b8860b, #6b8e23);
                color: white;
                border: none;
                padding: 6px 20px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                font-family: 'Georgia', serif;
                box-shadow: 0 2px 8px rgba(184,134,11,0.3);
            }
            .promo-item .promo-btn:hover {
                transform: scale(1.05);
            }
            .empty-state {
                background: #fcf8f0;
                border-radius: 24px;
                padding: 40px;
                text-align: center;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
            }
            .empty-state .icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            .empty-state .msg {
                color: #8b7a6a;
                font-size: 18px;
                font-family: 'Georgia', serif;
            }

            @media (max-width: 480px) {
                .pending-item {
                    flex-direction: column;
                    align-items: stretch;
                }
                .pending-item .actions {
                    justify-content: flex-end;
                }
                .promo-item {
                    flex-direction: column;
                    align-items: stretch;
                }
                .color-key {
                    gap: 8px;
                }
                .color-key .key-item {
                    font-size: 10px;
                    padding: 2px 10px;
                }
            }
        </style>

        <div class="pending-container">
            <div class="color-key">
                <span class="key-item membership">Membership</span>
                <span class="key-item second">Second Class</span>
                <span class="key-item first">First Class</span>
                <span class="key-item badges">Badges</span>
                <span class="key-item promo">Ready for Promotion</span>
            </div>

            ${totalPending === 0 ? `
                <div class="empty-state">
                    <div class="icon">🎉</div>
                    <div class="msg">No pending approvals! All caught up.</div>
                </div>
            ` : `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
                    <span style="color:#8b7a6a;font-size:14px;font-family:'Georgia',serif;">${totalPending} items</span>
                </div>

                <div style="display:flex;flex-direction:column;gap:12px;">
                    ${pendingItems.map(item => {
                        const color = getBadgeInfo(item.field);
                        const label = getBadgeLabel(item.field);
                        const name = item.scout?.fullName || item.scout?.username || 'Unknown';
                        return `
                            <div class="pending-item">
                                <div class="left">
                                    <span class="color-dot" style="background:${color.border};"></span>
                                    <span class="badge-label" style="color:${color.text};background:${color.bg};">${label}</span>
                                    <span class="req-name">${item.reqName}</span>
                                    <span class="scout-name">— ${name}</span>
                                </div>
                                <div class="actions">
                                    <button class="approve-btn" data-username="${item.scout?.username}" data-field="${item.field}">Approve</button>
                                    <button class="reject-btn" data-username="${item.scout?.username}" data-field="${item.field}">Reject</button>
                                </div>
                            </div>
                        `;
                    }).join('')}

                    ${readyForPromotion.map(item => {
                        const name = item.scout.fullName || item.scout.username;
                        return `
                            <div class="promo-item">
                                <div class="left">
                                    <span class="promo-label">Ready for Promotion</span>
                                    <span class="name">${name}</span>
                                    <span class="detail">${item.promo.currentRank} → ${item.promo.nextRank}</span>
                                </div>
                                <button class="promo-btn" data-username="${item.scout.username}">Promote Now</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;

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

    document.querySelectorAll('.promo-btn').forEach(btn => {
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
        <style>
            .sessions-container {
                max-width: 100%;
                padding: 0;
                font-family: 'Georgia', 'Times New Roman', serif;
            }
            .sessions-stats {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
                margin-bottom: 24px;
            }
            .sessions-stats .stat {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 16px;
                text-align: center;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
            }
            .sessions-stats .stat .number {
                font-size: 28px;
                font-weight: 700;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .sessions-stats .stat .label {
                font-size: 13px;
                color: #8b7a6a;
                font-family: 'Georgia', serif;
                margin-top: 4px;
            }
            .sessions-stats .stat .number.green { color: #5b2e7a; }
            .sessions-stats .stat .number.gold { color: #d35400; }
            .session-card {
                background: #fcf8f0;
                border-radius: 20px;
                padding: 16px;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
                cursor: pointer;
                transition: transform 0.25s ease, box-shadow 0.25s ease;
                border-left: 4px solid #5b2e7a;
                margin-bottom: 12px;
            }
            .session-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(91,46,122,0.10);
            }
            .session-card .header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                flex-wrap: wrap;
                gap: 8px;
            }
            .session-card .header .name {
                font-weight: 600;
                font-size: 18px;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .session-card .header .meta {
                color: #8b7a6a;
                font-size: 14px;
                font-family: 'Georgia', serif;
            }
            .session-card .header .right {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .session-card .header .right .tag {
                background: #d4edda;
                color: #155724;
                padding: 2px 10px;
                border-radius: 12px;
                font-size: 12px;
                font-family: 'Georgia', serif;
            }
            .session-card .header .right .hours {
                font-size: 14px;
                font-weight: 600;
                color: #5b2e7a;
                font-family: 'Georgia', serif;
            }
            .empty-state {
                text-align: center;
                padding: 40px 0;
            }
            .empty-state .icon {
                font-size: 64px;
                margin-bottom: 16px;
            }
            .empty-state .title {
                color: #2d2a1e;
                margin-bottom: 8px;
                font-family: 'Georgia', serif;
            }
            .empty-state .sub {
                color: #8b7a6a;
                font-family: 'Georgia', serif;
            }

            @media (max-width: 480px) {
                .sessions-stats {
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .session-card .header {
                    flex-direction: column;
                }
                .session-card .header .right {
                    width: 100%;
                    justify-content: flex-start;
                }
            }
        </style>

        <div class="sessions-container">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
                <div></div>
                <a href="new-session.html" style="background:#5b2e7a;color:white;border:none;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;box-shadow:0 2px 8px rgba(91,46,122,0.3);transition:transform 0.2s,box-shadow 0.2s;font-family:'Georgia',serif;">New Session</a>
            </div>

            <div class="sessions-stats">
                <div class="stat">
                    <div class="number green">${totalSessions}</div>
                    <div class="label">Total Sessions</div>
                </div>
                <div class="stat">
                    <div class="number gold">${totalHours}</div>
                    <div class="label">Scouting Hours</div>
                </div>
            </div>

            ${allSessions.length === 0 ? `
                <div class="empty-state">
                    <div class="icon">📅</div>
                    <div class="title">No sessions yet</div>
                    <div class="sub">Click "New Session" to create your first session!</div>
                </div>
            ` : `
                ${allSessions.sort((a, b) => {
                    if (a.date > b.date) return -1;
                    if (a.date < b.date) return 1;
                    return 0;
                }).map(session => {
                    const attendeeCount = session.attendance ? Object.keys(session.attendance).filter(k => session.attendance[k] === true).length : 0;
                    const isAttending = session.attendance ? session.attendance[currentUser.username] === true : false;
                    
                    const today = new Date().toISOString().split('T')[0];
                    let statusTag = '';
                    let statusColor = '';
                    if (session.date === today) {
                        statusTag = 'Today';
                        statusColor = '#28a745';
                    } else if (session.date > today) {
                        statusTag = 'Upcoming';
                        statusColor = '#007bff';
                    } else {
                        statusTag = 'Completed';
                        statusColor = '#6c757d';
                    }

                    return `
                        <div class="session-card" onclick="window.location.href='session-detail-leader.html?id=${session.id}'">
                            <div class="header">
                                <div>
                                    <div class="name">${session.name}</div>
                                    <div class="meta">${session.date} · ${session.time} · ${session.location || 'TBD'}</div>
                                    ${session.purpose ? `<div style="font-size:13px;color:#8b7a6a;margin-top:4px;font-family:'Georgia',serif;">${session.purpose}</div>` : ''}
                                </div>
                                <div class="right">
                                    <span class="tag" style="background:${statusColor}20;color:${statusColor};">${statusTag}</span>
                                    <span class="hours">${session.duration || 0}h</span>
                                    ${isAttending ? '<span style="background:#d4edda;color:#155724;padding:2px 10px;border-radius:12px;font-size:12px;font-family:\'Georgia\',serif;">Attended</span>' : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            `}
        </div>
    `;

    pageContent.innerHTML = html;
}

// ─── EXPORT FUNCTION ──────────────────────────────────────────
function renderExport() {
    let html = `
        <style>
            .export-container {
                max-width: 700px;
                margin: 0 auto;
                padding: 0;
                font-family: 'Georgia', 'Times New Roman', serif;
            }
            .export-card {
                background: #fcf8f0;
                border-radius: 24px;
                padding: 32px;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
            }
            .export-card .title {
                color: #2d2a1e;
                margin: 0 0 8px 0;
                font-family: 'Georgia', serif;
            }
            .export-card .sub {
                color: #8b7a6a;
                font-size: 14px;
                margin-bottom: 24px;
                font-family: 'Georgia', serif;
            }
            .export-card .stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 24px;
            }
            .export-card .stats .stat {
                background: #f5ede0;
                border-radius: 16px;
                padding: 16px;
                text-align: center;
            }
            .export-card .stats .stat .number {
                font-size: 28px;
                font-weight: 700;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .export-card .stats .stat .label {
                font-size: 13px;
                color: #8b7a6a;
                font-family: 'Georgia', serif;
            }
            .export-card .stats .stat .number.green { color: #5b2e7a; }
            .export-card .stats .stat .number.gold { color: #d35400; }
            .export-card .export-btn {
                background: #5b2e7a;
                color: white;
                border: none;
                padding: 14px 32px;
                border-radius: 40px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                transition: background 0.2s;
                font-family: 'Georgia', serif;
            }
            .export-card .export-btn:hover {
                background: #4a2a5e;
            }
            .export-card .message {
                margin-top: 12px;
                font-size: 14px;
                color: #8b7a6a;
                text-align: center;
                font-family: 'Georgia', serif;
            }

            @media (max-width: 480px) {
                .export-card {
                    padding: 20px;
                }
                .export-card .stats {
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .export-card .stats .stat .number {
                    font-size: 22px;
                }
            }
        </style>

        <div class="export-container">
            <div class="export-card">
                <h2 class="title">📤 Export Data</h2>
                <p class="sub">Export all scout data as a CSV file.</p>

                <div class="stats">
                    <div class="stat">
                        <div class="number green">${allScouts.length}</div>
                        <div class="label">Scouts to Export</div>
                    </div>
                    <div class="stat">
                        <div class="number gold">${allSessions.length}</div>
                        <div class="label">Sessions</div>
                    </div>
                </div>

                <button class="export-btn" id="export-btn">📥 Download CSV</button>
                <div class="message" id="export-message"></div>
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
            message.style.color = '#27ae60';
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
        pageContent.innerHTML = `<p style="color:#8b7a6a;padding:40px;text-align:center;font-family:'Georgia',serif;">Profile not found.</p>`;
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
    const healthStatusColor = healthDaysSince > 90 ? '#d35400' : '#27ae60';

    let html = `
        <style>
            .profile-container {
                max-width: 600px;
                margin: 0 auto;
                font-family: 'Georgia', 'Times New Roman', serif;
            }
            .profile-back {
                cursor: pointer;
                color: #8b7a6a;
                font-size: 16px;
                margin-bottom: 16px;
                display: inline-block;
                font-family: 'Georgia', serif;
            }
            .profile-back:hover {
                color: #5b2e7a;
            }
            .profile-card {
                background: #fcf8f0;
                border-radius: 24px;
                padding: 32px;
                border: 1px solid #e0d4c0;
                box-shadow: 0 2px 12px rgba(91,46,122,0.06);
            }
            .profile-card .avatar {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: ${avatarColor};
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                flex-shrink: 0;
            }
            .profile-card .avatar .head {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: white;
                position: absolute;
                top: 16px;
            }
            .profile-card .avatar .body {
                width: 38px;
                height: 22px;
                border-radius: 50% 50% 0 0;
                background: white;
                position: absolute;
                bottom: 14px;
            }
            .profile-card .header {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 24px;
            }
            .profile-card .header .name {
                font-size: 24px;
                font-weight: 700;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .profile-card .header .role-text {
                color: #8b7a6a;
                font-family: 'Georgia', serif;
            }
            .profile-card .form-group {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 16px;
            }
            .profile-card .form-group .full {
                grid-column: 1 / -1;
            }
            .profile-card label {
                font-weight: 500;
                color: #2d2a1e;
                display: block;
                margin-bottom: 4px;
                font-family: 'Georgia', serif;
                font-size: 13px;
            }
            .profile-card input, .profile-card select, .profile-card textarea {
                width: 100%;
                padding: 10px;
                border-radius: 12px;
                border: 1px solid #e0d4c0;
                font-size: 14px;
                font-family: 'Georgia', serif;
                background: #f5ede0;
                box-sizing: border-box;
            }
            .profile-card input:focus, .profile-card select:focus, .profile-card textarea:focus {
                outline: none;
                border-color: #5b2e7a;
            }
            .profile-card input:disabled, .profile-card select:disabled {
                background: #f5ede0;
                color: #8b7a6a;
            }
            .profile-card .health-status {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .profile-card .health-status .label {
                font-weight: 600;
                font-size: 16px;
                color: #2d2a1e;
                font-family: 'Georgia', serif;
            }
            .profile-card .health-status .status {
                font-size: 12px;
                color: ${healthStatusColor};
                font-family: 'Georgia', serif;
            }
            .profile-card .save-btn {
                background: #5b2e7a;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 40px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                margin-top: 16px;
                font-family: 'Georgia', serif;
                font-size: 14px;
            }
            .profile-card .save-btn:hover {
                background: #4a2a5e;
            }
            .profile-card .message {
                margin-top: 16px;
                color: #8b7a6a;
                text-align: center;
                font-family: 'Georgia', serif;
            }
            .profile-card .footer-note {
                margin-top: 16px;
                padding: 12px;
                background: #f5ede0;
                border-radius: 12px;
                font-size: 13px;
                color: #8b7a6a;
                text-align: center;
                font-family: 'Georgia', serif;
            }
            .profile-card .section-divider {
                border-top: 1px solid #e0d4c0;
                padding-top: 16px;
                margin-top: 16px;
            }

            @media (max-width: 480px) {
                .profile-card {
                    padding: 20px;
                }
                .profile-card .header {
                    flex-direction: column;
                    text-align: center;
                }
                .profile-card .form-group {
                    grid-template-columns: 1fr;
                }
            }
        </style>

        <div class="profile-container">
            <span class="profile-back" id="profile-back">←</span>

            <div class="profile-card">
                <div class="header">
                    <div class="avatar">
                        <div class="head"></div>
                        <div class="body"></div>
                    </div>
                    <div>
                        <div class="name">${fullName}</div>
                        <div class="role-text">${role}</div>
                    </div>
                </div>

                <form id="profile-form">
                    <div class="form-group">
                        <div>
                            <label>Full Name</label>
                            <input type="text" id="profile-fullname" value="${fullName}">
                        </div>
                        <div>
                            <label>Date of Birth</label>
                            <input type="date" id="profile-dob" value="${dob}">
                        </div>
                    </div>

                    <div class="form-group">
                        <div>
                            <label>Role</label>
                            <select id="profile-role">
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
                    <div class="section-divider">
                        <div class="health-status">
                            <span class="label">🏥 Health Information</span>
                            <span class="status">${healthStatus}</span>
                        </div>
                        
                        <div class="form-group">
                            <div>
                                <label>Allergies</label>
                                <input type="text" id="health-allergies" value="${health.allergies || ''}" placeholder="e.g., Peanuts, Shellfish">
                            </div>
                            <div>
                                <label>Medical Conditions</label>
                                <input type="text" id="health-conditions" value="${health.conditions || ''}" placeholder="e.g., Asthma, Diabetes">
                            </div>
                        </div>
                        <div class="form-group">
                            <div>
                                <label>Medications</label>
                                <input type="text" id="health-medications" value="${health.medications || ''}" placeholder="e.g., Inhaler">
                            </div>
                            <div>
                                <label>Additional Notes</label>
                                <input type="text" id="health-notes" value="${health.notes || ''}" placeholder="e.g., Carry inhaler at all times">
                            </div>
                        </div>
                        <div style="margin-top:8px;font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;">
                            Last updated: ${healthLastUpdated}
                            ${healthDaysSince > 90 ? ` ⚠️ Update needed (${healthDaysSince} days ago)` : ''}
                        </div>
                    </div>

                    <!-- ─── EMERGENCY CONTACT ─── -->
                    <div class="section-divider">
                        <div style="font-weight:600;margin-bottom:8px;font-family:'Georgia',serif;color:#2d2a1e;">📞 Emergency Contact</div>
                        <div class="form-group">
                            <div>
                                <label>Name</label>
                                <input type="text" id="profile-emergency-name" value="${emergency.name || ''}" placeholder="Full name">
                            </div>
                            <div>
                                <label>Phone</label>
                                <input type="text" id="profile-emergency-phone" value="${emergency.phone || ''}" placeholder="+960 777-1234">
                            </div>
                        </div>
                        <div>
                            <label>Relation</label>
                            <input type="text" id="profile-emergency-relation" value="${emergency.relation || ''}" placeholder="e.g., Father, Mother, Guardian">
                        </div>
                    </div>

                    <button type="submit" class="save-btn">Save Profile</button>
                </form>

                <div id="profile-message" class="message"></div>

                <div class="footer-note">
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
                const user = JSON.parse(localStorage.getItem('currentUser'));
                user.fullName = fullName;
                user.role = role;
                localStorage.setItem('currentUser', JSON.stringify(user));
            }
            
            document.getElementById('profile-message').textContent = '✅ Profile saved successfully!';
            document.getElementById('profile-message').style.color = '#27ae60';
            setTimeout(() => renderLeaderProfile(), 1200);
        } catch (error) {
            document.getElementById('profile-message').textContent = '❌ Error saving profile: ' + error.message;
            document.getElementById('profile-message').style.color = '#e74c3c';
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
