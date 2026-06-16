import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Check if user is logged in
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = 'index.html';
}

document.getElementById('scout-name').innerText = currentUser.username;

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

// Requirements (same 12 from before)
const requirements = [
    { id: 1, name: "Law and Promise" },
    { id: 2, name: "Scout Uniform, Badges and Positions" },
    { id: 3, name: "Knots and Whipping" },
    { id: 4, name: "Woodcraft Signs" },
    { id: 5, name: "National Flag, Anthem, Emblem, Tree, Flower" },
    { id: 6, name: "Scouting History" },
    { id: 7, name: "Salutes, Signs, Handshake, Scout Staff" },
    { id: 8, name: "Dress a Wound" },
    { id: 9, name: "Whistle Calls, Silent Signs, Formations" },
    { id: 10, name: "Re-test Membership" },
    { id: 11, name: "Interview by Scouter" },
    { id: 12, name: "Investiture" }
];

// Load scout's progress
async function loadProgress() {
    const container = document.getElementById('requirements-list');
    container.innerHTML = 'Loading your progress...';

    try {
        const progressRef = doc(db, 'progress', currentUser.uid);
        const progressDoc = await getDoc(progressRef);
        
        let progress = {};
        if (progressDoc.exists()) {
            progress = progressDoc.data();
        }

        container.innerHTML = requirements.map(req => {
            const isChecked = progress[req.id] || false;
            return `
                <div class="requirement-item">
                    <div class="requirement-header">
                        <input type="checkbox" class="requirement-checkbox" data-id="${req.id}" ${isChecked ? 'checked' : ''}>
                        <div class="requirement-title">${req.name}</div>
                    </div>
                    <div class="requirement-summary">
                        <a href="requirement-detail.html?id=${req.id}" style="color: #d45a7a; text-decoration: none; font-size: 14px;">📖 View notes →</a>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners to checkboxes
        document.querySelectorAll('.requirement-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const reqId = parseInt(e.target.dataset.id);
                const newProgress = { ...progress };
                newProgress[reqId] = e.target.checked;
                
                // Save to Firestore
                await updateDoc(progressRef, newProgress);
                
                if (e.target.checked) {
                    alert('✓ Request sent to leader for approval!');
                }
            });
        });

    } catch (error) {
        container.innerHTML = `<p>Error loading progress: ${error.message}</p>`;
    }
}

loadProgress();
