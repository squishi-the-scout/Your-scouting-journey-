import { auth, db } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, getDocs, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { membershipRequirements } from './data/membership-requirements.js';
import { secondClassRequirements } from './data/secondclass-requirements.js';
import { firstClassRequirements } from './data/firstclass-requirements.js';

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
const headerAvatar = document.getElementById('header-avatar');
const sidebarAvatar = document.getElementById('sidebar-avatar');

// ─── Set user info ──────────────────────────────────────
const displayName = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
if (scoutNameEl) scoutNameEl.textContent = displayName;
if (sidebarName) sidebarName.textContent = displayName;

// ─── Avatar colors ──────────────────────────────────────
const colors = ['#6c3b8c', '#e67e22', '#8a5aa8', '#f39c12', '#4a2a5e', '#d35400'];
function getColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

const avatarColor = getColor(currentUser.username);
if (headerAvatar) headerAvatar.style.background = avatarColor;
if (sidebarAvatar) sidebarAvatar.style.background = avatarColor;

// ─── IMPORTANT: Use email as document ID ──────────────
const userEmail = `${currentUser.username}@gis-scout.local`;

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
    const docRef = doc(db, 'users', userEmail);
    const docSnap = await getDoc(docRef);
    scoutData = docSnap.exists() ? docSnap.data() : { rank: 'Membership' };
    
    if (sidebarRank) sidebarRank.textContent = `Scout · ${scoutData.rank || 'Membership'}`;
}

// ─── Real-time status listener ──────────────────────────
function listenToStatus() {
    if (statusUnsubscribe) {
        statusUnsubscribe();
        statusUnsubscribe = null;
    }
    
    const docRef = doc(db, 'scoutStatus', userEmail);
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
            if (data.attendance && data.attendance[userEmail] === true) {
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
    await setDoc(doc(db, 'scoutStatus', userEmail), scoutStatus);
}

// ─── Resize image to thumbnail ──────────────────────────
function resizeImage(file, maxWidth = 600, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width = Math.round((width * maxWidth) / height);
                        height = maxWidth;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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
            title: '⭐ Second Class',
            message: 'Complete your Membership badge first to unlock Second Class!',
            icon: '🔒'
        },
        'firstClass': {
            title: '🌟 First Class',
            message: 'Complete your Second Class badge first to unlock First Class!',
            icon: '🔒'
        }
    };
    
    const info = messages[tab] || messages['secondClass'];
    return `
        <div style="text-align:center;padding:60px 20px;background:white;border-radius:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="font-size:64px;margin-bottom:16px;">${info.icon}</div>
            <h2 style="color:var(--text-muted);">${info.title}</h2>
            <p style="color:var(--text-muted);font-size:16px;">${info.message}</p>
        </div>
    `;
}

// ─── Render Views ────────────────────────────────────────
function renderView() {
    if (!pageContent) return;
    pageContent.innerHTML = '';
    if (currentView === 'dashboard') renderDashboard();
    else if (currentView === 'membership') {
        if (isBadgeAccessible('membership')) {
            renderRequirements('membership', membershipRequirements, '🏅 Membership Badge');
        } else {
            pageContent.innerHTML = renderLockedMessage('membership');
        }
    }
    else if (currentView === 'second') {
        if (isBadgeAccessible('secondClass')) {
            renderRequirements('secondClass', secondClassRequirements, '⭐ Second Class Badge');
        } else {
            pageContent.innerHTML = renderLockedMessage('secondClass');
        }
    }
    else if (currentView === 'first') {
        if (isBadgeAccessible('firstClass')) {
            renderRequirements('firstClass', firstClassRequirements, '🌟 First Class Badge');
        } else {
            pageContent.innerHTML = renderLockedMessage('firstClass');
        }
    }
    else if (currentView === 'badges') renderPlaceholder('Proficiency Badges', 'Start earning badges for your skills!');
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

    let html = `
        <div style="max-width:700px;margin:0 auto;text-align:center;padding:20px 0;">
            <div style="font-size:48px;margin-bottom:16px;">👋</div>
            <h2 style="color:var(--purple-dark);font-size:28px;margin-bottom:8px;">Welcome back, ${displayName}!</h2>
            <p style="color:var(--text-muted);font-size:16px;margin-bottom:32px;">Rank: ${scoutData.rank || 'Membership'}</p>

            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;">
                <div style="background:white;border-radius:20px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                    <div style="font-size:28px;font-weight:700;color:var(--purple);">${completed}</div>
                    <div style="font-size:14px;color:var(--text-muted);">Completed</div>
                </div>
                <div style="background:white;border-radius:20px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                    <div style="font-size:28px;font-weight:700;color:var(--orange);">${pending}</div>
                    <div style="font-size:14px;color:var(--text-muted);">Pending</div>
                </div>
                <div style="background:white;border-radius:20px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                    <div style="font-size:28px;font-weight:700;color:#8fbcbb;">${total - completed - pending}</div>
                    <div style="font-size:14px;color:var(--text-muted);">Not Started</div>
                </div>
                <div style="background:white;border-radius:20px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                    <div style="font-size:28px;font-weight:700;color:#4caf50;">${scoutServiceHours}</div>
                    <div style="font-size:14px;color:var(--text-muted);">Service Hours</div>
                </div>
            </div>

            <div style="background:white;border-radius:24px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--text-dark);margin-bottom:8px;">
                    <span>Membership Badge</span>
                    <span>${completed}/${total}</span>
                </div>
                <div style="background:#e8e0f0;border-radius:20px;height:10px;overflow:hidden;">
                    <div style="background:linear-gradient(90deg,var(--purple),var(--orange));height:100%;width:${progress}%;border-radius:20px;transition:width 0.6s ease;"></div>
                </div>
                ${completed === total ? `<p style="margin-top:16px;color:var(--purple);font-weight:600;">🎉 You've earned your Membership Badge! Amazing work.</p>` : `<p style="margin-top:16px;color:var(--text-muted);font-size:14px;">Keep going — you're making progress!</p>`}
            </div>

            <div style="margin-top:24px;padding:16px;background:#f0ebf5;border-radius:16px;font-size:14px;color:var(--text-muted);">
                💡 Use the sidebar to explore your requirements, sessions, and profile.
            </div>
        </div>
    `;

    pageContent.innerHTML = html;
}

// ─── Requirements View ──────────────────────────────────
function renderRequirements(tab, reqs, title) {
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
        <h2 style="color:var(--purple-dark);margin-bottom:16px;">${title}</h2>
        <div class="progress-section" style="margin-bottom:20px;">
            <div class="progress-header"><span>Progress</span><span>${completed}/${total}</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress}%;"></div></div>
        </div>
        <div class="requirements-grid">
            ${reqs.map(req => {
                const key = `${tab}_${req.name}`;
                const data = scoutStatus[key];
                const status = data ? data.status : 'todo';
                const icon = status === 'approved' ? '🏁' : status === 'pending' ? '✋' : '🚩';
                
                let approvedInfo = '';
                if (status === 'approved' && data) {
                    const approvedBy = data.approvedBy || 'Unknown';
                    const approvedAt = data.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : 'Unknown date';
                    approvedInfo = `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">✅ Approved by ${approvedBy} · ${approvedAt}</div>`;
                }
                
                let actionHtml = '';
                if (status === 'approved') {
                    actionHtml = `<span class="approved-badge">✓ Completed</span>`;
                } else if (status === 'pending') {
                    actionHtml = `<span class="pending-badge" data-req="${req.name}" data-tab="${tab}">⏳ Undo</span>`;
                } else {
                    actionHtml = `<button class="ready-btn" data-req="${req.name}" data-tab="${tab}">Mark Ready</button>`;
                }
                
                const reportKey = `${tab}_${req.name}_report`;
                const hasReport = scoutStatus[reportKey] && (scoutStatus[reportKey].note || (scoutStatus[reportKey].images && scoutStatus[reportKey].images.length > 0));
                const reportBtn = `<button class="report-btn ${hasReport ? 'has-report' : 'no-report'}" data-req="${req.name}" data-tab="${tab}">${hasReport ? '📄 Report' : '📄 Add Report'}</button>`;
                
                return `
                    <div class="req-card">
                        <div class="req-header">
                            <span class="req-title">${req.id}. ${req.name}</span>
                            <span class="req-status-icon">${icon}</span>
                        </div>
                        ${approvedInfo}
                        <div class="req-actions">
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <a href="requirement-detail.html?name=${encodeURIComponent(req.name)}&tab=${tab}" class="notes-link">📖 Notes</a>
                                ${reportBtn}
                            </div>
                            ${actionHtml}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    pageContent.innerHTML = html;

    // ─── Ready button ─────────────────────────────────────
    document.querySelectorAll('.ready-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const reqName = this.dataset.req;
            const tabName = this.dataset.tab;
            const key = `${tabName}_${reqName}`;
            if (scoutStatus[key] && scoutStatus[key].status === 'approved') return;
            scoutStatus[key] = { status: 'pending' };
            await saveStatus();
        });
    });

    // ─── Undo button ─────────────────────────────────────
    document.querySelectorAll('.pending-badge').forEach(badge => {
        badge.addEventListener('click', async function() {
            const reqName = this.dataset.req;
            const tabName = this.dataset.tab;
            const key = `${tabName}_${reqName}`;
            delete scoutStatus[key];
            await saveStatus();
        });
    });

    // ─── Report button ─────────────────────────────────────
    document.querySelectorAll('.report-btn').forEach(btn => {
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
    const reqKey = `${currentReportTab}_${currentReportReq}`;
    const reqStatus = scoutStatus[reqKey] ? scoutStatus[reqKey].status : 'todo';

    // Use existing images from report
    const existingImages = report.images || [];
    const allImages = [...existingImages];

    let html = `
        <div class="report-modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:white;border-radius:24px;padding:32px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;position:relative;">
                
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2 style="color:var(--purple-dark);margin:0;">📄 Report: ${currentReportReq}</h2>
                    <button id="close-report-modal" style="background:none;border:none;font-size:28px;cursor:pointer;color:var(--text-muted);">×</button>
                </div>
                
                <div style="margin-bottom:16px;">
                    <label style="font-weight:600;display:block;margin-bottom:6px;">Your Report Note</label>
                    <textarea id="report-note" style="width:100%;padding:12px;border-radius:12px;border:1px solid #e0d6ec;font-family:inherit;font-size:14px;min-height:100px;resize:vertical;">${report.note || ''}</textarea>
                </div>
                
                <div style="margin-bottom:16px;">
                    <label style="font-weight:600;display:block;margin-bottom:6px;">Upload Images (Instagram quality)</label>
                    <div id="drop-zone" style="border:2px dashed #e0d6ec;border-radius:12px;padding:30px;text-align:center;cursor:pointer;transition:all 0.2s;">
                        <div style="font-size:40px;margin-bottom:8px;">📸</div>
                        <p style="color:var(--text-muted);">Drag & drop images here, or click to select</p>
                        <p style="font-size:12px;color:var(--text-muted);">Images will be compressed to ~100-200KB</p>
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
                    <button id="save-report" class="btn-primary" style="flex:1;background:var(--purple);color:white;border:none;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:600;cursor:pointer;">💾 Save Report</button>
                    <button id="cancel-report" class="btn-secondary" style="flex:1;background:#e8e0f0;color:var(--text-dark);border:none;padding:12px 24px;border-radius:40px;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>
                </div>
                
                <div id="report-message" style="margin-top:12px;font-size:14px;color:var(--text-muted);text-align:center;"></div>
                ${report.updatedAt ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted);text-align:center;">Last saved: ${new Date(report.updatedAt).toLocaleString()}</div>` : ''}
            </div>
        </div>
    `;

    pageContent.innerHTML = html;

    // ─── Close modal ─────────────────────────────────────
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

    // ─── Drag & Drop ─────────────────────────────────────
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

    // ─── Handle file upload ─────────────────────────────
    async function handleFiles(files) {
        const container = document.getElementById('image-preview-container');
        const message = document.getElementById('report-message');
        
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                message.textContent = '⚠️ Please select image files only.';
                message.style.color = '#e67e22';
                continue;
            }
            
            try {
                // Resize image to Instagram quality
                const base64 = await resizeImage(file, 600, 0.7);
                allImages.push(base64);
                
                // Update preview
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
                
                // Re-attach remove event
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

    // ─── Remove image ────────────────────────────────────
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

    // ─── Save report ─────────────────────────────────────
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
            const docRef = doc(db, 'scoutStatus', userEmail);
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
    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h2 style="color:var(--purple-dark);">📋 My Sessions</h2>
            <span style="color:var(--text-muted);font-size:14px;">Loading...</span>
        </div>
        <div style="text-align:center;padding:40px 0;">
            <div style="display:inline-block;width:40px;height:40px;border:4px solid #e8e0f0;border-top-color:var(--purple);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
            <p style="color:var(--text-muted);margin-top:12px;">Loading your sessions...</p>
        </div>
        <style>
            @keyframes spin { to { transform: rotate(360deg); } }
        </style>
    `;
    
    pageContent.innerHTML = html;

    if (allSessions.length === 0) {
        pageContent.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h2 style="color:var(--purple-dark);">📋 My Sessions</h2>
                <span style="color:var(--text-muted);font-size:14px;">0 sessions</span>
            </div>
            <div style="background:white;border-radius:24px;padding:60px 20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
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
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h2 style="color:var(--purple-dark);">📋 My Sessions</h2>
            <span style="color:var(--text-muted);font-size:14px;">⏱️ ${totalHours} total hours</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
            <div style="background:white;border-radius:16px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:24px;font-weight:700;color:var(--purple);">${allSessions.length}</div>
                <div style="font-size:12px;color:var(--text-muted);">Sessions Attended</div>
            </div>
            <div style="background:white;border-radius:16px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="font-size:24px;font-weight:700;color:#4caf50;">${totalHours}</div>
                <div style="font-size:12px;color:var(--text-muted);">Service Hours</div>
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
                        <span style="background:#d4edda;color:#155724;padding:2px 10px;border-radius:12px;font-size:12px;">✅ Attended</span>
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
    const userDoc = await getDoc(doc(db, 'users', userEmail));
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

    let html = `
        <div style="max-width:600px;margin:0 auto;">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
                <span id="profile-back" style="cursor:pointer;color:var(--text-muted);font-size:18px;">←</span>
                <h2 style="color:var(--purple-dark);margin:0;">👤 My Profile</h2>
            </div>

            <div style="background:white;border-radius:24px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
                    <div class="person-avatar" style="width:80px;height:80px;background:${avatarColor};border:2px solid var(--orange-light);">
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
                            <label style="font-weight:500;color:var(--text-dark);display:block;margin-bottom:4px;">Rank</label>
                            <input type="text" id="profile-rank" value="${rank}" disabled style="width:100%;padding:10px;border-radius:12px;border:1px solid #e8e0f0;font-size:14px;background:#f5f0f8;color:var(--text-muted);">
                            <span style="font-size:12px;color:var(--text-muted);">(Set by leader)</span>
                        </div>
                    </div>

                    <div style="border-top:1px solid #e8e0f0;padding-top:16px;margin-bottom:16px;">
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

                    <button type="submit" style="background:var(--purple);color:white;border:none;padding:12px 24px;border-radius:40px;font-weight:600;cursor:pointer;width:100%;">💾 Save Profile</button>
                </form>

                <div id="profile-message" style="margin-top:16px;color:var(--text-muted);text-align:center;"></div>

                <div style="margin-top:16px;padding:12px;background:#f5f0f8;border-radius:12px;font-size:13px;color:var(--text-muted);text-align:center;">
                    ⚠️ Rank and Role can only be changed by your leader.
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

        const updateData = {
            fullName: fullName || currentUser.username,
            dob: dob || null,
            patrol: patrol || null,
            emergencyContact: {
                name: emergencyName || null,
                phone: emergencyPhone || null,
                relation: emergencyRelation || null
            }
        };

        try {
            await setDoc(doc(db, 'users', userEmail), updateData, { merge: true });
            document.getElementById('profile-message').textContent = '✅ Profile saved successfully!';
            document.getElementById('profile-message').style.color = '#8fbcbb';
            setTimeout(() => renderProfile(), 1200);
        } catch (error) {
            document.getElementById('profile-message').textContent = '❌ Error saving profile: ' + error.message;
            document.getElementById('profile-message').style.color = '#c47a7a';
        }
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
                <p style="color:var(--text-muted);font-size:14px;">⏳ More content is on the way. Check back later!</p>
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

// ─── Avatar click → Profile ─────────────────────────────
document.getElementById('sidebar-profile-btn')?.addEventListener('click', () => {
    currentView = 'profile';
    document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
    renderView();
});

document.getElementById('header-avatar')?.addEventListener('click', () => {
    currentView = 'profile';
    document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(l => l.classList.remove('active'));
    renderView();
});

// ─── Logout ──────────────────────────────────────────────
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
}

init();
