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
        pageHeading.innerHTML = `⛺ <span style="color:#3d2b1f;">${name}</span>`;
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

// ─── Check health status ──────────────────────────────────
function checkHealthStatus() {
    const health = scoutData.health || {};
    if (!health.lastUpdated) return { needsUpdate: true, daysSince: 999 };
    
    const lastUpdated = new Date(health.lastUpdated);
    const now = new Date();
    const daysSince = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));
    
    return {
        needsUpdate: daysSince > 90,
        daysSince: daysSince,
        lastUpdated: lastUpdated
    };
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
            
            // ─── Build notifications ──────────────────────────
            if (ticket.status === 'requirements_added') {
                notifications.push({
                    id: ticket.id,
                    type: 'requirements',
                    message: `📋 Requirements added for "${ticket.badgeName}"`,
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
                    message: `📤 Your report for "${ticket.badgeName}" is submitted`,
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
                    message: `🎉 "${ticket.badgeName}" has been approved!`,
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
                    message: `❌ "${ticket.badgeName}" was rejected`,
                    time: ticket.decidedAt?.seconds || Date.now(),
                    read: false,
                    ticketId: ticket.id
                });
                notificationCount++;
            }
        });
        
        // Sort notifications by time (newest first)
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
            title: '🔒 Second Class',
            message: 'Complete your Membership badge first to unlock Second Class!',
            progress: 'Membership → Second Class'
        },
        'firstClass': {
            title: '🔒 First Class',
            message: 'Complete your Second Class badge first to unlock First Class!',
            progress: 'Second Class → First Class'
        }
    };
    
    const info = messages[tab] || messages['secondClass'];
    return `
        <div style="text-align:center;padding:60px 20px;background:white;border-radius:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="font-size:48px;margin-bottom:16px;">${info.title}</div>
            <h2 style="color:var(--text-muted);">${info.message}</h2>
            <p style="color:var(--text-muted);font-size:14px;margin-top:8px;">${info.progress}</p>
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
            if (scoutSubtitle) scoutSubtitle.textContent = '🏕️ Your Campsite';
        } else if (currentView === 'membership') {
            pageHeading.textContent = '🎯 Membership';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Earn your Membership badge';
        } else if (currentView === 'second') {
            pageHeading.textContent = '⭐ Second Class';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Earn your Second Class badge';
        } else if (currentView === 'first') {
            pageHeading.textContent = '🌟 First Class';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Earn your First Class badge';
        } else if (currentView === 'badges') {
            pageHeading.textContent = '🏅 Badges';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Your badge logbook';
        } else if (currentView === 'sessions') {
            pageHeading.textContent = '📅 Sessions';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Your attended sessions';
        } else if (currentView === 'profile') {
            pageHeading.textContent = '👤 My Profile';
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

// ─── RENDER EARNED BADGES ──────────────────────────────────
function renderEarnedBadges() {
    const earnedTickets = scoutTickets.filter(t => t.status === 'approved');
    
    if (earnedTickets.length === 0) {
        return `
            <div style="text-align:center;padding:20px;color:#8b7a6a;font-style:italic;font-size:14px;">
                No badges earned yet. Keep exploring! 🧭
            </div>
        `;
    }
    
    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:12px;">
            ${earnedTickets.map(t => `
                <div style="text-align:center;padding:12px;background:#f5f0f8;border-radius:16px;border:2px solid #b8860b;box-shadow:0 2px 8px rgba(0,0,0,0.06);cursor:pointer;transition:transform 0.2s;" 
                     onclick="window.location.href='report-viewer-ticket.html?ticketId=${t.id}'"
                     onmouseover="this.style.transform='scale(1.05)'" 
                     onmouseout="this.style.transform='scale(1)'">
                    <div style="font-size:36px;">${t.badgeIcon || '🏅'}</div>
                    <div style="font-size:11px;color:#3d2b1f;font-weight:600;margin-top:4px;">${t.badgeName}</div>
                    <div style="font-size:9px;color:#27ae60;font-weight:600;">✅ Earned</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ─── DASHBOARD (Campsite) ──────────────────────────────
function renderDashboard() {
    const rank = scoutData.rank || 'Membership';
    const patrol = scoutData.patrol || 'No Patrol';
    
    // ─── Determine current badge progress ──────────────────
    let currentReqs = [];
    let currentLabel = '';
    let currentKey = '';
    let nextLabel = '';
    
    if (rank === 'Membership') {
        currentReqs = membershipRequirements;
        currentLabel = 'Membership';
        currentKey = 'membership';
        nextLabel = 'Second Class';
    } else if (rank === 'Second Class') {
        currentReqs = secondClassRequirements;
        currentLabel = 'Second Class';
        currentKey = 'secondClass';
        nextLabel = 'First Class';
    } else if (rank === 'First Class') {
        currentReqs = firstClassRequirements;
        currentLabel = 'First Class';
        currentKey = 'firstClass';
        nextLabel = '⭐ Completed!';
    }
    
    // ─── Calculate progress ─────────────────────────────────
    let completed = 0;
    let pending = 0;
    let total = currentReqs.length;
    for (const req of currentReqs) {
        const key = `${currentKey}_${req.name}`;
        const status = scoutStatus[key];
        if (status && status.status === 'approved') completed++;
        else if (status && status.status === 'pending') pending++;
    }
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isComplete = completed === total && total > 0;

    // ─── Count earned badges ──────────────────────────────────
    const earnedBadges = scoutTickets.filter(t => t.status === 'approved');
    const badgeCount = earnedBadges.length;

    // ─── Active tickets ──────────────────────────────────────
    const activeTickets = scoutTickets.filter(t => 
        t.status === 'pending' || 
        t.status === 'requirements_added' || 
        t.status === 'report_submitted'
    );

    // ─── Unread notifications ────────────────────────────────
    const unreadNotifications = notifications.filter(n => !n.read);
    const hasNotifications = unreadNotifications.length > 0;

    // ─── Calculate patrol color ──────────────────────────────
    const patrolColors = {
        'Eagle': '#f1c40f',
        'Falcon': '#3498db',
        'Wolf': '#95a5a6',
        'Bear': '#8d6e63',
        'Lion': '#e67e22'
    };
    const patrolColor = patrolColors[patrol] || '#6c3b8c';

    // ─── Check health status ────────────────────────────────
    const healthStatus = checkHealthStatus();

    // ─── Build HTML ──────────────────────────────────────────
    let html = `
        <style>
            .campsite {
                max-width: 100%;
                padding: 0;
            }

            /* ─── RANK & PATROL BADGES ─── */
            .campsite-badges {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-bottom: 24px;
            }
            .campsite-badges .badge-pill {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 20px;
                border-radius: 40px;
                font-size: 14px;
                font-weight: 600;
                font-family: 'Georgia', serif;
                border: 2px solid rgba(0,0,0,0.1);
            }
            .campsite-badges .badge-pill.rank {
                background: #6c3b8c;
                color: white;
                border-color: #4a2a5e;
            }
            .campsite-badges .badge-pill.patrol {
                background: ${patrolColor};
                color: white;
                border-color: ${patrolColor}dd;
            }
            .campsite-badges .badge-pill.badge-count {
                background: #00897b;
                color: white;
                border-color: #00695c;
            }
            .campsite-badges .badge-pill.badge-count:hover {
                cursor: pointer;
                transform: scale(1.05);
            }

            /* ─── NOTIFICATION BELL ─── */
            .notification-area {
                background: ${hasNotifications ? '#fef9e7' : '#f8f5fa'};
                border-radius: 16px;
                padding: 14px 20px;
                margin-bottom: 20px;
                border-left: 4px solid ${hasNotifications ? '#f39c12' : '#d4c4a8'};
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
                transition: all 0.3s;
            }
            .notification-area .notif-content {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
            }
            .notification-area .notif-content .bell {
                font-size: 24px;
            }
            .notification-area .notif-content .notif-text {
                font-family: 'Georgia', serif;
                color: #3d2b1f;
            }
            .notification-area .notif-content .notif-text .count {
                font-weight: 700;
                color: #d35400;
            }
            .notification-area .clear-notifs {
                background: ${hasNotifications ? '#e74c3c' : '#d4c4a8'};
                color: ${hasNotifications ? 'white' : '#6b5f4a'};
                border: none;
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Georgia', serif;
            }
            .notification-area .clear-notifs:hover {
                transform: scale(1.05);
                opacity: 0.9;
            }
            .notification-area .notif-list {
                width: 100%;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #d4c4a8;
                display: ${hasNotifications ? 'block' : 'none'};
            }
            .notification-area .notif-list .notif-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 8px;
                border-radius: 8px;
                background: white;
                margin-bottom: 4px;
                font-size: 13px;
                font-family: 'Georgia', serif;
                color: #3d2b1f;
                cursor: pointer;
                transition: background 0.2s;
            }
            .notification-area .notif-list .notif-item:hover {
                background: #f0e8d8;
            }
            .notification-area .notif-list .notif-item .notif-time {
                font-size: 10px;
                color: #8b7a6a;
            }

            /* ─── WELCOME CARD ─── */
            .welcome-card {
                background: linear-gradient(135deg, #f2e8d5, #e8dcc8);
                border-radius: 24px;
                padding: 24px 28px;
                margin-bottom: 24px;
                border: 2px solid #8b6b4d;
                box-shadow: inset 0 0 0 2px #b8a080, 0 4px 12px rgba(0,0,0,0.06);
            }
            .welcome-card .greeting {
                font-family: 'Georgia', serif;
                font-size: 24px;
                color: #3d2b1f;
            }
            .welcome-card .greeting span {
                color: #6c3b8c;
            }
            .welcome-card .sub-greeting {
                font-family: 'Georgia', serif;
                font-size: 15px;
                color: #6b5f4a;
                margin-top: 4px;
            }

            /* ─── STATS GRID ─── */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                margin-bottom: 28px;
            }
            .stat-card {
                background: white;
                border-radius: 20px;
                padding: 16px;
                text-align: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                border: 1px solid #e8dcc8;
                transition: transform 0.2s;
            }
            .stat-card:hover {
                transform: translateY(-2px);
            }
            .stat-card .number {
                font-size: 28px;
                font-weight: 700;
                font-family: 'Georgia', serif;
            }
            .stat-card .label {
                font-size: 13px;
                color: #6b5f4a;
                margin-top: 4px;
                font-family: 'Georgia', serif;
            }
            .stat-card.purple .number { color: #6c3b8c; }
            .stat-card.gold .number { color: #b8860b; }
            .stat-card.green .number { color: #27ae60; }

            /* ─── PROGRESS SECTION ─── */
            .progress-section {
                background: white;
                border-radius: 24px;
                padding: 24px;
                margin-bottom: 24px;
                border: 1px solid #e8dcc8;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }
            .progress-section .progress-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                font-family: 'Georgia', serif;
            }
            .progress-section .progress-header .title {
                font-size: 17px;
                font-weight: 600;
                color: #3d2b1f;
            }
            .progress-section .progress-header .count {
                font-size: 14px;
                color: #6b5f4a;
            }
            .progress-section .progress-bar {
                background: #e8dcc8;
                border-radius: 20px;
                height: 12px;
                overflow: hidden;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
            }
            .progress-section .progress-bar .fill {
                height: 100%;
                border-radius: 20px;
                transition: width 0.8s ease;
                background: linear-gradient(90deg, #6c3b8c, #b8860b);
            }
            .progress-section .progress-actions {
                margin-top: 16px;
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            .progress-section .progress-actions .btn-continue {
                background: #6c3b8c;
                color: white;
                border: none;
                padding: 10px 24px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Georgia', serif;
                text-decoration: none;
                display: inline-block;
            }
            .progress-section .progress-actions .btn-continue:hover {
                background: #4a2a5e;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(108,59,140,0.3);
            }
            .progress-section .progress-actions .btn-continue.complete {
                background: #27ae60;
            }
            .progress-section .progress-actions .btn-continue.complete:hover {
                background: #1e8449;
            }
            .progress-section .progress-actions .btn-secondary {
                background: #d4c4a8;
                color: #3d2b1f;
                border: none;
                padding: 10px 24px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Georgia', serif;
                text-decoration: none;
                display: inline-block;
            }
            .progress-section .progress-actions .btn-secondary:hover {
                background: #c4a882;
                transform: translateY(-2px);
            }

            /* ─── EARNED BADGES ─── */
            .earned-section {
                background: white;
                border-radius: 24px;
                padding: 24px;
                margin-bottom: 24px;
                border: 1px solid #e8dcc8;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }
            .earned-section .earned-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            .earned-section .earned-header .title {
                font-family: 'Georgia', serif;
                font-size: 17px;
                font-weight: 600;
                color: #3d2b1f;
            }
            .earned-section .earned-header .view-all {
                font-family: 'Georgia', serif;
                font-size: 13px;
                color: #6c3b8c;
                text-decoration: none;
                font-weight: 500;
            }
            .earned-section .earned-header .view-all:hover {
                text-decoration: underline;
            }

            /* ─── ACTIVE TICKETS ─── */
            .active-tickets-section {
                background: white;
                border-radius: 24px;
                padding: 24px;
                margin-bottom: 24px;
                border: 1px solid #e8dcc8;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }
            .active-tickets-section .ticket-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            .active-tickets-section .ticket-header .title {
                font-family: 'Georgia', serif;
                font-size: 17px;
                font-weight: 600;
                color: #3d2b1f;
            }
            .active-tickets-section .ticket-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 0;
                border-bottom: 1px solid #f0e8d8;
                cursor: pointer;
                transition: background 0.2s;
                border-radius: 8px;
                padding: 8px 12px;
            }
            .active-tickets-section .ticket-item:hover {
                background: #f5f0f8;
            }
            .active-tickets-section .ticket-item .ticket-icon {
                font-size: 24px;
            }
            .active-tickets-section .ticket-item .ticket-info {
                flex: 1;
            }
            .active-tickets-section .ticket-item .ticket-info .name {
                font-family: 'Georgia', serif;
                font-weight: 600;
                font-size: 14px;
                color: #3d2b1f;
            }
            .active-tickets-section .ticket-item .ticket-info .status {
                font-family: 'Georgia', serif;
                font-size: 12px;
                color: #6b5f4a;
            }
            .active-tickets-section .ticket-item .ticket-status-badge {
                font-size: 20px;
            }

            /* ─── ACHIEVEMENTS ─── */
            .achievements-section {
                background: white;
                border-radius: 24px;
                padding: 24px;
                margin-bottom: 24px;
                border: 1px solid #e8dcc8;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }
            .achievements-section .achievements-title {
                font-family: 'Georgia', serif;
                font-size: 17px;
                font-weight: 600;
                color: #3d2b1f;
                margin-bottom: 16px;
            }
            .achievements-section .achievements-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                gap: 12px;
            }
            .achievements-section .achievement-item {
                text-align: center;
                padding: 12px;
                border-radius: 16px;
                transition: all 0.2s;
                border: 2px solid #e8dcc8;
            }
            .achievements-section .achievement-item.earned {
                background: #f5f0f8;
                border-color: #6c3b8c;
            }
            .achievements-section .achievement-item.locked {
                background: #f8f5f5;
                border-color: #e8e0e0;
                opacity: 0.5;
            }
            .achievements-section .achievement-item .icon {
                font-size: 28px;
            }
            .achievements-section .achievement-item .label {
                font-size: 10px;
                color: #6b5f4a;
                margin-top: 4px;
                font-family: 'Georgia', serif;
            }
            .achievements-section .achievement-item .status {
                font-size: 9px;
                font-weight: 600;
                margin-top: 2px;
                font-family: 'Georgia', serif;
            }
            .achievements-section .achievement-item .status.earned {
                color: #27ae60;
            }
            .achievements-section .achievement-item .status.locked {
                color: #6b5f4a;
            }

            /* ─── SESSIONS ─── */
            .sessions-section {
                background: white;
                border-radius: 24px;
                padding: 24px;
                margin-bottom: 24px;
                border: 1px solid #e8dcc8;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }
            .sessions-section .sessions-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            .sessions-section .sessions-header .title {
                font-family: 'Georgia', serif;
                font-size: 17px;
                font-weight: 600;
                color: #3d2b1f;
            }
            .sessions-section .sessions-header .view-all {
                font-family: 'Georgia', serif;
                font-size: 13px;
                color: #6c3b8c;
                text-decoration: none;
                font-weight: 500;
            }
            .sessions-section .sessions-header .view-all:hover {
                text-decoration: underline;
            }
            .sessions-section .session-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid #f0e8d8;
            }
            .sessions-section .session-item .session-name {
                font-family: 'Georgia', serif;
                font-weight: 500;
                color: #3d2b1f;
            }
            .sessions-section .session-item .session-meta {
                font-family: 'Georgia', serif;
                font-size: 13px;
                color: #6b5f4a;
            }
            .sessions-section .session-item .session-badge {
                background: #d4edda;
                color: #155724;
                padding: 2px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
            }

            @media (max-width: 768px) {
                .stats-grid {
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .welcome-card .greeting {
                    font-size: 20px;
                }
                .achievements-section .achievements-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
                .notification-area {
                    flex-direction: column;
                    align-items: stretch;
                }
            }
            @media (max-width: 480px) {
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                .achievements-section .achievements-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .campsite-badges .badge-pill {
                    font-size: 12px;
                    padding: 6px 14px;
                }
                .welcome-card {
                    padding: 16px;
                }
                .welcome-card .greeting {
                    font-size: 18px;
                }
            }
        </style>

        <div class="campsite">
            <!-- ─── RANK & PATROL BADGES ─── -->
            <div class="campsite-badges">
                <span class="badge-pill rank">⚜️ ${rank}</span>
                <span class="badge-pill patrol">🦅 ${patrol} Patrol</span>
                ${badgeCount > 0 ? `
                    <span class="badge-pill badge-count" onclick="window.location.href='#'" data-view="badges">
                        🏅 ${badgeCount} Badge${badgeCount > 1 ? 's' : ''}
                    </span>
                ` : ''}
                ${activeTickets.length > 0 ? `
                    <span class="badge-pill" style="background:#e67e22;color:white;border-color:#d35400;">
                        🎫 ${activeTickets.length} Active
                    </span>
                ` : ''}
            </div>

            <!-- ─── NOTIFICATION AREA ─── -->
            <div class="notification-area" id="notificationArea">
                <div class="notif-content">
                    <span class="bell">🔔</span>
                    <div class="notif-text">
                        ${hasNotifications ? `
                            You have <span class="count">${unreadNotifications.length}</span> new notification${unreadNotifications.length > 1 ? 's' : ''}
                        ` : `
                            No new notifications ✨
                        `}
                    </div>
                </div>
                ${hasNotifications ? `
                    <button class="clear-notifs" id="clearNotifsBtn">Mark all read</button>
                ` : ''}
                <div class="notif-list" id="notifList">
                    ${notifications.slice(0, 5).map(n => `
                        <div class="notif-item" onclick="window.location.href='report-viewer-ticket.html?ticketId=${n.ticketId}'">
                            <span>${n.message}</span>
                            <span class="notif-time">${n.read ? '✓ Read' : '● New'}</span>
                        </div>
                    `).join('')}
                    ${notifications.length > 5 ? `<div style="text-align:center;padding:4px;font-size:12px;color:#8b7a6a;">+${notifications.length - 5} more</div>` : ''}
                </div>
            </div>

            <!-- ─── WELCOME CARD ─── -->
            <div class="welcome-card">
                <div class="greeting">⛺ Welcome back, <span>${displayName}</span>!</div>
                <div class="sub-greeting">
                    ${isComplete ? `🎉 You've completed ${currentLabel}! ${rank === 'First Class' ? 'You\'re a legend!' : `Ready for ${nextLabel}?`}` : `Keep going on your ${currentLabel} journey! ${completed}/${total} completed`}
                </div>
            </div>

            <!-- ─── STATS GRID ─── -->
            <div class="stats-grid">
                <div class="stat-card purple">
                    <div class="number">${completed}/${total}</div>
                    <div class="label">${currentLabel} Progress</div>
                </div>
                <div class="stat-card gold">
                    <div class="number">${badgeCount}</div>
                    <div class="label">🏅 Badges Earned</div>
                </div>
                <div class="stat-card green">
                    <div class="number">${allSessions.length}</div>
                    <div class="label">📅 Sessions</div>
                </div>
            </div>

            <!-- ─── PROGRESS SECTION ─── -->
            <div class="progress-section">
                <div class="progress-header">
                    <span class="title">${currentLabel} Progress</span>
                    <span class="count">${completed}/${total}</span>
                </div>
                <div class="progress-bar">
                    <div class="fill" style="width:${progress}%;"></div>
                </div>
                <div class="progress-actions">
                    <a href="#" data-view="${rank === 'Membership' ? 'membership' : rank === 'Second Class' ? 'second' : 'first'}" class="btn-continue ${isComplete ? 'complete' : ''}">
                        ${isComplete ? '✅ Completed!' : '📖 Continue Journey →'}
                    </a>
                    ${!isComplete && rank !== 'First Class' ? `
                        <a href="#" data-view="${rank === 'Membership' ? 'second' : 'first'}" class="btn-secondary" style="${rank === 'First Class' ? 'display:none;' : ''}">
                            🔒 ${nextLabel}
                        </a>
                    ` : ''}
                </div>
            </div>

            <!-- ─── EARNED BADGES ─── -->
            <div class="earned-section">
                <div class="earned-header">
                    <span class="title">🏅 Earned Badges</span>
                    <a href="#" data-view="badges" class="view-all">View All →</a>
                </div>
                ${renderEarnedBadges()}
            </div>

            <!-- ─── ACTIVE TICKETS ─── -->
            ${activeTickets.length > 0 ? `
                <div class="active-tickets-section">
                    <div class="ticket-header">
                        <span class="title">🎫 Active Tickets</span>
                        <a href="#" data-view="badges" class="view-all">View All →</a>
                    </div>
                    ${activeTickets.map(t => {
                        const statusMap = {
                            'pending': { emoji: '⏳', label: 'Waiting' },
                            'requirements_added': { emoji: '📋', label: 'Requirements' },
                            'report_submitted': { emoji: '📤', label: 'Report Sent' }
                        };
                        const s = statusMap[t.status] || { emoji: '📌', label: t.status };
                        return `
                            <div class="ticket-item" onclick="window.location.href='report-viewer-ticket.html?ticketId=${t.id}'">
                                <span class="ticket-icon">${t.badgeIcon || '🏅'}</span>
                                <div class="ticket-info">
                                    <div class="name">${t.badgeName}</div>
                                    <div class="status">Status: ${s.label}</div>
                                </div>
                                <span class="ticket-status-badge">${s.emoji}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}

            <!-- ─── ACHIEVEMENTS ─── -->
            <div class="achievements-section">
                <div class="achievements-title">🏆 Achievements</div>
                <div class="achievements-grid">
                    ${[
                        { key: 'membership', label: 'Membership', icon: '🏅', earned: rank !== 'Membership' },
                        { key: 'second', label: 'Second Class', icon: '⭐', earned: rank === 'Second Class' || rank === 'First Class' },
                        { key: 'first', label: 'First Class', icon: '🌟', earned: rank === 'First Class' },
                        { key: 'badges', label: 'Badge Collector', icon: '🎯', earned: badgeCount >= 1 }
                    ].map(a => `
                        <div class="achievement-item ${a.earned ? 'earned' : 'locked'}">
                            <div class="icon">${a.icon}</div>
                            <div class="label">${a.label}</div>
                            <div class="status ${a.earned ? 'earned' : 'locked'}">${a.earned ? '✅ Earned' : '🔒 Locked'}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- ─── SESSIONS ─── -->
            <div class="sessions-section">
                <div class="sessions-header">
                    <span class="title">📅 Upcoming Sessions</span>
                    <a href="#" data-view="sessions" class="view-all">View All →</a>
                </div>
                ${(() => {
                    const today = new Date().toISOString().split('T')[0];
                    const upcoming = allSessions
                        .filter(s => s.date >= today)
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .slice(0, 3);
                    
                    if (upcoming.length === 0) {
                        return `<p style="font-family:'Georgia',serif;color:#6b5f4a;font-size:14px;text-align:center;padding:12px 0;">No upcoming sessions. Check back later!</p>`;
                    }
                    
                    return upcoming.map(s => `
                        <div class="session-item">
                            <span class="session-name">${s.name}</span>
                            <span class="session-meta">${s.date} · ${s.time || 'TBD'}</span>
                            <span class="session-badge">${s.date === today ? 'Today' : 'Upcoming'}</span>
                        </div>
                    `).join('');
                })()}
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
        <div class="progress-section" style="margin-bottom:20px;">
            <div class="progress-header"><span>Progress</span><span>${completed}/${total}</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress}%;"></div></div>
        </div>
        <div class="requirements-grid">
            ${reqs.map(req => {
                const key = `${tab}_${req.name}`;
                const data = scoutStatus[key];
                const status = data ? data.status : 'todo';
                
                let statusPill = '';
                if (status === 'approved') {
                    statusPill = `<span class="approved-badge" style="background:#d4edda;color:#155724;padding:4px 16px;border-radius:40px;font-size:12px;font-weight:500;">Complete</span>`;
                } else if (status === 'pending') {
                    statusPill = `<span class="pending-badge" data-req="${req.name}" data-tab="${tab}" style="background:#fde8d0;color:#d35400;padding:4px 16px;border-radius:40px;font-size:12px;font-weight:500;cursor:pointer;">Pending</span>`;
                } else {
                    statusPill = `<button class="ready-btn" data-req="${req.name}" data-tab="${tab}" style="background:#e67e22;color:white;border:none;padding:4px 16px;border-radius:40px;font-size:12px;font-weight:500;cursor:pointer;">Mark Ready</button>`;
                }
                
                let approvedInfo = '';
                if (status === 'approved' && data) {
                    const approvedBy = data.approvedBy || 'Unknown';
                    const approvedAt = data.approvedAt ? new Date(data.approvedAt).toLocaleString() : 'Unknown date';
                    approvedInfo = `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Approved by ${approvedBy} · ${approvedAt}</div>`;
                }
                
                const reportKey = `${tab}_${req.name}_report`;
                const hasReport = scoutStatus[reportKey] && (scoutStatus[reportKey].note || (scoutStatus[reportKey].images && scoutStatus[reportKey].images.length > 0));
                
                let reportBtn = '';
                if (hasReport) {
                    reportBtn = `<a href="report-viewer.html?email=${userDocId}&tab=${tab}&req=${encodeURIComponent(req.name)}" class="report-btn has-report" style="background:#27ae60;color:white;border:none;padding:4px 12px;border-radius:40px;font-size:12px;cursor:pointer;font-weight:500;text-decoration:none;display:inline-block;">View Report</a>`;
                } else {
                    reportBtn = `<button class="report-btn no-report" data-req="${req.name}" data-tab="${tab}" style="background:#e8e0f0;color:var(--text-dark);border:none;padding:4px 12px;border-radius:40px;font-size:12px;cursor:pointer;font-weight:500;">Add Report</button>`;
                }
                
                return `
                    <div class="req-card">
                        <div class="req-header">
                            <span class="req-title">${req.id}. ${req.name}</span>
                        </div>
                        <div class="req-actions" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
                            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                <a href="requirement-detail.html?name=${encodeURIComponent(req.name)}&tab=${tab}" class="notes-link">Notes</a>
                                ${reportBtn}
                            </div>
                            ${statusPill}
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
        <div class="report-modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:white;border-radius:24px;padding:32px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;position:relative;">
                
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2 style="color:var(--purple-dark);margin:0;">Report: ${currentReportReq}</h2>
                    <button id="close-report-modal" style="background:none;border:none;font-size:28px;cursor:pointer;color:var(--text-muted);">×</button>
                </div>
                
                <div style="margin-bottom:16px;">
                    <label style="font-weight:600;display:block;margin-bottom:6px;">Your Report Note</label>
                    <textarea id="report-note" style="width:100%;padding:12px;border-radius:12px;border:1px solid #e0d6ec;font-family:inherit;font-size:14px;min-height:100px;resize:vertical;">${report.note || ''}</textarea>
                </div>
                
                <div style="margin-bottom:16px;">
                    <label style="font-weight:600;display:block;margin-bottom:6px;">Upload Images</label>
                    <div id="drop-zone" style="border:2px dashed #e0d6ec;border-radius:12px;padding:30px;text-align:center;cursor:pointer;transition:all 0.2s;">
                        <div style="font-size:40px;margin-bottom:8px;">📸</div>
                        <p style="color:var(--text-muted);">Drag & drop images here, or click to select</p>
                        <p style="font-size:12px;color:var(--text-muted);">Images will be compressed to ~100-200KB (max 5 images)</p>
                        <input type="file" id="image-upload" multiple accept="image/*" style="display:none;">
                    </div>
                </div>
                
                <div id="image-preview-container" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
                    ${allImages.map((base64, index) => `
                        <div class="image-preview-item" style="position:relative;width:100px;height:100px;border-radius:12px;overflow:hidden;border:2px solid #e8e0f0;">
                            <img src="${base64}" style="width:100%;height:100%;object-fit:cover;">
                            <button class="remove-image" data-index="${index}" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">×</button>
                        </div>
                    `).join('')}
                </div>
                
                <div style="display:flex;gap:12px;margin-top:16px;">
                    <button id="save-report" class="btn-primary" style="flex:1;background:var(--purple);color:white;border:none;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:600;cursor:pointer;">Save Report</button>
                    <button id="cancel-report" class="btn-secondary" style="flex:1;background:#e8e0f0;color:var(--text-dark);border:none;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>
                </div>
                
                <div id="report-message" style="margin-top:12px;font-size:14px;color:var(--text-muted);text-align:center;"></div>
                ${report.updatedAt ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted);text-align:center;">Last saved: ${new Date(report.updatedAt).toLocaleString()}</div>` : ''}
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
        dropZone.style.borderColor = 'var(--purple)';
        dropZone.style.background = '#f5f0f8';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#e0d6ec';
        dropZone.style.background = 'transparent';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#e0d6ec';
        dropZone.style.background = 'transparent';
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));

    async function handleFiles(files) {
        const container = document.getElementById('image-preview-container');
        const message = document.getElementById('report-message');
        
        if (allImages.length + files.length > 5) {
            message.textContent = '⚠️ Maximum 5 images allowed. You have ' + allImages.length + ' already.';
            message.style.color = '#e67e22';
            return;
        }
        
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                message.textContent = '⚠️ Please select image files only.';
                message.style.color = '#e67e22';
                continue;
            }
            
            try {
                const base64 = await resizeImage(file, 600, 0.7);
                allImages.push(base64);
                
                const imgDiv = document.createElement('div');
                imgDiv.className = 'image-preview-item';
                imgDiv.style.cssText = 'position:relative;width:100px;height:100px;border-radius:12px;overflow:hidden;border:2px solid #e8e0f0;';
                imgDiv.innerHTML = `
                    <img src="${base64}" style="width:100%;height:100%;object-fit:cover;">
                    <button class="remove-image" data-index="${allImages.length - 1}" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">×</button>
                `;
                container.appendChild(imgDiv);
                
                message.textContent = `✅ ${file.name} uploaded (${Math.round(base64.length / 1024)}KB)`;
                message.style.color = '#4caf50';
                
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
            <div class="image-preview-item" style="position:relative;width:100px;height:100px;border-radius:12px;overflow:hidden;border:2px solid #e8e0f0;">
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
            message.style.color = '#e67e22';
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
            message.style.color = '#4caf50';
            
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
                <h3 style="color:var(--text-dark);margin-bottom:8px;">No sessions yet</h3>
                <p style="color:var(--text-muted);">You haven't attended any sessions yet.</p>
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
            <div style="background:white;border-radius:16px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:24px;font-weight:700;color:var(--purple);">${allSessions.length}</div>
                <div style="font-size:12px;color:var(--text-muted);">Sessions Attended</div>
            </div>
            <div style="background:white;border-radius:16px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:24px;font-weight:700;color:#27ae60;">${totalHours}</div>
                <div style="font-size:12px;color:var(--text-muted);">Hours of Scouting</div>
            </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
    `;
    
    for (const session of allSessions) {
        contentHtml += `
            <div class="session-card" data-id="${session.id}" style="background:white;border-radius:20px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;border-left:4px solid var(--purple-light);">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px;">
                    <div>
                        <div style="font-weight:600;font-size:18px;color:var(--text-dark);">${session.name}</div>
                        <div style="color:var(--text-muted);font-size:14px;">${session.date} · ${session.time} · ${session.location || 'TBD'}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="background:#d4edda;color:#155724;padding:2px 10px;border-radius:12px;font-size:12px;">Attended</span>
                        <span style="font-size:14px;font-weight:600;color:var(--purple);">${session.duration || 0}h</span>
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
            window.location.href = `session-detail-scout.html?id=${id}`;
        });
    });
}

// ─── Profile View ──────────────────────────────────────────
async function renderProfile() {
    const userDoc = await getDoc(doc(db, 'users', userDocId));
    const data = userDoc.data();

    if (!data) {
        pageContent.innerHTML = `<p style="color:var(--text-muted);padding:40px;text-align:center;">Profile not found.</p>`;
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
    const healthStatusColor = healthDaysSince > 90 ? '#d45a7a' : '#27ae60';

    let html = `
        <div style="max-width:600px;margin:0 auto;">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
                <span id="profile-back" style="cursor:pointer;color:var(--text-muted);font-size:18px;">←</span>
                <h2 style="color:var(--purple-dark);margin:0;">My Profile</h2>
            </div>

            <div style="background:white;border-radius:24px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
                    <div class="person-avatar" style="width:80px;height:80px;background:${avatarColor};">
                        <div class="head" style="width:24px;height:24px;top:16px;"></div>
                        <div class="body" style="width:38px;height:22px;bottom:14px;"></div>
                    </div>
                    <div>
                        <div style="font-size:24px;font-weight:700;color:var(--text-dark);">${fullName}</div>
                        <div style="color:var(--text-muted);">${patrol || 'No patrol'} · ${rank}</div>
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
                            <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Patrol</label>
                            <input type="text" id="profile-patrol" value="${patrol}" placeholder="e.g., Eagle" style="width:100%;padding:10px;border-radius:12px;border:1px solid #e0d6ec;font-size:14px;">
                        </div>
                        <div>
                            <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Role</label>
                            <input type="text" id="profile-role" value="${role}" disabled style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8e0f0;font-size:14px;background:#f5f0f8;color:var(--text-muted);">
                            <span style="font-size:12px;color:var(--text-muted);">(Set by leader)</span>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                        <div>
                            <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Rank</label>
                            <input type="text" id="profile-rank" value="${rank}" disabled style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8e0f0;font-size:14px;background:#f5f0f8;color:var(--text-muted);">
                            <span style="font-size:12px;color:var(--text-muted);">(Set by leader)</span>
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

                    <button type="submit" style="background:var(--purple);color:white;border:none;padding:12px 24px;border-radius:40px;font-weight:600;cursor:pointer;width:100%;margin-top:16px;">Save Profile</button>
                </form>

                <div id="profile-message" style="margin-top:16px;color:var(--text-muted);text-align:center;"></div>

                <div style="margin-top:16px;padding:12px;background:#f5f0f8;border-radius:12px;font-size:13px;color:var(--text-muted);text-align:center;">
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
            document.getElementById('profile-message').style.color = '#8fbcbb';
            setTimeout(() => renderProfile(), 1200);
        } catch (error) {
            document.getElementById('profile-message').textContent = '❌ Error saving profile: ' + error.message;
            document.getElementById('profile-message').style.color = '#c47a7a';
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
