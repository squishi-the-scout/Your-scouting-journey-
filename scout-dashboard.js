import { db } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, getDocs, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { membershipRequirements } from './data/membership-requirements.js';
import { secondClassRequirements } from './data/secondclass-requirements.js';
import { firstClassRequirements } from './data/firstclass-requirements.js';
import { resizeImage } from './resize-image.js';

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
            pageHeading.textContent = '';
            if (scoutSubtitle) scoutSubtitle.textContent = '';
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
    else if (currentView === 'badges') renderBadges();
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
                <div style="font-size:24px;font-weight:700;color:#4caf50;">${totalHours}</div>
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
    const healthStatusColor = healthDaysSince > 90 ? '#d45a7a' : '#4caf50';

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
        
        // Health fields
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

// ─── 🎒 BADGE POUCH ──────────────────────────────────────────
function renderBadges() {
    const badges = [
        { id: 0, name: 'Campfire', type: 'camp', icon: '🌲', unlocked: false },
        { id: 1, name: 'Tent Pitcher', type: 'camp', icon: '⛺', unlocked: false },
        { id: 2, name: 'Stitcher', type: 'proficiency', icon: '🧵', unlocked: false },
        { id: 3, name: 'Firestarter', type: 'proficiency', icon: '🔥', unlocked: false },
        { id: 4, name: 'Navigator', type: 'proficiency', icon: '🗺️', unlocked: false },
        { id: 5, name: 'Knot Master', type: 'proficiency', icon: '🪢', unlocked: false },
        { id: 6, name: 'Chef', type: 'proficiency', icon: '🍳', unlocked: false },
        { id: 7, name: 'National', type: 'national', icon: '🇿🇦', unlocked: false },
        { id: 8, name: 'World Scout', type: 'international', icon: '🌍', unlocked: false },
        { id: 9, name: 'Global Friend', type: 'international', icon: '🤝', unlocked: false },
    ];

    let badgeState = JSON.parse(localStorage.getItem('badgePouch')) || badges;

    const typeLabels = {
        camp: '🏕️',
        proficiency: '🎯',
        national: '🇿🇦',
        international: '🌍'
    };

    const earned = badgeState.filter(b => b.unlocked).length;
    const total = badgeState.length;

    let html = `
        <style>
            .pouch-container {
                max-width: 100%;
                padding: 10px;
            }
            .pouch-header-text {
                text-align: center;
                margin-bottom: 20px;
            }
            .pouch-header-text h2 {
                font-size: 22px;
                color: var(--purple-dark);
                margin: 0;
            }
            .pouch-header-text p {
                font-size: 14px;
                color: var(--text-muted);
                margin: 4px 0 0 0;
                font-style: italic;
            }
            .pouch-scout-card {
                background: #8B6B4D;
                background-image: repeating-linear-gradient(45deg, rgba(120, 90, 60, 0.1) 0px, rgba(120, 90, 60, 0.1) 2px, transparent 2px, transparent 6px);
                border-radius: 16px;
                padding: 14px 20px;
                border: 3px solid #6B4F3A;
                box-shadow: inset 0 2px 8px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                flex-wrap: wrap;
                gap: 12px;
            }
            .pouch-scout-card .scout-info {
                display: flex;
                align-items: center;
                gap: 16px;
            }
            .pouch-scout-card .scout-info .pixel-scout-wrapper {
                position: relative;
                width: 56px;
                height: 56px;
                flex-shrink: 0;
            }
            .pouch-scout-card .scout-info .pixel-scout-wrapper .pixel-scout-img {
                position: absolute;
                top: 0;
                left: 0;
                width: 56px;
                height: 56px;
                image-rendering: pixelated;
                opacity: 0;
                animation: scoutAnimation 12s infinite;
            }
            .pouch-scout-card .scout-info .pixel-scout-wrapper .frame-idle { animation-delay: 0s; }
            .pouch-scout-card .scout-info .pixel-scout-wrapper .frame-wave { animation-delay: 2.5s; }
            .pouch-scout-card .scout-info .pixel-scout-wrapper .frame-idle2 { animation-delay: 3.1s; }
            .pouch-scout-card .scout-info .pixel-scout-wrapper .frame-map { animation-delay: 5.6s; }
            .pouch-scout-card .scout-info .pixel-scout-wrapper .frame-left { animation-delay: 7.6s; }
            .pouch-scout-card .scout-info .pixel-scout-wrapper .frame-right { animation-delay: 8.1s; }
            .pouch-scout-card .scout-info .pixel-scout-wrapper .frame-map2 { animation-delay: 8.6s; }
            .pouch-scout-card .scout-info .pixel-scout-wrapper .frame-idle3 { animation-delay: 10.6s; }

            @keyframes scoutAnimation {
                0%, 100% { opacity: 0; }
                2%, 12% { opacity: 1; }
                15%, 100% { opacity: 0; }
            }

            .pouch-scout-card .scout-info .name {
                font-weight: 700;
                font-size: 16px;
                color: #F5E6D3;
            }
            .pouch-scout-card .scout-info .rank {
                font-size: 12px;
                color: #D4B896;
            }
            .pouch-scout-card .badge-count {
                background: #5A3F2B;
                padding: 6px 16px;
                border-radius: 40px;
                color: #F5E6D3;
                font-weight: 600;
                font-size: 14px;
                border: 2px solid #6B4F3A;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
                white-space: nowrap;
            }
            .pouch-scout-card .badge-count span {
                color: #FFD700;
            }
            .pouch-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 10px;
                background: #8B6B4D;
                background-image: repeating-linear-gradient(45deg, rgba(120, 90, 60, 0.1) 0px, rgba(120, 90, 60, 0.1) 2px, transparent 2px, transparent 6px);
                padding: 16px;
                border-radius: 16px;
                border: 3px solid #6B4F3A;
                box-shadow: inset 0 2px 8px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15);
                margin-bottom: 16px;
            }
            .pouch-slot {
                aspect-ratio: 1 / 1;
                background: #6B4F3A;
                background-image: repeating-linear-gradient(45deg, rgba(90, 65, 45, 0.3) 0px, rgba(90, 65, 45, 0.3) 2px, transparent 2px, transparent 4px);
                border: 2px solid #5A3F2B;
                border-radius: 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                padding: 4px;
                box-shadow: inset 0 -3px 0 #4A2F1B;
            }
            .pouch-slot:hover {
                transform: translateY(-3px);
                border-color: #FFD700;
                box-shadow: 0 6px 16px rgba(0,0,0,0.3), inset 0 -3px 0 #4A2F1B;
            }
            .pouch-slot.locked {
                opacity: 0.5;
                filter: grayscale(0.6);
            }
            .pouch-slot.unlocked {
                border-color: #FFD700;
                background: #7A5A3A;
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.15), inset 0 -3px 0 #4A2F1B;
            }
            .pouch-slot .slot-name {
                font-size: 8px;
                color: #D4B896;
                margin-top: 2px;
                text-align: center;
                line-height: 1.2;
                font-weight: 600;
            }
            .pouch-slot.unlocked .slot-name {
                color: #F5E6D3;
            }
            .pouch-slot .slot-type {
                font-size: 6px;
                text-transform: uppercase;
                color: #A08060;
                letter-spacing: 0.5px;
                margin-top: 1px;
            }
            .pouch-slot .lock-badge {
                position: absolute;
                top: 3px;
                right: 4px;
                font-size: 10px;
            }
            .pouch-slot .tooltip-text {
                display: none;
                position: absolute;
                bottom: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%);
                background: #2D1A0A;
                color: #F5E6D3;
                padding: 3px 12px;
                border-radius: 6px;
                font-size: 10px;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                z-index: 10;
                font-weight: 500;
                border: 1px solid #6B4F3A;
            }
            .pouch-slot:hover .tooltip-text {
                display: block;
            }
            .pouch-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .pouch-actions button {
                background: #6B4F3A;
                border: none;
                border-bottom: 3px solid #4A2F1B;
                color: #F5E6D3;
                padding: 8px 20px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.15s;
            }
            .pouch-actions button:hover {
                transform: translateY(-2px);
                border-bottom-width: 5px;
                background: #7A5A3A;
            }
            .pouch-actions button.primary {
                background: #FFD700;
                color: #2D1A0A;
                border-bottom-color: #B8960A;
            }
            .pouch-actions button.primary:hover {
                background: #FFE44D;
            }
            @media (max-width: 768px) {
                .pouch-grid {
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    padding: 12px;
                }
                .pouch-slot { font-size: 24px; }
                .pouch-slot .slot-name { font-size: 7px; }
                .pouch-actions button { padding: 6px 14px; font-size: 11px; }
                .pouch-scout-card { padding: 10px 14px; }
                .pouch-scout-card .scout-info .pixel-scout-wrapper { width: 44px; height: 44px; }
                .pouch-scout-card .scout-info .pixel-scout-wrapper .pixel-scout-img { width: 44px; height: 44px; }
                .pouch-scout-card .scout-info .name { font-size: 14px; }
                .pouch-header-text h2 { font-size: 18px; }
            }
            @media (max-width: 480px) {
                .pouch-grid {
                    grid-template-columns: repeat(3, 1fr);
                    gap: 6px;
                    padding: 10px;
                }
                .pouch-slot { font-size: 20px; }
                .pouch-scout-card { flex-direction: column; align-items: stretch; text-align: center; }
                .pouch-scout-card .scout-info { justify-content: center; }
                .pouch-scout-card .badge-count { text-align: center; }
            }
        </style>

        <div class="pouch-container">

            <div class="pouch-header-text">
                <h2>🎒 WELCOME TO YOUR BADGE POUCH</h2>
                <p>"Every badge tells a story"</p>
            </div>

            <div class="pouch-scout-card">
                <div class="scout-info">
                    <div class="pixel-scout-wrapper">
                        <img src="idle.png" class="pixel-scout-img frame-idle" />
                        <img src="wave.png" class="pixel-scout-img frame-wave" />
                        <img src="idle.png" class="pixel-scout-img frame-idle2" />
                        <img src="map.png" class="pixel-scout-img frame-map" />
                        <img src="left.png" class="pixel-scout-img frame-left" />
                        <img src="right.png" class="pixel-scout-img frame-right" />
                        <img src="map.png" class="pixel-scout-img frame-map2" />
                        <img src="idle.png" class="pixel-scout-img frame-idle3" />
                    </div>
                    <div>
                        <div class="name">${displayName}</div>
                        <div class="rank">${scoutData.rank || 'Membership'}</div>
                    </div>
                </div>
                <div class="badge-count">
                    <span>${earned}</span> / ${total} badges earned
                </div>
            </div>

            <div class="pouch-grid" id="pouchGrid">
    `;

    badgeState.forEach((badge, index) => {
        const isUnlocked = badge.unlocked;
        html += `
            <div class="pouch-slot ${isUnlocked ? 'unlocked' : 'locked'}" data-index="${index}">
                <span>${badge.icon}</span>
                <span class="slot-name">${badge.name}</span>
                <span class="slot-type">${typeLabels[badge.type] || ''}</span>
                ${!isUnlocked ? '<span class="lock-badge">🔒</span>' : ''}
                <span class="tooltip-text">${isUnlocked ? '✅ Earned!' : '🔒 Click to request'}</span>
            </div>
        `;
    });

    html += `
            </div>

            <div class="pouch-actions">
                <button id="pouchResetBtn">🔄 Reset</button>
                <button class="primary" id="pouchTicketBtn">🎫 Request Badge</button>
            </div>

        </div>
    `;

    pageContent.innerHTML = html;

    // ─── CLICK SLOT → TICKET ─────────────────────────────────
    document.querySelectorAll('.pouch-slot').forEach(slot => {
        slot.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const badge = badgeState[index];
            if (badge.unlocked) {
                alert(`🎉 You already earned "${badge.name}"!`);
            } else {
                window.location.href = `ticket.html?badge=${encodeURIComponent(badge.name)}`;
            }
        });
    });

    // ─── RESET ──────────────────────────────────────────────────
    document.getElementById('pouchResetBtn')?.addEventListener('click', function() {
        if (confirm('Reset all badges? This will lock everything.')) {
            badgeState.forEach(b => b.unlocked = false);
            localStorage.setItem('badgePouch', JSON.stringify(badgeState));
            renderBadges();
        }
    });

    // ─── TICKET BUTTON ────────────────────────────────────────
    document.getElementById('pouchTicketBtn')?.addEventListener('click', function() {
        alert('🎫 Select a locked badge from the grid to request it.');
    });
}

// ─── Placeholder ─────────────────────────────────────────
function renderPlaceholder(title, unlockCondition = null) {
    let html = `
        <div style="max-width:600px;margin:0 auto;text-align:center;padding:40px 0;">
            <div style="font-size:64px;margin-bottom:16px;">🔒</div>
            <h2 style="color:var(--purple-dark);font-size:28px;margin-bottom:8px;">${title}</h2>
            <p style="color:var(--text-muted);font-size:16px;margin-bottom:24px;">
                ${unlockCondition || 'This section is coming soon! Stay tuned.'}
            </p>
            <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <p style="color:var(--text-muted);font-size:14px;">More content is on the way. Check back later!</p>
            </div>
        </div>
    `;
    pageContent.innerHTML = html;
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

document.getElementById('sidebar-profile-btn')?.addEventListener('click', () => {
    currentView = 'profile';
    document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
    renderView();
});

document.getElementById('logout-btn').addEventListener('click', () => {
    if (statusUnsubscribe) statusUnsubscribe();
    if (sessionsUnsubscribe) sessionsUnsubscribe();
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

// ─── Init ────────────────────────────────────────────────
async function init() {
    await loadScoutData();
    listenToStatus();
    listenToSessions();
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
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

init();
