import { auth, db } from './firebase-config.js';
import { 
    collection, getDocs, doc, getDoc, setDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── State ──────────────────────────────────────────────
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'leader') {
    window.location.href = 'index.html';
}

const leaderName = document.getElementById('leader-name');
const leaderAvatar = document.getElementById('leader-avatar');
const pendingBadge = document.getElementById('pending-badge');
const pageContent = document.getElementById('page-content');

if (leaderName) leaderName.textContent = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
if (leaderAvatar) leaderAvatar.textContent = currentUser.username.charAt(0).toUpperCase();

let allScouts = [];
let allStatus = {};
let currentView = 'dashboard';
let selectedScoutId = null;
let unsubscribeStatus = null;
let allSessions = [];
let sessionsUnsubscribe = null;

const membershipReqs = [
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

// ─── Logout ──────────────────────────────────────────────
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

// ─── Navigation ──────────────────────────────────────────
document.querySelectorAll('.sidebar-nav a').forEach(function(link) {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.sidebar-nav a').forEach(function(l) {
            l.classList.remove('active');
        });
        this.classList.add('active');
        currentView = this.dataset.view;
        renderView();
    });
});

// ─── Load Scouts ─────────────────────────────────────────
async function loadScouts() {
    const snapshot = await getDocs(collection(db, 'users'));
    allScouts = [];
    snapshot.forEach(function(doc) {
        const data = doc.data();
        if (data.role === 'scout') {
            allScouts.push({ id: doc.id, username: data.username });
        }
    });
    return allScouts;
}

// ─── Live Status Listener ────────────────────────────────
function listenToStatus() {
    if (unsubscribeStatus) unsubscribeStatus();
    unsubscribeStatus = onSnapshot(collection(db, 'scoutStatus'), function(snapshot) {
        allStatus = {};
        snapshot.forEach(function(doc) {
            allStatus[doc.id] = doc.data();
        });
        renderView();
        updatePendingBadge();
    });
}

function updatePendingBadge() {
    var count = 0;
    for (var i = 0; i < allScouts.length; i++) {
        var scout = allScouts[i];
        var status = allStatus[scout.id] || {};
        for (var j = 0; j < membershipReqs.length; j++) {
            var req = membershipReqs[j];
            var key = 'membership_' + req;
            var value = status[key];
            if (value === 'pending' || (value && value.status === 'pending')) {
                count++;
                break;
            }
        }
    }
    if (pendingBadge) pendingBadge.textContent = count;
}

// ─── Render Views ─────────────────────────────────────────
function renderView() {
    if (!pageContent) return;
    pageContent.innerHTML = '';

    if (currentView === 'dashboard') {
        renderDashboard();
    } else if (currentView === 'scouts') {
        renderAllScouts();
    } else if (currentView === 'pending') {
        renderPending();
    } else if (currentView === 'sessions') {
        renderSessions();
    } else if (currentView === 'export') {
        renderExport();
    } else if (currentView === 'scout-detail' && selectedScoutId) {
        renderScoutDetail(selectedScoutId);
    } else {
        pageContent.innerHTML = '<p style="color:#5a7c6e;">View "' + currentView + '" not found.</p>';
    }
}

// ─── Dashboard ────────────────────────────────────────────
function renderDashboard() {
    var badgeEarned = 0, onTrail = 0, atTrailhead = 0, pendingCount = 0;

    for (var i = 0; i < allScouts.length; i++) {
        var scout = allScouts[i];
        var status = allStatus[scout.id] || {};
        var done = 0, pending = 0;
        for (var j = 0; j < membershipReqs.length; j++) {
            var req = membershipReqs[j];
            var key = 'membership_' + req;
            var value = status[key];
            if (value === 'pending' || (value && value.status === 'pending')) {
                pending++;
            } else if (value && value.status === 'approved') {
                done++;
            }
        }
        var progress = membershipReqs.length > 0 ? done / membershipReqs.length : 0;
        if (progress === 1) badgeEarned++;
        else if (progress >= 0.5) onTrail++;
        else atTrailhead++;
        if (pending > 0) pendingCount++;
    }

    var totalScouts = allScouts.length;
    var attendedThisWeek = Math.floor(totalScouts * 0.6);
    var percent = totalScouts > 0 ? Math.round((attendedThisWeek / totalScouts) * 100) : 0;

    var html = '';

    // Header
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">';
    html += '<div><h1 style="font-size:32px; font-weight:700; color:#2d5a4a; margin:0;">Good morning, ' + currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1) + '! 🎉</h1>';
    html += '<p style="color:#5a7c6e; font-size:16px; margin-top:4px;">welcome back ~</p></div>';
    html += '<div style="width:40px; height:40px; border-radius:50%; background:#7a9e8a; color:white; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:18px;">' + currentUser.username.charAt(0).toUpperCase() + '</div>';
    html += '</div>';

    // Stats Cards
    html += '<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:24px;">';
    html += '<div style="background:white; border-radius:24px; padding:20px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04);"><div style="font-size:32px; font-weight:700; color:#8fbcbb;">' + badgeEarned + '</div><div style="font-size:14px; color:#5a7c6e; margin-top:8px;">🏅 Badge Earned</div></div>';
    html += '<div style="background:white; border-radius:24px; padding:20px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04);"><div style="font-size:32px; font-weight:700; color:#d4a86a;">' + onTrail + '</div><div style="font-size:14px; color:#5a7c6e; margin-top:8px;">🚶 On the Trail</div></div>';
    html += '<div style="background:white; border-radius:24px; padding:20px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04);"><div style="font-size:32px; font-weight:700; color:#c47a7a;">' + atTrailhead + '</div><div style="font-size:14px; color:#5a7c6e; margin-top:8px;">🏕️ At the Trailhead</div></div>';
    html += '</div>';

    // Middle
    html += '<div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px; margin-bottom:28px;">';
    html += '<div id="pending-banner-click" style="background:' + (pendingCount > 0 ? '#fef9f0' : '#e8f0ec') + '; border-left:4px solid ' + (pendingCount > 0 ? '#d4a86a' : '#b0c4b8') + '; border-radius:16px; padding:16px 20px;' + (pendingCount > 0 ? ' cursor:pointer;' : '') + ' display:flex; align-items:center;">';
    html += '<span style="font-size:16px;">' + (pendingCount > 0 ? '✋ <strong>' + pendingCount + '</strong> scout(s) need your approval →' : '✅ No pending approvals — all caught up!') + '</span>';
    html += '</div>';
    html += '<div style="display:flex; flex-direction:column; gap:16px;">';
    html += '<div style="background:white; border-radius:24px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); text-align:center;">';
    html += '<div style="position:relative; width:100px; height:100px; margin:0 auto;">';
    html += '<svg viewBox="0 0 120 120" style="transform:rotate(-90deg); width:100%; height:100%;">';
    html += '<circle cx="60" cy="60" r="50" fill="none" stroke="#e8f0ec" stroke-width="12"/>';
    html += '<circle cx="60" cy="60" r="50" fill="none" stroke="#8fbcbb" stroke-width="12" stroke-linecap="round" stroke-dasharray="314.16" stroke-dashoffset="' + (314.16 - (percent / 100) * 314.16) + '" style="transition: stroke-dashoffset 1.2s ease-out;"/>';
    html += '</svg>';
    html += '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);"><div style="font-size:20px; font-weight:700; color:#2d5a4a;">' + percent + '%</div><div style="font-size:10px; color:#5a7c6e;">Attendance</div></div>';
    html += '</div>';
    html += '<div style="font-size:12px; color:#5a7c6e; margin-top:8px;">' + attendedThisWeek + ' of ' + totalScouts + ' attended this week</div>';
    html += '</div>';
    html += '<div style="background:white; border-radius:24px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">';
    html += '<div style="font-weight:600; color:#2d5a4a; font-size:14px; margin-bottom:12px;">📊 Scout Levels</div>';
    html += '<div style="display:flex; flex-direction:column; gap:8px;">';
    html += '<div style="display:flex; justify-content:space-between; font-size:14px; color:#2d5a4a; padding:6px 0; border-bottom:1px solid #e8f0ec;"><span>🏅 Membership</span><span style="font-weight:600;">' + totalScouts + '</span></div>';
    html += '<div style="display:flex; justify-content:space-between; font-size:14px; color:#2d5a4a; padding:6px 0; border-bottom:1px solid #e8f0ec;"><span>⭐ Second Class</span><span style="font-weight:600; color:#b0c4b8;">0</span></div>';
    html += '<div style="display:flex; justify-content:space-between; font-size:14px; color:#2d5a4a; padding:6px 0;"><span>🌟 First Class</span><span style="font-weight:600; color:#b0c4b8;">0</span></div>';
    html += '</div></div></div></div>';

    // Scout Cards
    html += '<div><h2 style="color:#2d5a4a; font-size:18px; font-weight:600; margin-bottom:16px;">📋 All Scouts</h2>';
    html += '<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px;">';
    if (allScouts.length > 0) {
        for (var k = 0; k < allScouts.length; k++) {
            var scout = allScouts[k];
            var status = allStatus[scout.id] || {};
            var done = 0;
            for (var m = 0; m < membershipReqs.length; m++) {
                var req = membershipReqs[m];
                var key = 'membership_' + req;
                var value = status[key];
                if (value && value.status === 'approved') done++;
            }
            var progress = membershipReqs.length > 0 ? Math.round((done / membershipReqs.length) * 100) : 0;
            var color = getColor(scout.username);
            html += '<div class="scout-card" data-id="' + scout.id + '" style="background:white; border-radius:20px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); cursor:pointer; transition:all 0.2s;">';
            html += '<div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">';
            html += '<div style="width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:18px; color:white; background:' + color + ';">' + scout.username.charAt(0).toUpperCase() + '</div>';
            html += '<span style="font-weight:600; font-size:15px; color:#2d5a4a;">' + scout.username + '</span>';
            html += '</div>';
            html += '<div style="font-size:13px; color:#5a7c6e; margin-bottom:6px;">' + progress + '%</div>';
            html += '<div style="background:#e8f0ec; border-radius:20px; height:6px; overflow:hidden;"><div style="background:#8fbcbb; height:100%; width:' + progress + '%; border-radius:20px;"></div></div>';
            html += '</div>';
        }
    } else {
        html += '<p style="color:#5a7c6e; text-align:center; padding:40px;">No scouts found.</p>';
    }
    html += '</div></div>';
    html += '<p style="text-align:center; color:#b0c4b8; font-size:13px; margin-top:12px;">👆 Click any scout to view their progress</p>';

    pageContent.innerHTML = html;

    // Event listeners
    var banner = document.getElementById('pending-banner-click');
    if (banner && pendingCount > 0) {
        banner.addEventListener('click', function() {
            document.querySelector('.sidebar-nav a[data-view="pending"]')?.click();
        });
    }

    document.querySelectorAll('.scout-card').forEach(function(card) {
        card.addEventListener('click', function() {
            selectedScoutId = this.dataset.id;
            currentView = 'scout-detail';
            document.querySelectorAll('.sidebar-nav a').forEach(function(l) {
                l.classList.remove('active');
            });
            renderView();
        });
    });
}

// ─── All Scouts ──────────────────────────────────────────
function renderAllScouts() {
    var html = '';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">';
    html += '<div style="display:flex; gap:12px; flex:1; max-width:320px; background:white; padding:10px 18px; border-radius:40px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">';
    html += '<span>🔍</span>';
    html += '<input type="text" id="search-input" placeholder="Search scouts..." style="border:none; background:none; outline:none; font-size:14px; color:#2d5a4a; width:100%;">';
    html += '</div>';
    html += '<select id="filter-select" style="background:white; padding:10px 18px; border-radius:40px; border:none; font-size:14px; color:#2d5a4a; box-shadow:0 2px 8px rgba(0,0,0,0.04); cursor:pointer;">';
    html += '<option value="all">All</option><option value="badge-earned">Badge Earned</option><option value="on-trail">On the Trail</option><option value="at-trailhead">At the Trailhead</option>';
    html += '</select></div>';
    html += '<div id="scout-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px;">';
    for (var i = 0; i < allScouts.length; i++) {
        html += scoutCardHTML(allScouts[i]);
    }
    html += '</div>';
    pageContent.innerHTML = html;

    document.getElementById('search-input')?.addEventListener('input', filterScouts);
    document.getElementById('filter-select')?.addEventListener('change', filterScouts);

    document.querySelectorAll('.scout-card').forEach(function(card) {
        card.addEventListener('click', function() {
            selectedScoutId = this.dataset.id;
            currentView = 'scout-detail';
            document.querySelectorAll('.sidebar-nav a').forEach(function(l) {
                l.classList.remove('active');
            });
            renderView();
        });
    });
}

function filterScouts() {
    var query = document.getElementById('search-input')?.value.toLowerCase() || '';
    var filter = document.getElementById('filter-select')?.value || 'all';
    var grid = document.getElementById('scout-grid');
    if (!grid) return;
    var cards = grid.querySelectorAll('.scout-card');
    cards.forEach(function(card) {
        var name = card.dataset.name.toLowerCase();
        var progress = parseFloat(card.dataset.progress);
        var show = true;
        if (query && !name.includes(query)) show = false;
        if (filter === 'badge-earned' && progress < 1) show = false;
        if (filter === 'on-trail' && (progress < 0.5 || progress === 1)) show = false;
        if (filter === 'at-trailhead' && progress >= 0.5) show = false;
        card.style.display = show ? '' : 'none';
    });
}

// ─── Pending ──────────────────────────────────────────────
function renderPending() {
    var pendingItems = [];
    for (var i = 0; i < allScouts.length; i++) {
        var scout = allScouts[i];
        var status = allStatus[scout.id] || {};
        for (var j = 0; j < membershipReqs.length; j++) {
            var req = membershipReqs[j];
            var key = 'membership_' + req;
            var value = status[key];
            if (value === 'pending' || (value && value.status === 'pending')) {
                pendingItems.push({ scout: scout, req: req, key: key });
            }
        }
    }

    if (pendingItems.length === 0) {
        pageContent.innerHTML = '<p style="color:#5a7c6e;">✅ No pending approvals — you\'re all caught up!</p>';
        return;
    }

    var html = '<div style="display:flex; flex-direction:column; gap:12px;">';
    for (var k = 0; k < pendingItems.length; k++) {
        var item = pendingItems[k];
        var color = getColor(item.scout.username);
        html += '<div style="background:white; border-radius:16px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">';
        html += '<div style="display:flex; align-items:center; gap:12px;">';
        html += '<div style="width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:14px; color:white; background:' + color + ';">' + item.scout.username.charAt(0).toUpperCase() + '</div>';
        html += '<span style="font-weight:500; color:#2d5a4a;">' + item.scout.username + '</span>';
        html += '<span style="color:#5a7c6e; font-size:14px;">— ' + item.req + '</span>';
        html += '</div>';
        html += '<button class="approve-btn" data-scout="' + item.scout.id + '" data-req="' + item.req + '" style="background:#8fbcbb; color:white; border:none; padding:6px 18px; border-radius:40px; font-weight:500; cursor:pointer;">Approve</button>';
        html += '</div>';
    }
    html += '</div>';
    pageContent.innerHTML = html;

    document.querySelectorAll('.approve-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var scoutId = this.dataset.scout;
            var reqName = this.dataset.req;
            approveRequirement(scoutId, reqName);
        });
    });
}

// ─── Sessions ──────────────────────────────────────────────
function renderSessions() {
    var html = '';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">';
    html += '<div><h2 style="color:#2d5a4a;">📋 Sessions</h2><p style="color:#5a7c6e;">Manage your scout activities and attendance</p></div>';
    html += '<button id="sessions-new-btn" style="background:#8fbcbb; color:white; border:none; padding:8px 20px; border-radius:40px; font-weight:500; cursor:pointer;">➕ New Session</button>';
    html += '</div>';
    html += '<div id="sessions-list-container"><p style="color:#5a7c6e;">Loading sessions...</p></div>';
    pageContent.innerHTML = html;

    document.getElementById('sessions-new-btn')?.addEventListener('click', function() {
        window.location.href = 'new-session.html';
    });

    if (sessionsUnsubscribe) sessionsUnsubscribe();
    sessionsUnsubscribe = onSnapshot(collection(db, 'sessions'), function(snapshot) {
        allSessions = [];
        snapshot.forEach(function(doc) {
            allSessions.push({ id: doc.id, ...doc.data() });
        });
        renderSessionsList();
    }, function(error) {
        document.getElementById('sessions-list-container').innerHTML = '<p style="color:#c47a7a;">❌ Error: ' + error.message + '</p>';
        console.error(error);
    });
}

function renderSessionsList() {
    var container = document.getElementById('sessions-list-container');
    if (!container) return;

    if (allSessions.length === 0) {
        container.innerHTML = '<div style="background:white; border-radius:20px; padding:40px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04);"><p style="color:#5a7c6e; font-size:18px;">📋 No sessions yet.</p><p style="color:#5a7c6e;">Click "New Session" to create your first activity.</p></div>';
        return;
    }

    var sorted = allSessions.slice().sort(function(a, b) {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        if (a.time > b.time) return -1;
        if (a.time < b.time) return 1;
        return 0;
    });

    var html = '<div style="display:flex; flex-direction:column; gap:16px;">';
    for (var i = 0; i < sorted.length; i++) {
        var session = sorted[i];
        var scoutCount = allScouts.length;
        var attended = 0;
        if (session.attendance) {
            for (var key in session.attendance) {
                if (session.attendance[key] === true) attended++;
            }
        }
        var percent = scoutCount > 0 ? Math.round((attended / scoutCount) * 100) : 0;
        html += '<div style="background:white; border-radius:20px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); cursor:pointer;" data-id="' + session.id + '">';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">';
        html += '<div><div style="font-weight:600; font-size:18px; color:#2d5a4a;">' + session.name + '</div>';
        html += '<div style="color:#5a7c6e; font-size:14px;">📅 ' + session.date + ' · ' + session.time + ' · 📍 ' + (session.location || 'TBD') + '</div>';
        html += '<div style="color:#5a7c6e; font-size:14px; margin-top:4px;">👥 ' + attended + '/' + scoutCount + ' scouts attended (' + percent + '%)</div></div>';
        html += '<div style="font-size:14px; color:#5a7c6e; text-align:right;">';
        if (session.purpose) {
            html += '<div style="max-width:200px; font-style:italic;">' + session.purpose.substring(0, 60) + (session.purpose.length > 60 ? '...' : '') + '</div>';
        }
        html += '<div style="font-size:12px; color:#b0c4b8;">Created by ' + (session.createdBy || 'unknown') + '</div>';
        html += '</div></div></div>';
    }
    html += '</div>';
    container.innerHTML = html;

    document.querySelectorAll('[data-id]').forEach(function(card) {
        card.addEventListener('click', function() {
            window.location.href = 'session-detail.html?id=' + this.dataset.id;
        });
    });
}

// ─── Scout Detail ─────────────────────────────────────────
function renderScoutDetail(scoutId) {
    var scout = null;
    for (var i = 0; i < allScouts.length; i++) {
        if (allScouts[i].id === scoutId) {
            scout = allScouts[i];
            break;
        }
    }
    if (!scout) {
        currentView = 'dashboard';
        renderView();
        return;
    }

    var status = allStatus[scoutId] || {};
    var done = 0;
    for (var j = 0; j < membershipReqs.length; j++) {
        var req = membershipReqs[j];
        var key = 'membership_' + req;
        var data = status[key];
        if (data && data.status === 'approved') done++;
    }
    var progress = membershipReqs.length > 0 ? done / membershipReqs.length : 0;

    var html = '';
    html += '<span id="detail-back" style="cursor:pointer; color:#5a7c6e; font-weight:500; display:inline-block; margin-bottom:16px;">← Back</span>';
    html += '<div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">';
    var color = getColor(scout.username);
    html += '<div style="width:56px; height:56px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:24px; color:white; background:' + color + ';">' + scout.username.charAt(0).toUpperCase() + '</div>';
    html += '<div><h2 style="font-size:24px; color:#2d5a4a;">' + scout.username + '</h2><p style="color:#5a7c6e;">Membership Badge · ' + done + '/' + membershipReqs.length + ' completed</p></div>';
    html += '</div>';
    html += '<div style="background:white; border-radius:20px; padding:20px; margin-bottom:24px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">';
    html += '<div style="display:flex; justify-content:space-between; font-size:14px; color:#2d5a4a; margin-bottom:8px;"><span>Progress</span><span>' + Math.round(progress * 100) + '%</span></div>';
    html += '<div style="background:#e8f0ec; border-radius:20px; height:8px; overflow:hidden;"><div style="background:#8fbcbb; height:100%; width:' + (progress * 100) + '%; border-radius:20px;"></div></div>';
    html += '</div>';
    html += '<div style="background:white; border-radius:20px; padding:20px; margin-bottom:24px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">';
    html += '<label style="font-weight:600; color:#2d5a4a;">📝 Private Note <span style="font-weight:400; color:#5a7c6e;">(only you can see this)</span></label>';
    html += '<textarea id="note-textarea" style="width:100%; padding:12px; border:1px solid #e0ece4; border-radius:16px; font-family:inherit; font-size:14px; resize:vertical; min-height:80px; margin-top:8px;">' + (status.leaderNote || '') + '</textarea>';
    html += '<button id="save-note-btn" style="background:#7a9e8a; color:white; border:none; padding:8px 20px; border-radius:40px; font-weight:500; cursor:pointer; margin-top:10px;">💾 Save Note</button>';
    html += '</div>';
    html += '<div style="background:white; border-radius:20px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">';
    html += '<h3 style="color:#2d5a4a; margin-bottom:12px;">Requirements</h3>';
    for (var k = 0; k < membershipReqs.length; k++) {
        var req = membershipReqs[k];
        var data = status['membership_' + req];
        var stat = data ? data.status : 'todo';
        var icon = stat === 'approved' ? '✅' : stat === 'pending' ? '✋' : '⭕';
        var label = stat === 'approved' ? 'Completed' : stat === 'pending' ? 'Pending' : 'Not started';
        var meta = '';
        if (stat === 'approved') {
            meta = 'Approved by ' + (data.approvedBy || 'leader') + ' · ' + (data.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : 'recently');
        }
        html += '<div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid #e8f0ec; flex-wrap:wrap; gap:8px;">';
        html += '<span>' + icon + ' ' + req + '</span>';
        html += '<span style="font-weight:500; ' + (stat === 'approved' ? 'color:#8fbcbb' : stat === 'pending' ? 'color:#d4a86a' : 'color:#b0c4b8') + ';">' + label + (meta ? ' <span style="font-size:13px; color:#5a7c6e; font-weight:400;">— ' + meta + '</span>' : '') + '</span>';
        html += '</div>';
    }
    html += '</div>';
    pageContent.innerHTML = html;

    document.getElementById('detail-back')?.addEventListener('click', function() {
        currentView = 'dashboard';
        document.querySelector('.sidebar-nav a[data-view="dashboard"]')?.classList.add('active');
        renderView();
    });

    document.getElementById('save-note-btn')?.addEventListener('click', function() {
        var note = document.getElementById('note-textarea').value;
        var ref = doc(db, 'scoutStatus', scoutId);
        getDoc(ref).then(function(docSnap) {
            var current = docSnap.exists() ? docSnap.data() : {};
            current.leaderNote = note;
            return setDoc(ref, current);
        }).then(function() {
            alert('✅ Note saved!');
        }).catch(function(error) {
            console.error('Error saving note:', error);
        });
    });
}

// ─── Export ────────────────────────────────────────────────
function renderExport() {
    var html = '';
    html += '<div style="background:white; border-radius:20px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">';
    html += '<h2 style="color:#2d5a4a; margin-bottom:8px;">📤 Export Reports</h2>';
    html += '<p style="color:#5a7c6e; margin-bottom:20px;">Download scout progress as a CSV file for reports, parents, or school records.</p>';
    html += '<button id="export-all-btn" style="background:#a8c4d4; color:#2d5a4a; border:none; padding:8px 20px; border-radius:40px; font-weight:500; cursor:pointer;">📥 Export All Scouts</button>';
    html += '<button id="export-pending-btn" style="background:#a8c4d4; color:#2d5a4a; border:none; padding:8px 20px; border-radius:40px; font-weight:500; cursor:pointer; margin-left:12px;">📥 Export Pending Only</button>';
    html += '<div id="export-status" style="margin-top:16px; color:#5a7c6e;"></div>';
    html += '</div>';
    pageContent.innerHTML = html;

    document.getElementById('export-all-btn')?.addEventListener('click', function() { exportCSV('all'); });
    document.getElementById('export-pending-btn')?.addEventListener('click', function() { exportCSV('pending'); });
}

function exportCSV(type) {
    var rows = [['Scout', 'Requirement', 'Status', 'Approved By', 'Approved At']];
    for (var i = 0; i < allScouts.length; i++) {
        var scout = allScouts[i];
        var status = allStatus[scout.id] || {};
        for (var j = 0; j < membershipReqs.length; j++) {
            var req = membershipReqs[j];
            var key = 'membership_' + req;
            var data = status[key];
            if (type === 'pending' && (!data || data.status !== 'pending')) continue;
            var stat = data ? data.status : 'todo';
            var by = data?.approvedBy || '';
            var at = data?.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : '';
            rows.push([scout.username, req, stat, by, at]);
        }
    }
    var csv = rows.map(function(r) { return r.join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'scout-progress-' + type + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('export-status').textContent = '✅ ' + (type === 'all' ? 'All' : 'Pending') + ' report downloaded!';
}

// ─── Helpers ────────────────────────────────────────────────
function getColor(name) {
    var colors = ['#7a9e8a', '#a8c4d4', '#d4a86a', '#8fbcbb', '#c47a7a', '#b0a8c4'];
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function scoutCardHTML(scout) {
    var status = allStatus[scout.id] || {};
    var done = 0, pending = 0;
    for (var j = 0; j < membershipReqs.length; j++) {
        var req = membershipReqs[j];
        var key = 'membership_' + req;
        var value = status[key];
        if (value === 'pending' || (value && value.status === 'pending')) {
            pending++;
        } else if (value && value.status === 'approved') {
            done++;
        }
    }
    var total = membershipReqs.length;
    var progress = total > 0 ? done / total : 0;
    var hasNote = !!status.leaderNote;
    var color = getColor(scout.username);
    var html = '';
    html += '<div class="scout-card" data-id="' + scout.id + '" data-name="' + scout.username.toLowerCase() + '" data-progress="' + progress + '" style="background:white; border-radius:20px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); cursor:pointer; transition:all 0.2s;">';
    html += '<div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">';
    html += '<div style="width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:18px; color:white; background:' + color + ';">' + scout.username.charAt(0).toUpperCase() + '</div>';
    html += '<span style="font-weight:600; font-size:15px; color:#2d5a4a;">' + scout.username + '</span>';
    html += '</div>';
    html += '<div style="font-size:13px; color:#5a7c6e; margin-bottom:6px;">' + done + '/' + total + ' done</div>';
    html += '<div style="background:#e8f0ec; border-radius:20px; height:6px; overflow:hidden;"><div style="background:#8fbcbb; height:100%; width:' + (progress * 100) + '%; border-radius:20px;"></div></div>';
    html += '<div style="display:flex; gap:12px; font-size:12px; color:#5a7c6e; margin-top:8px; flex-wrap:wrap;">';
    html += '<span style="color:#8fbcbb;">🟢 ' + done + ' done</span>';
    if (pending > 0) html += '<span style="color:#d4a86a;">✋ ' + pending + ' pending</span>';
    html += '<span style="color:#c47a7a;">⚠️ ' + (total - done - pending) + ' missing</span>';
    html += '</div>';
    if (hasNote) html += '<div style="margin-top:6px; font-size:12px; color:#7a9ec4;">📝 Has private note</div>';
    html += '</div>';
    return html;
}

async function approveRequirement(scoutId, reqName) {
    var ref = doc(db, 'scoutStatus', scoutId);
    var docSnap = await getDoc(ref);
    var current = docSnap.exists() ? docSnap.data() : {};
    current['membership_' + reqName] = {
        status: 'approved',
        approvedBy: currentUser.username,
        approvedAt: new Date().toISOString()
    };
    await setDoc(ref, current);
    renderView();
}

// ─── Init ──────────────────────────────────────────────────
async function init() {
    await loadScouts();
    listenToStatus();
    renderView();
}

init();
