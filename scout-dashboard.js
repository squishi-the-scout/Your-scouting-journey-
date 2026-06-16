import { auth, db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'scout') window.location.href = 'index.html';
document.getElementById('scout-name').innerText = currentUser.username;

document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
};

const requirementsData = {
    membership: [
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
    ],
    second: ["Second Class requirements coming soon"],
    first: ["First Class requirements coming soon"],
    badges: ["Proficiency badges coming soon"]
};

let currentTab = 'membership';
let scoutStatus = {};

async function loadStatus() {
    const docRef = doc(db, 'scoutStatus', currentUser.uid);
    const docSnap = await getDoc(docRef);
    scoutStatus = docSnap.exists() ? docSnap.data() : {};
}

async function saveStatus() {
    await setDoc(doc(db, 'scoutStatus', currentUser.uid), scoutStatus);
}

function getRequirementIcon(reqName) {
    const iconMap = {
        "Law and Promise": "📜",
        "Scout Uniform, Badges and Positions": "🎽",
        "Knots and Whipping": "🪢",
        "Woodcraft Signs": "🌲",
        "National Flag, Anthem, Emblem, Tree, Flower": "🇲🇻",
        "Scouting History": "📖",
        "Salutes, Signs, Handshake, Scout Staff": "🫡",
        "Dress a Wound": "🩹",
        "Whistle Calls, Silent Signs, Formations": "🎵",
        "Re-test Membership": "🔁",
        "Interview by Scouter": "🗣️",
        "Investiture": "🎓"
    };
    return iconMap[reqName] || "⭐";
}

function updateProgress() {
    const reqs = requirementsData[currentTab];
    if (!reqs || reqs.length === 0 || reqs[0].includes("coming soon")) {
        document.getElementById('progress-count').innerText = '0/0';
        document.getElementById('progress-bar').style.width = '0%';
        return;
    }
    let completed = 0;
    reqs.forEach(req => {
        if (scoutStatus[`${currentTab}_${req}`] === 'approved') completed++;
    });
    const percent = (completed / reqs.length) * 100;
    document.getElementById('progress-count').innerText = `${completed}/${reqs.length}`;
    document.getElementById('progress-bar').style.width = `${percent}%`;
}

async function markAsReady(reqName) {
    const key = `${currentTab}_${reqName}`;
    if (scoutStatus[key] === 'approved') return;
    scoutStatus[key] = 'pending';
    await saveStatus();
    renderRequirements();
}

function renderRequirements() {
    const container = document.getElementById('requirements-grid');
    const reqs = requirementsData[currentTab];
    
    if (!reqs || reqs.length === 0 || reqs[0].includes("coming soon")) {
        container.innerHTML = `<div class="req-card"><div class="req-name">More requirements coming soon!</div></div>`;
        updateProgress();
        return;
    }

    container.innerHTML = reqs.map(req => {
        const status = scoutStatus[`${currentTab}_${req}`] || 'todo';
        const leftIcon = getRequirementIcon(req);
        let statusIcon = '';
        let actionHtml = '';
        
        if (status === 'approved') {
            statusIcon = '🏁';
            actionHtml = `<span class="done-text">✓ Completed</span>`;
        } else if (status === 'pending') {
            statusIcon = '✋';
            actionHtml = `<span class="waiting-text">⏳ Waiting for leader</span>`;
        } else {
            statusIcon = '🚩';
            actionHtml = `<button class="ready-btn" data-req="${req}">Mark Ready</button>`;
        }
        
        return `
            <div class="req-card">
                <div class="req-header">
                    <span class="req-name"><span style="margin-right: 10px;">${leftIcon}</span>${req}</span>
                    <span class="req-status-icon">${statusIcon}</span>
                </div>
                <div class="req-footer">
                    <a href="requirement-detail.html?name=${encodeURIComponent(req)}&tab=${currentTab}" class="notes-link">📖 View Notes</a>
                    ${actionHtml}
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.ready-btn').forEach(btn => {
        btn.addEventListener('click', () => markAsReady(btn.dataset.req));
    });
    
    updateProgress();
}

async function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => {
        if (t.dataset.tab === tab) t.classList.add('active');
        else t.classList.remove('active');
    });
    await loadStatus();
    renderRequirements();
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

async function init() {
    await loadStatus();
    renderRequirements();
}
init();
