import { db } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, getDocs, onSnapshot 
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
        pageHeading.innerHTML = `Good morning, <span id="scout-name">${name}</span>!`;
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

// ─── Load scout data ─────────────────────────────────────
async function loadScoutData() {
    const docRef = doc(db, 'users', userDocId);
    const docSnap = await getDoc(docRef);
    scoutData = docSnap.exists() ? docSnap.data() : { rank: 'Membership' };
    
    if (sidebarRank) sidebarRank.textContent = `Scout · ${scoutData.rank || 'Membership'}`;
    
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
        },
        'firstClass': {
            title: 'First Class',
            message: 'Complete your Second Class badge first to unlock First Class!',
        }
    };
    
    const info = messages[tab] || messages['secondClass'];
    return `
        <div style="text-align:center;padding:60px 20px;background:white;border-radius:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="font-size:48px;margin-bottom:16px;">🔒</div>
            <h2 style="color:var(--text-muted);">${info.title}</h2>
            <p style="color:var(--text-muted);font-size:16px;">${info.message}</p>
        </div>
    `;
}

// ─── Render Views ────────────────────────────────────────
function renderView() {
    if (!pageContent) return;
    pageContent.innerHTML = '';
    
    if (pageHeading) {
        if (currentView === 'dashboard') {
            pageHeading.innerHTML = `Good morning, <span id="scout-name">${displayName}</span>!`;
            if (scoutSubtitle) scoutSubtitle.textContent = 'Welcome to your Campsite';
        } else if (currentView === 'membership') {
            pageHeading.textContent = 'Membership Badge';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Complete all requirements to earn your badge';
        } else if (currentView === 'second') {
            pageHeading.textContent = 'Second Class Badge';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Complete all requirements to earn your badge';
        } else if (currentView === 'first') {
            pageHeading.textContent = 'First Class Badge';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Complete all requirements to earn your badge';
        } else if (currentView === 'badges') {
            pageHeading.textContent = 'My Badges';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Track your badge progress';
        } else if (currentView === 'tickets') {
            pageHeading.textContent = 'My Tickets';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Track your badge requests';
        } else if (currentView === 'sessions') {
            pageHeading.textContent = 'My Sessions';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Sessions you have attended';
        } else if (currentView === 'profile') {
            pageHeading.textContent = 'My Profile';
            if (scoutSubtitle) scoutSubtitle.textContent = 'Manage your personal information';
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
        const displayName = scoutData.fullName || currentUser.username;
        const rank = scoutData.rank || 'Membership';
        renderBadgePouch('page-content', displayName, rank);
    }
    else if (currentView === 'tickets') renderScoutTickets();
    else if (currentView === 'sessions') renderSessions();
    else if (currentView === 'profile') renderProfile();
    else if (currentView === 'reportModal') renderReportModal();
}

// ─── Dashboard ──────────────────────────────────────────
function renderDashboard() {
    let completed = 0, pending = 0;
    for (const req of membershipRequirements) {
        const key = `membership_${req.name}`;
        const status = scoutStatus[key];
        if (status && status.status === 'approved') completed++;
        else if (status && status.status === 'pending') pending++;
    }
    const total = membershipRequirements.length;
    const progress = Math.round((completed / total) * 100);

    let scoutServiceHours = 0;
    for (const session of allSessions) {
        scoutServiceHours += session.duration || 0;
    }

    const attendanceCount = allSessions.length;
    const rank = scoutData.rank || 'Membership';
    const healthStatus = checkHealthStatus();

    const today = new Date().toISOString().split('T')[0];
    const upcomingSessions = allSessions
        .filter(s => s.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 2);

    const achievements = [
        { key: 'membership', label: 'Membership', icon: '🏅', earned: completed === total },
        { key: 'second', label: 'Second Class', icon: '⭐', earned: false },
        { key: 'first', label: 'First Class', icon: '🌟', earned: false },
        { key: 'badge1', label: 'Badge 1', icon: '🎯', earned: false },
        { key: 'badge2', label: 'Badge 2', icon: '🎯', earned: false },
        { key: 'badge3', label: 'Badge 3', icon: '🎯', earned: false },
    ];

    const patrolColors = {
        'Eagle': '#f1c40f',
        'Falcon': '#3498db',
        'Wolf': '#95a5a6',
        'Bear': '#8d6e63',
        'Lion': '#e67e22'
    };
    const patrol = scoutData.patrol || 'No Patrol';
    const patrolColor = patrolColors[patrol] || '#6c3b8c';

    let html = '';

    // ─── Health Notice ──────────────────────────────────────
    if (healthStatus.needsUpdate) {
        html += `
            <div style="background:#fff3cd;border-radius:16px;padding:16px 20px;margin-bottom:16px;border-left:4px solid #ffc107;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:24px;">⚠️</span>
                    <div>
                        <div style="font-weight:600;color:#856404;">Health Information Needs Update</div>
                        <div style="font-size:13px;color:#856404;">Last updated ${healthStatus.daysSince} days ago. Please review your health details.</div>
                    </div>
                </div>
                <div style="display:flex;gap:8px;">
                    <a href="#" data-view="profile" style="background:#ffc107;color:#856404;padding:6px 20px;border-radius:40px;font-weight:600;font-size:13px;text-decoration:none;">Update Health →</a>
                </div>
            </div>
        `;
    }

    // ─── Main Dashboard Content ─────────────────────────────
    html += `
        <!-- RANK + PATROL BADGES -->
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:28px;">
            <span style="background:var(--purple);color:white;padding:6px 20px;border-radius:40px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;">
                🏅 ${rank}
            </span>
            <span style="background:${patrolColor};color:white;padding:6px 20px;border-radius:40px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;">
                🦅 ${patrol} Patrol
            </span>
        </div>

        <!-- STATS GRID -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;">
            <!-- Progress Ring -->
            <div style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);text-align:center;">
                <div style="position:relative;width:100px;height:100px;margin:0 auto;">
                    <svg viewBox="0 0 120 120" style="width:100%;height:100%;transform:rotate(-90deg);">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#e8e0f0" stroke-width="10"/>
                        <circle cx="60" cy="60" r="50" fill="none" stroke="url(#progressGradient)" stroke-width="10"
                            stroke-dasharray="314.16" stroke-dashoffset="${314.16 * (1 - progress / 100)}"
                            stroke-linecap="round"/>
                        <defs>
                            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" style="stop-color:var(--purple);stop-opacity:1" />
                                <stop offset="100%" style="stop-color:var(--orange);stop-opacity:1" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:var(--text-dark);">${progress}%</div>
                        <div style="font-size:11px;color:var(--text-muted);">${completed}/${total}</div>
                    </div>
                </div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:8px;">Membership Progress</div>
            </div>

            <!-- Sessions Attended -->
            <div style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:36px;margin-bottom:4px;">📋</div>
                <div style="font-size:28px;font-weight:700;color:var(--purple);">${attendanceCount}</div>
                <div style="font-size:13px;color:var(--text-muted);">Sessions Attended</div>
            </div>

            <!-- Scouting Hours -->
            <div style="background:white;border-radius:24px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:36px;margin-bottom:4px;">⏱️</div>
                <div style="font-size:28px;font-weight:700;color:#4caf50;">${scoutServiceHours}</div>
                <div style="font-size:13px;color:var(--text-muted);">Hours of Scouting</div>
            </div>
        </div>

        <!-- ACHIEVEMENTS -->
        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:28px;">
            <h3 style="color:var(--text-dark);margin-bottom:16px;font-size:18px;">🏆 Achievements</h3>
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;">
                ${achievements.map(a => `
                    <div style="text-align:center;padding:12px;border-radius:16px;background:${a.earned ? 'var(--lavender-bg)' : '#f5f5f5'};border:2px solid ${a.earned ? 'var(--purple)' : 'transparent'};">
                        <div style="font-size:32px;${a.earned ? '' : 'opacity:0.3;'}">${a.earned ? a.icon : '🔒'}</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${a.label}</div>
                        <div style="font-size:10px;color:${a.earned ? 'var(--purple)' : 'var(--text-muted)'};font-weight:600;margin-top:2px;">${a.earned ? '✅ Earned' : 'Locked'}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- UPCOMING SESSIONS -->
        <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:28px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="color:var(--text-dark);font-size:18px;margin:0;">📅 Upcoming Sessions</h3>
                <a href="#" data-view="sessions" style="color:var(--purple);font-size:13px;font-weight:500;text-decoration:none;">View All →</a>
            </div>
            ${upcomingSessions.length === 0 ? `
                <p style="color:var(--text-muted);font-size:14px;">No upcoming sessions. Check back later!</p>
            ` : `
                ${upcomingSessions.map(s => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f5f0f8;">
                        <div>
                            <div style="font-weight:500;color:var(--text-dark);">${s.name}</div>
                            <div style="font-size:13px;color:var(--text-muted);">${s.date} · ${s.time} · ${s.location || 'TBD'}</div>
                        </div>
                        <span style="background:#d4edda;color:#155724;padding:2px 12px;border-radius:20px;font-size:11px;font-weight:500;">Invited</span>
                    </div>
                `).join('')}
            `}
        </div>

        <!-- CONTINUE JOURNEY -->
        <div style="background:linear-gradient(135deg,var(--purple),var(--orange));border-radius:24px;padding:20px 24px;color:white;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div>
                    <div style="font-weight:600;font-size:16px;">💡 Continue Your Journey</div>
                    <div style="font-size:13px;opacity:0.9;">${completed === total ? 'You completed Membership! 🎉 Start Second Class' : `${completed}/${total} Membership requirements done`}</div>
                </div>
                <a href="#" data-view="${completed === total ? 'second' : 'membership'}" style="background:white;color:var(--purple);padding:8px 24px;border-radius:40px;font-weight:600;font-size:14px;text-decoration:none;">Continue →</a>
            </div>
        </div>
    `;

    pageContent.innerHTML = html;

    document.querySelectorAll('a[data-view]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            currentView = this.dataset.view;
            document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
            renderView();
        });
    });
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
                    statusPill = `<button class="ready-btn" data-req="${req.name}" data-tab="${tab}" style="background:var(--orange);color:white;border:none;padding:4px 16px;border-radius:40px;font-size:12px;font-weight:500;cursor:pointer;">Mark Ready</button>`;
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
                    reportBtn = `<a href="report-viewer.html?email=${userDocId}&tab=${tab}&req=${encodeURIComponent(req.name)}" class="report-btn has-report" style="background:#4caf50;color:white;border:none;padding:4px 12px;border-radius:40px;font-size:12px;cursor:pointer;font-weight:500;text-decoration:none;display:inline-block;">View Report</a>`;
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
                    <button class="remove-image" data-index="${allImages.length - 1}" style="position:absolute;
