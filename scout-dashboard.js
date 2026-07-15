import { db } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, getDocs, onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { membershipRequirements } from './data/membership-requirements.js';
import { secondClassRequirements } from './data/secondclass-requirements.js';
import { firstClassRequirements } from './data/firstclass-requirements.js';
import { resizeImage } from './resize-image.js';
import { renderBadgePouch } from './badges.js';

// ─── State ──────────────────────────────────────────────
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'scout') {
    window.location.href = 'index.html';
}

// ─── DOM refs ────────────────────────────────────────────
const pageContent = document.getElementById('page-content');
const scoutNameEl = document.getElementById('scout-name');
const scoutSubtitle = document.getElementById('scout-subtitle');
const sidebarName = document.getElementById('sidebar-name');
const sidebarRank = document.getElementById('sidebar-rank');
const sidebarAvatar = document.getElementById('sidebar-avatar');
const pageHeading = document.getElementById('page-heading');

// ─── Set user info ──────────────────────────────────────
let displayName = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);

function updateDisplayName(name) {
    displayName = name;
    if (scoutNameEl) scoutNameEl.textContent = name;
    if (sidebarName) sidebarName.textContent = name;
    if (currentView === 'dashboard' && pageHeading) {
      pageHeading.innerHTML = `<div class="greeting">⛺ Welcome back, <span>${displayName}</span></div>`;  
    }
}

// ─── Avatar colors ──────────────────────────────────────
const colors = ['#6c3b8c', '#e67e22', '#8a5aa8', '#f39c12', '#4a2a5e', '#d35400'];
function getColor(name) {
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

const avatarColor = getColor(currentUser.username);
if (sidebarAvatar) sidebarAvatar.style.background = avatarColor;

// ─── IMPORTANT: Use username as document ID ──────────
const userDocId = currentUser.username;

// ─── State ──────────────────────────────────────────────
let currentView = 'dashboard';
let scoutStatus = {};
let allSessions = [];
let scoutData = { rank: 'Membership' };
let statusUnsubscribe = null;
let sessionsUnsubscribe = null;
let currentReportTab = '';
let currentReportReq = '';
let tempReportImages = [];
let scoutTickets = [];
let ticketsUnsubscribe = null;
let notifications = [];
let notificationCount = 0;

// ─── Load scout data ─────────────────────────────────────
async function loadScoutData() {
    const docRef = doc(db, 'users', userDocId);
    const docSnap = await getDoc(docRef);
    scoutData = docSnap.exists() ? docSnap.data() : { rank: 'Membership' };
    
    if (sidebarRank) sidebarRank.textContent = `⚜️ ${scoutData.rank || 'Membership'}`;
    
    if (scoutData.fullName) {
        updateDisplayName(scoutData.fullName);
    }
}

// ─── Real-time status listener ──────────────────────────
function listenToStatus() {
    if (statusUnsubscribe) {
        statusUnsubscribe();
        statusUnsubscribe = null;
    }
    
    const docRef = doc(db, 'scoutStatus', userDocId);
    statusUnsubscribe = onSnapshot(docRef, (docSnap) => {
        scoutStatus = docSnap.exists() ? docSnap.data() : {};
        if (currentView !== 'profile' && currentView !== 'reportModal') {
            renderView();
        }
    }, (error) => {
        console.error('Status listener error:', error);
    });
}

// ─── Real-time sessions listener ────────────────────────
function listenToSessions() {
    if (sessionsUnsubscribe) {
        sessionsUnsubscribe();
        sessionsUnsubscribe = null;
    }
    
    sessionsUnsubscribe = onSnapshot(collection(db, 'sessions'), (snapshot) => {
        allSessions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.attendance && data.attendance[userDocId] === true) {
                allSessions.push({ id: doc.id, ...data });
            }
        });
        if (currentView === 'sessions' || currentView === 'dashboard') {
            renderView();
        }
    }, (error) => {
        console.error('Sessions listener error:', error);
    });
}

// ─── Real-time tickets listener ──────────────────────────
function listenToTickets() {
    if (ticketsUnsubscribe) {
        ticketsUnsubscribe();
        ticketsUnsubscribe = null;
    }
    
    const ticketsRef = collection(db, 'tickets');
    const q = query(ticketsRef, where('scoutName', '==', currentUser.username));
    
    ticketsUnsubscribe = onSnapshot(q, (snapshot) => {
        scoutTickets = [];
        notifications = [];
        notificationCount = 0;
        
        snapshot.forEach(doc => {
            const ticket = { id: doc.id, ...doc.data() };
            scoutTickets.push(ticket);
            
            if (ticket.status === 'requirements_added') {
                notifications.push({
                    id: ticket.id,
                    type: 'requirements',
                    message: `Requirements added for "${ticket.badgeName}"`,
                    time: ticket.requirementsAddedAt?.seconds || Date.now(),
                    read: false,
                    ticketId: ticket.id
                });
                notificationCount++;
            }
            if (ticket.status === 'report_submitted') {
                notifications.push({
                    id: ticket.id,
                    type: 'report_submitted',
                    message: `Your report for "${ticket.badgeName}" is submitted`,
                    time: ticket.reportSubmittedAt?.seconds || Date.now(),
                    read: false,
                    ticketId: ticket.id
                });
                notificationCount++;
            }
            if (ticket.status === 'approved') {
                notifications.push({
                    id: ticket.id,
                    type: 'approved',
                    message: `"${ticket.badgeName}" has been approved!`,
                    time: ticket.decidedAt?.seconds || Date.now(),
                    read: false,
                    ticketId: ticket.id
                });
                notificationCount++;
            }
            if (ticket.status === 'rejected') {
                notifications.push({
                    id: ticket.id,
                    type: 'rejected',
                    message: `"${ticket.badgeName}" was rejected`,
                    time: ticket.decidedAt?.seconds || Date.now(),
                    read: false,
                    ticketId: ticket.id
                });
                notificationCount++;
            }
        });
        
        notifications.sort((a, b) => b.time - a.time);
        
        window.__scoutTickets = scoutTickets;
        
        if (currentView === 'badges') {
            if (window.renderBadgeGrid) {
                window.renderBadgeGrid();
            } else {
                renderBadgeView();
            }
        }
        if (currentView === 'dashboard') {
            renderView();
        }
    }, (error) => {
        console.error('Tickets listener error:', error);
    });
}

// ─── Save status ─────────────────────────────────────────
async function saveStatus() {
    await setDoc(doc(db, 'scoutStatus', userDocId), scoutStatus);
}

// ─── Check if badge is accessible ──────────────────────
function isBadgeAccessible(tab) {
    const rank = scoutData.rank || 'Membership';
    if (tab === 'membership') return true;
    if (tab === 'secondClass' && rank !== 'Membership') return true;
    if (tab === 'firstClass' && rank === 'First Class') return true;
    return false;
}

// ─── Render Locked Message ─────────────────────────────
function renderLockedMessage(tab) {
    const messages = {
        'secondClass': {
            title: 'Second Class',
            message: 'Complete your Membership badge first to unlock Second Class!',
            progress: 'Membership → Second Class'
        },
        'firstClass': {
            title: 'First Class',
            message: 'Complete your Second Class badge first to unlock First Class!',
            progress: 'Second Class → First Class'
        }
    };
    
    const info = messages[tab] || messages['secondClass'];
    return `
        <div style="text-align:center;padding:60px 20px;background:#fcf8f0;border-radius:24px;border:1px solid #e8dcc8;">
            <div style="font-size:48px;margin-bottom:16px;">🔒</div>
            <h2 style="color:#6b5f4a;font-family:'Georgia',serif;">${info.title}</h2>
            <p style="color:#8b7a6a;font-family:'Georgia',serif;font-size:16px;margin-top:8px;">${info.message}</p>
            <p style="color:#6b5f4a;font-family:'Georgia',serif;font-size:14px;margin-top:8px;">${info.progress}</p>
        </div>
    `;
}

// ─── Render Views ────────────────────────────────────────
function renderView() {
    if (!pageContent) return;
    pageContent.innerHTML = '';
    
    if (pageHeading) {
        if (currentView === 'dashboard') {
            pageHeading.innerHTML = `⛺ <span style="color:#3d2b1f;">${displayName}</span>`;
            if (scoutSubtitle) scoutSubtitle.textContent = 'Campsite';
        } else if (currentView === 'membership') {
            pageHeading.textContent = 'Membership';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Earn your Membership badge';
        } else if (currentView === 'second') {
            pageHeading.textContent = 'Second Class';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Earn your Second Class badge';
        } else if (currentView === 'first') {
            pageHeading.textContent = 'First Class';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Earn your First Class badge';
        } else if (currentView === 'badges') {
            pageHeading.textContent = 'Badges';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Your badge logbook';
        } else if (currentView === 'sessions') {
            pageHeading.textContent = 'Sessions';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Your attended sessions';
        } else if (currentView === 'profile') {
            pageHeading.textContent = 'Profile';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Manage your information';
        }
    }
    
    if (currentView === 'dashboard') renderDashboard();
    else if (currentView === 'membership') {
        if (isBadgeAccessible('membership')) {
            renderRequirements('membership', membershipRequirements);
        } else {
            pageContent.innerHTML = renderLockedMessage('membership');
        }
    }
    else if (currentView === 'second') {
        if (isBadgeAccessible('secondClass')) {
            renderRequirements('secondClass', secondClassRequirements);
        } else {
            pageContent.innerHTML = renderLockedMessage('secondClass');
        }
    }
    else if (currentView === 'first') {
        if (isBadgeAccessible('firstClass')) {
            renderRequirements('firstClass', firstClassRequirements);
        } else {
            pageContent.innerHTML = renderLockedMessage('firstClass');
        }
    }
    else if (currentView === 'badges') {
        renderBadgeView();
    }
    else if (currentView === 'sessions') renderSessions();
    else if (currentView === 'profile') renderProfile();
    else if (currentView === 'reportModal') renderReportModal();
}

// ─── Badge View ──────────────────────────────────────────
function renderBadgeView() {
    const displayName = scoutData.fullName || currentUser.username;
    const rank = scoutData.rank || 'Membership';
    window.__scoutTickets = scoutTickets;
    renderBadgePouch('page-content', displayName, rank);
    window.renderBadgeGrid = function() {
        if (currentView === 'badges') {
            window.__scoutTickets = scoutTickets;
            renderBadgePouch('page-content', displayName, rank);
        }
    };
}

// ─── DASHBOARD ──────────────────────────────────────────
function renderDashboard() {
    const rank = scoutData.rank || 'Membership';
    const patrol = scoutData.patrol || 'No Patrol';
    
    // ─── Determine current badge progress ──────────────────
    let currentReqs = [];
    let currentLabel = '';
    let currentKey = '';
    
    if (rank === 'Membership') {
        currentReqs = membershipRequirements;
        currentLabel = 'Membership';
        currentKey = 'membership';
    } else if (rank === 'Second Class') {
        currentReqs = secondClassRequirements;
        currentLabel = 'Second Class';
        currentKey = 'secondClass';
    } else if (rank === 'First Class') {
        currentReqs = firstClassRequirements;
        currentLabel = 'First Class';
        currentKey = 'firstClass';
    }
    
    // ─── Calculate progress ─────────────────────────────────
    let completed = 0;
    let total = currentReqs.length;
    for (const req of currentReqs) {
        const key = `${currentKey}_${req.name}`;
        const status = scoutStatus[key];
        if (status && status.status === 'approved') completed++;
    }
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference * (1 - progress / 100);

    // ─── Count earned badges ──────────────────────────────────
    const earnedBadges = scoutTickets.filter(t => t.status === 'approved');
    const badgeCount = earnedBadges.length;

    // ─── Active tickets ──────────────────────────────────────
    const activeTickets = scoutTickets.filter(t => 
        t.status === 'pending' || 
        t.status === 'requirements_added' || 
        t.status === 'report_submitted'
    );

    // ─── Scouting hours ──────────────────────────────────────
    let totalHours = 0;
    for (const session of allSessions) {
        totalHours += session.duration || 0;
    }

    // ─── Upcoming sessions (invites) ────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const upcomingSessions = allSessions
        .filter(s => s.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4);

    // ─── Attended sessions (past) ──────────────────────────
    const attendedSessions = allSessions
        .filter(s => s.date < today)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4);

    // ─── Unread notifications ────────────────────────────────
    const unreadNotifications = notifications.filter(n => !n.read);
    const hasNotifications = unreadNotifications.length > 0;

    // ─── Patrol colors ──────────────────────────────────────
    const patrolColors = {
        'Eagle': '#f1c40f',
        'Falcon': '#3498db',
        'Wolf': '#95a5a6',
        'Bear': '#8d6e63',
        'Lion': '#e67e22'
    };
    const patrolColor = patrolColors[patrol] || '#6c3b8c';

    // ─── Achievements ──────────────────────────────────────
    const achievements = [
        { key: 'membership', label: 'Membership', icon: '🏅', earned: rank !== 'Membership' },
        { key: 'second', label: 'Second Class', icon: '⭐', earned: rank === 'Second Class' || rank === 'First Class' },
        { key: 'first', label: 'First Class', icon: '🌟', earned: rank === 'First Class' },
        { key: 'badges', label: 'Badge Collector', icon: '🎯', earned: badgeCount >= 1 }
    ];

    // ─── Build HTML ──────────────────────────────────────────
    let html = `
        <style>
            .campsite {
                max-width: 100%;
                padding: 0;
                font-family: 'Georgia', 'Times New Roman', serif;
                background: #f5ede0;
            }

            /* ─── WELCOME BAR ─── */
            .welcome-bar {
                background: #fcf8f0;
                border-radius: 20px;
                padding: 24px 28px;
                margin-bottom: 24px;
                border: 1px solid #e8dcc8;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }
            .welcome-bar .greeting {
                font-size: 22px;
                color: #3d2b1f;
                margin-bottom: 12px;
                font-weight: 400;
            }
            .welcome-bar .greeting span {
                color: #6c3b8c;
                font-weight: 600;
            }
            .welcome-bar .stats-row {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
            }
            .welcome-bar .stat-pill {
                background: #f5ede0;
                padding: 10px 16px;
                border-radius: 40px;
                text-align: center;
                border: 1px solid #e8dcc8;
            }
            .welcome-bar .stat-pill .label {
                font-size: 11px;
                color: #8b7a6a;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .welcome-bar .stat-pill .value {
                font-size: 15px;
                font-weight: 700;
                color: #3d2b1f;
                margin-top: 2px;
            }
            .welcome-bar .stat-pill .value.rank { color: #6c3b8c; }
            .welcome-bar .stat-pill .value.patrol { color: ${patrolColor}; }
            .welcome-bar .stat-pill .value.progress { color: #e67e22; }
            .welcome-bar .stat-pill .value.badges { color: #2d5a4a; }

            /* ─── PROGRESS RING ─── */
            .ring-container {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 20px;
                margin: 0 auto;
            }
            .ring-wrapper {
                position: relative;
                width: 100px;
                height: 100px;
            }
            .ring-wrapper svg {
                transform: rotate(-90deg);
            }
            .ring-wrapper .ring-bg {
                fill: none;
                stroke: #e8dcc8;
                stroke-width: 8;
            }
            .ring-wrapper .ring-fill {
                fill: none;
                stroke: url(#progressGradient);
                stroke-width: 8;
                stroke-linecap: round;
                stroke-dasharray: ${circumference};
                stroke-dashoffset: ${offset};
                transition: stroke-dashoffset 0.8s ease;
            }
            .ring-wrapper .center-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                font-family: 'Georgia', serif;
            }
            .ring-wrapper .center-text .number {
                font-size: 22px;
                font-weight: 700;
                color: #3d2b1f;
            }
            .ring-wrapper .center-text .label {
                font-size: 10px;
                color: #8b7a6a;
            }

            /* ─── STATS CARDS ─── */
            .stats-grid {
                display: grid;
                grid-template-columns: 1fr 2fr 1fr;
                gap: 16px;
                margin-bottom: 24px;
            }
            .stat-card {
                background: #fcf8f0;
                border-radius: 16px;
                padding: 20px;
                text-align: center;
                border: 1px solid #e8dcc8;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .stat-card .number {
                font-size: 28px;
                font-weight: 700;
                color: #3d2b1f;
                font-family: 'Georgia', serif;
            }
            .stat-card .label {
                font-size: 13px;
                color: #8b7a6a;
                font-family: 'Georgia', serif;
                margin-top: 4px;
            }
            .stat-card .sub {
                font-size: 12px;
                color: #b8a080;
                font-family: 'Georgia', serif;
                margin-top: 2px;
            }
            .stat-card .icon-svg {
                width: 32px;
                height: 32px;
                margin-bottom: 8px;
                stroke: #6c3b8c;
                stroke-width: 2;
                fill: none;
            }
            .stat-card.hours .icon-svg { stroke: #2d5a4a; }
            .stat-card.badges .icon-svg { stroke: #e67e22; }

            /* ─── NOTIFICATIONS ─── */
            .notification-board {
                background: ${hasNotifications ? '#fcf8f0' : '#fcf8f0'};
                border-radius: 16px;
                padding: 16px 20px;
                margin-bottom: 24px;
                border: 1px solid ${hasNotifications ? '#e67e22' : '#e8dcc8'};
                border-left: 4px solid ${hasNotifications ? '#e67e22' : '#e8dcc8'};
            }
            .notification-board .notif-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .notification-board .notif-header .title {
                font-weight: 600;
                font-size: 15px;
                color: #3d2b1f;
            }
            .notification-board .notif-header .badge {
                background: ${hasNotifications ? '#e67e22' : '#e8dcc8'};
                color: ${hasNotifications ? 'white' : '#8b7a6a'};
                padding: 2px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }
            .notification-board .notif-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 12px;
                border-radius: 8px;
                background: #f5ede0;
                font-size: 13px;
                color: #3d2b1f;
                cursor: pointer;
                transition: background 0.2s;
                margin-bottom: 4px;
            }
            .notification-board .notif-item:hover {
                background: #e8dcc8;
            }
            .notification-board .notif-item .time {
                font-size: 10px;
                color: #8b7a6a;
            }
            .notification-board .clear-btn {
                background: ${hasNotifications ? '#e67e22' : '#e8dcc8'};
                color: ${hasNotifications ? 'white' : '#8b7a6a'};
                border: none;
                padding: 4px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                margin-top: 4px;
                float: right;
            }
            .notification-board .clear-btn:hover {
                transform: scale(1.05);
                opacity: 0.9;
            }
            .notification-board .empty {
                color: #8b7a6a;
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
                border: 1px solid #e8dcc8;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
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
                color: #3d2b1f;
            }
            .card .card-header .link {
                font-size: 13px;
                color: #6c3b8c;
                text-decoration: none;
                font-weight: 500;
                cursor: pointer;
            }
            .card .card-header .link:hover {
                text-decoration: underline;
            }
            .card .empty {
                text-align: center;
                padding: 16px 0;
                color: #8b7a6a;
                font-style: italic;
                font-size: 14px;
            }

            /* ─── TICKET ITEM ─── */
            .ticket-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #e8dcc8;
                cursor: pointer;
                transition: background 0.2s;
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
            .ticket-item .left .info .name {
                font-size: 14px;
                font-weight: 500;
                color: #3d2b1f;
            }
            .ticket-item .left .info .status {
                font-size: 12px;
                color: #8b7a6a;
            }
            .ticket-item .status-badge {
                font-size: 14px;
            }

            /* ─── SESSION ITEM ─── */
            .session-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 0;
                border-bottom: 1px solid #e8dcc8;
            }
            .session-item:last-child {
                border-bottom: none;
            }
            .session-item .left .name {
                font-size: 13px;
                color: #3d2b1f;
            }
            .session-item .left .meta {
                font-size: 12px;
                color: #8b7a6a;
            }
            .session-item .tag {
                font-size: 10px;
                font-weight: 600;
                padding: 2px 10px;
                border-radius: 20px;
            }
            .session-item .tag.today {
                background: #fde8d0;
                color: #d35400;
            }
            .session-item .tag.upcoming {
                background: #d4edda;
                color: #155724;
            }
            .session-item .tag.attended {
                background: #e8dcc8;
                color: #6c3b8c;
            }
            .session-item .hours {
                font-size: 12px;
                color: #8b7a6a;
                font-weight: 500;
            }

            /* ─── ATTENDED SESSIONS ─── */
            .attended-footer {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #e8dcc8;
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                color: #8b7a6a;
            }
            .attended-footer .total {
                font-weight: 600;
                color: #3d2b1f;
            }

            /* ─── ACHIEVEMENTS ─── */
            .achieve-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
            }
            .achieve-item {
                text-align: center;
                padding: 16px;
                border-radius: 12px;
                border: 2px solid #e8dcc8;
                transition: all 0.2s;
                background: #fcf8f0;
            }
            .achieve-item.earned {
                border-color: #6c3b8c;
                background: #f5ede0;
            }
            .achieve-item.locked {
                opacity: 0.5;
            }
            .achieve-item .icon {
                font-size: 28px;
            }
            .achieve-item .label {
                font-size: 11px;
                color: #3d2b1f;
                margin-top: 6px;
                font-weight: 500;
            }
            .achieve-item .status {
                font-size: 10px;
                font-weight: 600;
                margin-top: 4px;
            }
            .achieve-item .status.earned {
                color: #6c3b8c;
            }
            .achieve-item .status.locked {
                color: #8b7a6a;
            }
            .achieve-footer {
                text-align: center;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #e8dcc8;
                font-size: 13px;
                color: #8b7a6a;
            }
            .achieve-footer .count {
                font-weight: 600;
                color: #6c3b8c;
            }

            /* ─── RESPONSIVE ─── */
            @media (max-width: 992px) {
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                .two-col {
                    grid-template-columns: 1fr;
                }
                .achieve-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .welcome-bar .stats-row {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            @media (max-width: 480px) {
                .welcome-bar {
                    padding: 16px;
                }
                .welcome-bar .greeting {
                    font-size: 18px;
                }
                .welcome-bar .stats-row {
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                .welcome-bar .stat-pill {
                    padding: 8px 12px;
                }
                .welcome-bar .stat-pill .value {
                    font-size: 13px;
                }
                .card {
                    padding: 16px;
                }
                .achieve-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .ring-wrapper {
                    width: 70px;
                    height: 70px;
                }
                .ring-wrapper .center-text .number {
                    font-size: 16px;
                }
            }
        </style>

        <div class="campsite">
            <!-- ─── SVG GRADIENT ─── -->
            <svg width="0" height="0">
                <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#6c3b8c;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#e67e22;stop-opacity:1" />
                    </linearGradient>
                </defs>
            </svg>

            <!-- ─── WELCOME BAR ─── -->
            <div class="welcome-bar">
                
                <div class="stats-row">
                    <div class="stat-pill">
                        <div class="label">Rank</div>
                        <div class="value rank">${rank}</div>
                    </div>
                    <div class="stat-pill">
                        <div class="label">Patrol</div>
                        <div class="value patrol">${patrol}</div>
                    </div>
                    <div class="stat-pill">
                        <div class="label">Progress</div>
                        <div class="value progress">${progress}%</div>
                    </div>
                    <div class="stat-pill">
                        <div class="label">Badges</div>
                        <div class="value badges">${badgeCount}</div>
                    </div>
                </div>
            </div>

            <!-- ─── STATS CARDS ─── -->
            <div class="stats-grid">
                <!-- Progress Ring -->
                <div class="stat-card">
                    <div class="ring-wrapper">
                        <svg width="100" height="100" viewBox="0 0 100 100">
                            <circle class="ring-bg" cx="50" cy="50" r="45"/>
                            <circle class="ring-fill" cx="50" cy="50" r="45"/>
                        </svg>
                        <div class="center-text">
                            <div class="number">${progress}%</div>
                            <div class="label">${currentLabel}</div>
                        </div>
                    </div>
                </div>

                <!-- Scouting Hours -->
                <div class="stat-card hours">
                    <svg class="icon-svg" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <div class="number">${totalHours}</div>
                    <div class="label">Scouting Hours</div>
                    <div class="sub">${allSessions.length} sessions attended</div>
                </div>

                <!-- Badges Earned -->
                <div class="stat-card badges">
                    <svg class="icon-svg" viewBox="0 0 24 24">
                        <path d="M12 2L9.5 9.5L2 9.5L8 14.5L5.5 22L12 17.5L18.5 22L16 14.5L22 9.5L14.5 9.5L12 2z"/>
                    </svg>
                    <div class="number">${badgeCount}</div>
                    <div class="label">Badges Earned</div>
                    <div class="sub">Keep going!</div>
                </div>
            </div>

            <!-- ─── NOTIFICATIONS ─── -->
            <div class="notification-board">
                <div class="notif-header">
                    <span class="title">Notifications</span>
                    <span class="badge">${unreadNotifications.length} new</span>
                </div>
                ${notifications.length > 0 ? `
                    ${notifications.slice(0, 3).map(n => `
                        <div class="notif-item" onclick="window.location.href='report-viewer-ticket.html?ticketId=${n.ticketId}'">
                            <span>${n.message}</span>
                            <span class="time">${n.read ? 'Read' : 'New'}</span>
                        </div>
                    `).join('')}
                    ${notifications.length > 3 ? `<div style="text-align:center;padding:4px;font-size:12px;color:#8b7a6a;">+${notifications.length - 3} more</div>` : ''}
                    ${hasNotifications ? `
                        <button class="clear-btn" id="clearNotifsBtn">Mark All Read</button>
                    ` : ''}
                ` : `
                    <div class="empty">No new notifications</div>
                `}
            </div>

            <!-- ─── TWO COLUMN ─── -->
            <div class="two-col">
                <!-- ─── ACTIVE TICKETS ─── -->
                <div class="card">
                    <div class="card-header">
                        <span class="title">Active Tickets</span>
                        ${activeTickets.length > 0 ? `<a href="#" data-view="badges" class="link">View All →</a>` : ''}
                    </div>
                    ${activeTickets.length > 0 ? `
                        ${activeTickets.slice(0, 4).map(t => {
                            const statusMap = {
                                'pending': { emoji: '⏳', label: 'Waiting' },
                                'requirements_added': { emoji: '📋', label: 'Assigned' },
                                'report_submitted': { emoji: '📤', label: 'Submitted' }
                            };
                            const s = statusMap[t.status] || { emoji: '📌', label: t.status };
                            return `
                                <div class="ticket-item" onclick="window.location.href='report-viewer-ticket.html?ticketId=${t.id}'">
                                    <div class="left">
                                        <div class="info">
                                            <div class="name">${t.badgeIcon || '🏅'} ${t.badgeName}</div>
                                            <div class="status">${s.label}</div>
                                        </div>
                                    </div>
                                    <span class="status-badge">${s.emoji}</span>
                                </div>
                            `;
                        }).join('')}
                        ${activeTickets.length > 4 ? `<div style="text-align:center;padding:4px;font-size:12px;color:#8b7a6a;">+${activeTickets.length - 4} more</div>` : ''}
                    ` : `
                        <div class="empty">No active tickets — all clear!</div>
                    `}
                </div>

                <!-- ─── SESSION INVITES ─── -->
                <div class="card">
                    <div class="card-header">
                        <span class="title">Session Invites</span>
                        ${upcomingSessions.length > 0 ? `<a href="#" data-view="sessions" class="link">View All →</a>` : ''}
                    </div>
                    ${upcomingSessions.length > 0 ? `
                        ${upcomingSessions.map(s => `
                            <div class="session-item">
                                <div class="left">
                                    <div class="name">${s.name}</div>
                                    <div class="meta">${s.date}</div>
                                </div>
                                <span class="tag ${s.date === today ? 'today' : 'upcoming'}">${s.date === today ? 'Today' : 'Upcoming'}</span>
                            </div>
                        `).join('')}
                    ` : `
                        <div class="empty">No upcoming sessions</div>
                    `}
                </div>
            </div>

            <!-- ─── ATTENDED SESSIONS ─── -->
            <div class="card" style="margin-bottom:24px;">
                <div class="card-header">
                    <span class="title">Attended Sessions</span>
                    ${attendedSessions.length > 0 ? `<a href="#" data-view="sessions" class="link">View All →</a>` : ''}
                </div>
                ${attendedSessions.length > 0 ? `
                    ${attendedSessions.map(s => `
                        <div class="session-item">
                            <div class="left">
                                <div class="name">${s.name}</div>
                                <div class="meta">${s.date}</div>
                            </div>
                            <span class="hours">${s.duration || 0}h</span>
                        </div>
                    `).join('')}
                    <div class="attended-footer">
                        <span>Total: <span class="total">${allSessions.length}</span> sessions</span>
                        <span><span class="total">${totalHours}</span> hours</span>
                    </div>
                ` : `
                    <div class="empty">No attended sessions yet</div>
                `}
            </div>

            <!-- ─── ACHIEVEMENTS ─── -->
            <div class="card">
                <div class="card-header">
                    <span class="title">Achievements</span>
                </div>
                <div class="achieve-grid">
                    ${achievements.map(a => `
                        <div class="achieve-item ${a.earned ? 'earned' : 'locked'}">
                            <div class="icon">${a.icon}</div>
                            <div class="label">${a.label}</div>
                            <div class="status ${a.earned ? 'earned' : 'locked'}">${a.earned ? 'Earned' : 'Locked'}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="achieve-footer">
                    <span class="count">${achievements.filter(a => a.earned).length}</span> of ${achievements.length} achievements unlocked
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
            document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
            renderView();
        });
    });

    // ─── Clear notifications ──────────────────────────────────
    const clearBtn = document.getElementById('clearNotifsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            notifications.forEach(n => n.read = true);
            renderDashboard();
        });
    }
}

// ─── Requirements View ──────────────────────────────────
function renderRequirements(tab, reqs) {
    let completed = 0, pending = 0;
    for (const req of reqs) {
        const key = `${tab}_${req.name}`;
        const status = scoutStatus[key];
        if (status && status.status === 'approved') completed++;
        else if (status && status.status === 'pending') pending++;
    }
    const total = reqs.length;
    const progress = Math.round((completed / total) * 100);

    let html = `
        <div style="margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;font-size:14px;color:#3d2b1f;font-family:'Georgia',serif;margin-bottom:8px;">
                <span>Progress</span>
                <span>${completed}/${total}</span>
            </div>
            <div style="background:#e8dcc8;border-radius:20px;height:10px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,0.05);">
                <div style="background:linear-gradient(90deg,#6c3b8c,#e67e22);height:100%;width:${progress}%;border-radius:20px;transition:width 0.8s ease;"></div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            ${reqs.map(req => {
                const key = `${tab}_${req.name}`;
                const data = scoutStatus[key];
                const status = data ? data.status : 'todo';
                
                let statusPill = '';
                if (status === 'approved') {
                    statusPill = `<span style="background:#d4edda;color:#155724;padding:4px 16px;border-radius:40px;font-size:12px;font-weight:500;font-family:'Georgia',serif;">Complete</span>`;
                } else if (status === 'pending') {
                    statusPill = `<span style="background:#fde8d0;color:#d35400;padding:4px 16px;border-radius:40px;font-size:12px;font-weight:500;cursor:pointer;font-family:'Georgia',serif;" data-req="${req.name}" data-tab="${tab}">Pending</span>`;
                } else {
                    statusPill = `<button style="background:#e67e22;color:white;border:none;padding:4px 16px;border-radius:40px;font-size:12px;font-weight:500;cursor:pointer;font-family:'Georgia',serif;" class="ready-btn" data-req="${req.name}" data-tab="${tab}">Mark Ready</button>`;
                }
                
                let approvedInfo = '';
                if (status === 'approved' && data) {
                    const approvedBy = data.approvedBy || 'Unknown';
                    const approvedAt = data.approvedAt ? new Date(data.approvedAt).toLocaleString() : 'Unknown date';
                    approvedInfo = `<div style="font-size:11px;color:#8b7a6a;margin-top:6px;font-family:'Georgia',serif;">Approved by ${approvedBy} · ${approvedAt}</div>`;
                }
                
                const reportKey = `${tab}_${req.name}_report`;
                const hasReport = scoutStatus[reportKey] && (scoutStatus[reportKey].note || (scoutStatus[reportKey].images && scoutStatus[reportKey].images.length > 0));
                
                let reportBtn = '';
                if (hasReport) {
                    reportBtn = `<a href="report-viewer.html?email=${userDocId}&tab=${tab}&req=${encodeURIComponent(req.name)}" style="background:#6c3b8c;color:white;border:none;padding:4px 12px;border-radius:40px;font-size:12px;cursor:pointer;font-weight:500;text-decoration:none;display:inline-block;font-family:'Georgia',serif;">View Report</a>`;
                } else {
                    reportBtn = `<button style="background:#e8dcc8;color:#3d2b1f;border:none;padding:4px 12px;border-radius:40px;font-size:12px;cursor:pointer;font-weight:500;font-family:'Georgia',serif;" class="report-btn no-report" data-req="${req.name}" data-tab="${tab}">Add Report</button>`;
                }
                
                return `
                    <div style="background:#fcf8f0;border-radius:16px;padding:16px 20px;border-left:4px solid ${status === 'approved' ? '#27ae60' : status === 'pending' ? '#e67e22' : '#e8dcc8'};">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
                            <span style="font-weight:600;font-size:14px;color:#3d2b1f;font-family:'Georgia',serif;">${req.id}. ${req.name}</span>
                            ${statusPill}
                        </div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
                            <a href="requirement-detail.html?name=${encodeURIComponent(req.name)}&tab=${tab}" style="font-size:12px;color:#6c3b8c;text-decoration:underline;cursor:pointer;font-family:'Georgia',serif;">Notes</a>
                            ${reportBtn}
                        </div>
                        ${approvedInfo}
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
            scoutStatus[key] = { 
                status: 'pending',
                updatedAt: new Date().toISOString()
            };
            await saveStatus();
        });
    });

    document.querySelectorAll('.pending-badge').forEach(badge => {
        badge.addEventListener('click', async function() {
            const reqName = this.dataset.req;
            const tabName = this.dataset.tab;
            const key = `${tabName}_${reqName}`;
            delete scoutStatus[key];
            await saveStatus();
        });
    });

    document.querySelectorAll('.report-btn.no-report').forEach(btn => {
        btn.addEventListener('click', function() {
            currentReportTab = this.dataset.tab;
            currentReportReq = this.dataset.req;
            tempReportImages = [];
            currentView = 'reportModal';
            renderView();
        });
    });
}

// ─── Report Modal ──────────────────────────────────────
function renderReportModal() {
    const key = `${currentReportTab}_${currentReportReq}_report`;
    const report = scoutStatus[key] || { note: '', images: [], updatedAt: null };
    const allImages = report.images || [];

    let html = `
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fcf8f0;border-radius:24px;padding:32px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid #e8dcc8;">
                
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2 style="color:#3d2b1f;margin:0;font-family:'Georgia',serif;">Report: ${currentReportReq}</h2>
                    <button id="close-report-modal" style="background:none;border:none;font-size:28px;cursor:pointer;color:#8b7a6a;">×</button>
                </div>
                
                <div style="margin-bottom:16px;">
                    <label style="font-weight:600;display:block;margin-bottom:6px;font-family:'Georgia',serif;color:#3d2b1f;">Your Report Note</label>
                    <textarea id="report-note" style="width:100%;padding:12px;border-radius:12px;border:1px solid #e8dcc8;font-family:inherit;font-size:14px;min-height:100px;resize:vertical;background:#f5ede0;">${report.note || ''}</textarea>
                </div>
                
                <div style="margin-bottom:16px;">
                    <label style="font-weight:600;display:block;margin-bottom:6px;font-family:'Georgia',serif;color:#3d2b1f;">Upload Images</label>
                    <div id="drop-zone" style="border:2px dashed #e8dcc8;border-radius:12px;padding:30px;text-align:center;cursor:pointer;transition:all 0.2s;background:#f5ede0;">
                        <div style="font-size:40px;margin-bottom:8px;">📸</div>
                        <p style="color:#8b7a6a;">Drag & drop images here, or click to select</p>
                        <p style="font-size:12px;color:#8b7a6a;">Images will be compressed to ~100-200KB (max 5 images)</p>
                        <input type="file" id="image-upload" multiple accept="image/*" style="display:none;">
                    </div>
                </div>
                
                <div id="image-preview-container" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
                    ${allImages.map((base64, index) => `
                        <div style="position:relative;width:100px;height:100px;border-radius:12px;overflow:hidden;border:2px solid #e8dcc8;">
                            <img src="${base64}" style="width:100%;height:100%;object-fit:cover;">
                            <button class="remove-image" data-index="${index}" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">×</button>
                        </div>
                    `).join('')}
                </div>
                
                <div style="display:flex;gap:12px;margin-top:16px;">
                    <button id="save-report" style="flex:1;background:#6c3b8c;color:white;border:none;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Georgia',serif;">Save Report</button>
                    <button id="cancel-report" style="flex:1;background:#e8dcc8;color:#3d2b1f;border:none;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Georgia',serif;">Cancel</button>
                </div>
                
                <div id="report-message" style="margin-top:12px;font-size:14px;color:#8b7a6a;text-align:center;font-family:'Georgia',serif;"></div>
                ${report.updatedAt ? `<div style="margin-top:8px;font-size:12px;color:#8b7a6a;text-align:center;font-family:'Georgia',serif;">Last saved: ${new Date(report.updatedAt).toLocaleString()}</div>` : ''}
            </div>
        </div>
    `;

    pageContent.innerHTML = html;

    document.getElementById('close-report-modal').addEventListener('click', () => {
        currentView = currentReportTab === 'membership' ? 'membership' : 
                     currentReportTab === 'secondClass' ? 'second' : 'first';
        renderView();
    });
    document.getElementById('cancel-report').addEventListener('click', () => {
        currentView = currentReportTab === 'membership' ? 'membership' : 
                     currentReportTab === 'secondClass' ? 'second' : 'first';
        renderView();
    });

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('image-upload');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#6c3b8c';
        dropZone.style.background = '#f5ede0';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#e8dcc8';
        dropZone.style.background = '#f5ede0';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#e8dcc8';
        dropZone.style.background = '#f5ede0';
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));

    async function handleFiles(files) {
        const container = document.getElementById('image-preview-container');
        const message = document.getElementById('report-message');
        
        if (allImages.length + files.length > 5) {
            message.textContent = '⚠️ Maximum 5 images allowed. You have ' + allImages.length + ' already.';
            message.style.color = '#d35400';
            return;
        }
        
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                message.textContent = '⚠️ Please select image files only.';
                message.style.color = '#d35400';
                continue;
            }
            
            try {
                const base64 = await resizeImage(file, 600, 0.7);
                allImages.push(base64);
                
                const imgDiv = document.createElement('div');
                imgDiv.style.cssText = 'position:relative;width:100px;height:100px;border-radius:12px;overflow:hidden;border:2px solid #e8dcc8;';
                imgDiv.innerHTML = `
                    <img src="${base64}" style="width:100%;height:100%;object-fit:cover;">
                    <button class="remove-image" data-index="${allImages.length - 1}" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">×</button>
                `;
                container.appendChild(imgDiv);
                
                message.textContent = `✅ ${file.name} uploaded (${Math.round(base64.length / 1024)}KB)`;
                message.style.color = '#27ae60';
                
                imgDiv.querySelector('.remove-image').addEventListener('click', function() {
                    const idx = parseInt(this.dataset.index);
                    removeImage(idx);
                });
                
            } catch (error) {
                console.error('Upload error:', error);
                message.textContent = '❌ Error uploading image: ' + error.message;
                message.style.color = '#e74c3c';
            }
        }
    }

    function removeImage(index) {
        allImages.splice(index, 1);
        const container = document.getElementById('image-preview-container');
        container.innerHTML = allImages.map((base64, i) => `
            <div style="position:relative;width:100px;height:100px;border-radius:12px;overflow:hidden;border:2px solid #e8dcc8;">
                <img src="${base64}" style="width:100%;height:100%;object-fit:cover;">
                <button class="remove-image" data-index="${i}" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">×</button>
            </div>
        `).join('');
        
        document.querySelectorAll('.remove-image').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.dataset.index);
                removeImage(idx);
            });
        });
    }

    document.getElementById('save-report').addEventListener('click', async function() {
        const note = document.getElementById('report-note').value.trim();
        const key = `${currentReportTab}_${currentReportReq}_report`;
        const message = document.getElementById('report-message');
        
        if (!note && allImages.length === 0) {
            message.textContent = '⚠️ Please add a note or at least one image.';
            message.style.color = '#d35400';
            return;
        }
        
        try {
            const docRef = doc(db, 'scoutStatus', userDocId);
            const docSnap = await getDoc(docRef);
            const data = docSnap.data() || {};
            
            data[key] = {
                note: note || '',
                images: allImages,
                updatedAt: new Date().toISOString()
            };
            
            await setDoc(docRef, data);
            scoutStatus = data;
            
            message.textContent = '✅ Report saved successfully!';
            message.style.color = '#27ae60';
            
            setTimeout(() => {
                currentView = currentReportTab === 'membership' ? 'membership' : 
                             currentReportTab === 'secondClass' ? 'second' : 'first';
                renderView();
            }, 1000);
            
        } catch (error) {
            message.textContent = '❌ Error saving report: ' + error.message;
            message.style.color = '#e74c3c';
        }
    });
}

// ─── Sessions View ──────────────────────────────────────
function renderSessions() {
    if (allSessions.length === 0) {
        pageContent.innerHTML = `
            <div style="text-align:center;padding:40px 0;">
                <div style="font-size:64px;margin-bottom:16px;">📅</div>
                <h3 style="color:#3d2b1f;margin-bottom:8px;font-family:'Georgia',serif;">No sessions yet</h3>
                <p style="color:#8b7a6a;font-family:'Georgia',serif;">You haven't attended any sessions yet.</p>
            </div>
        `;
        return;
    }
    
    let totalHours = 0;
    for (const session of allSessions) {
        totalHours += session.duration || 0;
    }

    let contentHtml = `
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
            <div style="background:#fcf8f0;border-radius:16px;padding:12px;text-align:center;border:1px solid #e8dcc8;">
                <div style="font-size:24px;font-weight:700;color:#6c3b8c;font-family:'Georgia',serif;">${allSessions.length}</div>
                <div style="font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;">Sessions Attended</div>
            </div>
            <div style="background:#fcf8f0;border-radius:16px;padding:12px;text-align:center;border:1px solid #e8dcc8;">
                <div style="font-size:24px;font-weight:700;color:#e67e22;font-family:'Georgia',serif;">${totalHours}</div>
                <div style="font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;">Hours of Scouting</div>
            </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
    `;
    
    for (const session of allSessions) {
        contentHtml += `
            <div style="background:#fcf8f0;border-radius:20px;padding:16px;border:1px solid #e8dcc8;cursor:pointer;transition:transform 0.2s;border-left:4px solid #6c3b8c;" onclick="window.location.href='session-detail-scout.html?id=${session.id}'">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px;">
                    <div>
                        <div style="font-weight:600;font-size:18px;color:#3d2b1f;font-family:'Georgia',serif;">${session.name}</div>
                        <div style="color:#8b7a6a;font-size:14px;font-family:'Georgia',serif;">${session.date} · ${session.time} · ${session.location || 'TBD'}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="background:#d4edda;color:#155724;padding:2px 10px;border-radius:12px;font-size:12px;font-family:'Georgia',serif;">Attended</span>
                        <span style="font-size:14px;font-weight:600;color:#6c3b8c;font-family:'Georgia',serif;">${session.duration || 0}h</span>
                    </div>
                </div>
            </div>
        `;
    }
    contentHtml += '</div>';
    pageContent.innerHTML = contentHtml;
}

// ─── Profile View ──────────────────────────────────────────
async function renderProfile() {
    const userDoc = await getDoc(doc(db, 'users', userDocId));
    const data = userDoc.data();

    if (!data) {
        pageContent.innerHTML = `<p style="color:#8b7a6a;padding:40px;text-align:center;font-family:'Georgia',serif;">Profile not found.</p>`;
        return;
    }

    const fullName = data.fullName || currentUser.username;
    const dob = data.dob || '';
    const patrol = data.patrol || '';
    const rank = data.rank || 'Membership';
    const role = data.scoutRole || 'Scout';
    const emergency = data.emergencyContact || {};
    const health = data.health || {};
    
    const healthLastUpdated = health.lastUpdated ? new Date(health.lastUpdated).toLocaleDateString() : 'Never';
    const healthDaysSince = health.lastUpdated ? Math.floor((new Date() - new Date(health.lastUpdated)) / (1000 * 60 * 60 * 24)) : 999;
    const healthStatus = healthDaysSince > 90 ? '⚠️ Needs update' : '✅ Up to date';
    const healthStatusColor = healthDaysSince > 90 ? '#d35400' : '#27ae60';

    let html = `
        <div style="max-width:600px;margin:0 auto;">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
                <span id="profile-back" style="cursor:pointer;color:#8b7a6a;font-size:18px;font-family:'Georgia',serif;">←</span>
                <h2 style="color:#3d2b1f;margin:0;font-family:'Georgia',serif;">Profile</h2>
            </div>

            <div style="background:#fcf8f0;border-radius:24px;padding:32px;border:1px solid #e8dcc8;">
                <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
                    <div style="width:80px;height:80px;background:${avatarColor};border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;">
                        <div style="width:24px;height:24px;border-radius:50%;background:white;position:absolute;top:16px;"></div>
                        <div style="width:38px;height:22px;border-radius:50% 50% 0 0;background:white;position:absolute;bottom:14px;"></div>
                    </div>
                    <div>
                        <div style="font-size:24px;font-weight:700;color:#3d2b1f;font-family:'Georgia',serif;">${fullName}</div>
                        <div style="color:#8b7a6a;font-family:'Georgia',serif;">${patrol || 'No patrol'} · ${rank}</div>
                    </div>
                </div>

                <form id="profile-form">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                        <div>
                            <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-family:'Georgia',serif;">Full Name</label>
                            <input type="text" id="profile-fullname" value="${fullName}" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                        </div>
                        <div>
                            <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-family:'Georgia',serif;">Date of Birth</label>
                            <input type="date" id="profile-dob" value="${dob}" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                        <div>
                            <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-family:'Georgia',serif;">Patrol</label>
                            <input type="text" id="profile-patrol" value="${patrol}" placeholder="e.g., Eagle" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                        </div>
                        <div>
                            <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-family:'Georgia',serif;">Role</label>
                            <input type="text" id="profile-role" value="${role}" disabled style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;background:#f5ede0;color:#8b7a6a;font-family:'Georgia',serif;">
                            <span style="font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;">(Set by leader)</span>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                        <div>
                            <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-family:'Georgia',serif;">Rank</label>
                            <input type="text" id="profile-rank" value="${rank}" disabled style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;background:#f5ede0;color:#8b7a6a;font-family:'Georgia',serif;">
                            <span style="font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;">(Set by leader)</span>
                        </div>
                    </div>

                    <div style="border-top:1px solid #e8dcc8;padding-top:16px;margin-top:16px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                            <div style="font-weight:600;font-size:16px;font-family:'Georgia',serif;color:#3d2b1f;">Health Information</div>
                            <span style="font-size:12px;color:${healthStatusColor};font-family:'Georgia',serif;">${healthStatus}</span>
                        </div>
                        
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                            <div>
                                <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-size:13px;font-family:'Georgia',serif;">Allergies</label>
                                <input type="text" id="health-allergies" value="${health.allergies || ''}" placeholder="e.g., Peanuts, Shellfish" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                            </div>
                            <div>
                                <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-size:13px;font-family:'Georgia',serif;">Medical Conditions</label>
                                <input type="text" id="health-conditions" value="${health.conditions || ''}" placeholder="e.g., Asthma, Diabetes" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
                            <div>
                                <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-size:13px;font-family:'Georgia',serif;">Medications</label>
                                <input type="text" id="health-medications" value="${health.medications || ''}" placeholder="e.g., Inhaler" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                            </div>
                            <div>
                                <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-size:13px;font-family:'Georgia',serif;">Additional Notes</label>
                                <input type="text" id="health-notes" value="${health.notes || ''}" placeholder="e.g., Carry inhaler at all times" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                            </div>
                        </div>
                        <div style="margin-top:8px;font-size:12px;color:#8b7a6a;font-family:'Georgia',serif;">
                            Last updated: ${healthLastUpdated}
                            ${healthDaysSince > 90 ? ` ⚠️ Update needed (${healthDaysSince} days ago)` : ''}
                        </div>
                    </div>

                    <div style="border-top:1px solid #e8dcc8;padding-top:16px;margin-top:16px;">
                        <div style="font-weight:600;margin-bottom:8px;font-family:'Georgia',serif;color:#3d2b1f;">Emergency Contact</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div>
                                <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-family:'Georgia',serif;">Name</label>
                                <input type="text" id="profile-emergency-name" value="${emergency.name || ''}" placeholder="Full name" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                            </div>
                            <div>
                                <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-family:'Georgia',serif;">Phone</label>
                                <input type="text" id="profile-emergency-phone" value="${emergency.phone || ''}" placeholder="+960 777-1234" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                            </div>
                        </div>
                        <div style="margin-top:8px;">
                            <label style="font-weight:500;color:#3d2b1f;display:block;margin-bottom:4px;font-family:'Georgia',serif;">Relation</label>
                            <input type="text" id="profile-emergency-relation" value="${emergency.relation || ''}" placeholder="e.g., Father, Mother, Guardian" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8dcc8;font-size:14px;font-family:'Georgia',serif;background:#f5ede0;">
                        </div>
                    </div>

                    <button type="submit" style="background:#6c3b8c;color:white;border:none;padding:12px 24px;border-radius:40px;font-weight:600;cursor:pointer;width:100%;margin-top:16px;font-family:'Georgia',serif;">Save Profile</button>
                </form>

                <div id="profile-message" style="margin-top:16px;color:#8b7a6a;text-align:center;font-family:'Georgia',serif;"></div>

                <div style="margin-top:16px;padding:12px;background:#f5ede0;border-radius:12px;font-size:13px;color:#8b7a6a;text-align:center;font-family:'Georgia',serif;">
                    Rank and Role can only be changed by your leader. Health information should be updated every 3 months.
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
        const patrol = document.getElementById('profile-patrol').value.trim();
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
            patrol: patrol || null,
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
            await setDoc(doc(db, 'users', userDocId), updateData, { merge: true });
            
            if (fullName) {
                updateDisplayName(fullName);
            }
            
            document.getElementById('profile-message').textContent = '✅ Profile saved successfully!';
            document.getElementById('profile-message').style.color = '#27ae60';
            setTimeout(() => renderProfile(), 1200);
        } catch (error) {
            document.getElementById('profile-message').textContent = '❌ Error saving profile: ' + error.message;
            document.getElementById('profile-message').style.color = '#e74c3c';
        }
    });
}

// ─── Navigation ──────────────────────────────────────────
document.querySelectorAll('.sidebar-nav a[data-view], .bottom-nav a[data-view]').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        currentView = this.dataset.view;
        renderView();
    });
});

document.getElementById('sidebar-profile-btn')?.addEventListener('click', () => {
    currentView = 'profile';
    document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
    renderView();
});

document.getElementById('logout-btn').addEventListener('click', () => {
    if (statusUnsubscribe) statusUnsubscribe();
    if (sessionsUnsubscribe) sessionsUnsubscribe();
    if (ticketsUnsubscribe) ticketsUnsubscribe();
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

// ─── Init ────────────────────────────────────────────────
async function init() {
    await loadScoutData();
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

    document.querySelectorAll('#mobile-sidebar .sidebar-nav a[data-view]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const view = this.dataset.view;
            closeMobileSidebar();
            document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
            document.querySelector(`.sidebar-nav a[data-view="${view}"]`)?.classList.add('active');
            currentView = view;
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
        if (statusUnsubscribe) statusUnsubscribe();
        if (sessionsUnsubscribe) sessionsUnsubscribe();
        if (ticketsUnsubscribe) ticketsUnsubscribe();
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

init();
