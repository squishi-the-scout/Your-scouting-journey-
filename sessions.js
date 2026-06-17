import { auth, db } from './firebase-config.js';
import { collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'leader') window.location.href = 'index.html';

document.getElementById('leader-avatar').textContent = currentUser.username.charAt(0).toUpperCase();

let allSessions = [];
let allScouts = [];

async function loadScouts() {
    const snapshot = await getDocs(collection(db, 'users'));
    const scouts = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.role === 'scout') scouts.push({ id: doc.id, username: data.username });
    });
    allScouts = scouts;
}

function listenToSessions() {
    const container = document.getElementById('sessions-list');
    container.innerHTML = 'Loading sessions...';

    const unsubscribe = onSnapshot(collection(db, 'sessions'), (snapshot) => {
        allSessions = [];
        snapshot.forEach(doc => {
            allSessions.push({ id: doc.id, ...doc.data() });
        });
        renderSessions();
    }, (error) => {
        container.innerHTML = `<p style="color:#c47a7a;">❌ Error loading sessions: ${error.message}</p>`;
        console.error(error);
    });
    return unsubscribe;
}

function renderSessions() {
    const container = document.getElementById('sessions-list');

    if (allSessions.length === 0) {
        container.innerHTML = `
            <div style="background:white;border-radius:20px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <p style="color:#5a7c6e;font-size:18px;">📋 No sessions yet.</p>
                <p style="color:#5a7c6e;">Click "New Session" to create your first activity.</p>
            </div>
        `;
        return;
    }

    const sorted = [...allSessions].sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        if (a.time > b.time) return -1;
        if (a.time < b.time) return 1;
        return 0;
    });

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
            ${sorted.map(session => {
                const scoutCount = allScouts.length;
                let attended = 0;
                if (session.attendance) {
                    for (const key in session.attendance) {
                        if (session.attendance[key] === true) attended++;
                    }
                }
                const percent = scoutCount > 0 ? Math.round((attended / scoutCount) * 100) : 0;

                return `
                    <div class="scout-card" style="cursor:pointer;" data-id="${session.id}">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                            <div>
                                <div style="font-weight:600;font-size:18px;color:#2d5a4a;">${session.name}</div>
                                <div style="color:#5a7c6e;font-size:14px;">
                                    📅 ${session.date} · ${session.time} · 📍 ${session.location || 'TBD'}
                                </div>
                                <div style="color:#5a7c6e;font-size:14px;margin-top:4px;">
                                    👥 ${attended}/${scoutCount} scouts attended (${percent}%)
                                </div>
                            </div>
                            <div style="font-size:14px;color:#5a7c6e;text-align:right;">
                                ${session.purpose ? `<div style="max-width:200px;font-style:italic;">${session.purpose.substring(0,60)}${session.purpose.length > 60 ? '...' : ''}</div>` : ''}
                                <div style="font-size:12px;color:#b0c4b8;">Created by ${session.createdBy || 'unknown'}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    document.querySelectorAll('.scout-card[data-id]').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = `session-detail.html?id=${card.dataset.id}`;
        });
    });
}

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

document.getElementById('new-session-btn').addEventListener('click', () => {
    window.location.href = 'new-session.html';
});

async function init() {
    await loadScouts();
    listenToSessions();
}
init();
