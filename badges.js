import { allBadges, typeLabels } from './data/badges-data.js';

// ─── HELPER: Check if icon is an image ──────────────────
function isImageIcon(icon) {
    if (!icon) return false;
    if (typeof icon === 'string') {
        return icon.includes('.png') || 
               icon.includes('.jpg') || 
               icon.includes('.jpeg') || 
               icon.includes('.svg') || 
               icon.includes('.gif') ||
               icon.includes('data/') ||
               icon.includes('http');
    }
    return false;
}

// ─── HELPER: Get icon HTML ──────────────────────────────
function getIconHtml(icon, name, size = '80px') {
    if (typeof icon === 'string' && isImageIcon(icon)) {
        return `<img src="${icon}" alt="${name}" style="width:${size};height:${size};object-fit:contain;display:block;margin:0 auto;">`;
    }
    return `<span style="font-size:${size};">${icon}</span>`;
}

// ─── State ──────────────────────────────────────────────
let badgeState = [];
let currentFilter = 'all';
let scoutTicketsCache = [];
let currentReportTicket = null;

// ─── Load badge state from localStorage ─────────────────
export function loadBadgeState() {
    const saved = JSON.parse(localStorage.getItem('badgePouch'));
    if (saved && saved.length === allBadges.length) {
        badgeState = saved;
    } else {
        badgeState = allBadges.map(b => ({ ...b, unlocked: false }));
        localStorage.setItem('badgePouch', JSON.stringify(badgeState));
    }
    return badgeState;
}

// ─── Save badge state ────────────────────────────────────
export function saveBadgeState() {
    localStorage.setItem('badgePouch', JSON.stringify(badgeState));
}

// ─── Get stats ───────────────────────────────────────────
export function getBadgeStats() {
    const total = badgeState.length;
    const earned = badgeState.filter(b => b.unlocked).length;
    return { total, earned };
}

// ─── Reset all badges ────────────────────────────────────
export function resetBadges() {
    badgeState.forEach(b => b.unlocked = false);
    saveBadgeState();
    return badgeState;
}

// ─── Set filter ──────────────────────────────────────────
export function setFilter(filter) {
    currentFilter = filter;
    return currentFilter;
}

// ─── Get filtered badges ────────────────────────────────
export function getFilteredBadges() {
    if (currentFilter === 'all') return badgeState;
    return badgeState.filter(b => b.type === currentFilter);
}

// ─── Get tickets from global cache ──────────────────────
function getScoutTickets() {
    if (window.__scoutTickets) {
        return window.__scoutTickets;
    }
    try {
        const cached = JSON.parse(localStorage.getItem('scoutTicketsCache'));
        if (cached) return cached;
    } catch (e) {}
    return [];
}

// ─── TICKET MODAL (Request) ──────────────────────────────
function openTicketModal(badge) {
    const existing = document.querySelector('.ticket-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ticket-modal-overlay';

    const iconHtml = getIconHtml(badge.icon, badge.name, '56px');

    overlay.innerHTML = `
        <div class="ticket-modal">
            <button class="modal-close" id="modalCloseBtn">✕</button>

            <div class="badge-preview">
                ${iconHtml}
                <div class="info">
                    <div class="name">${badge.name}</div>
                    <div class="type">${badge.type.charAt(0).toUpperCase() + badge.type.slice(1)} Badge</div>
                </div>
            </div>

            <label for="ticketDate">📅 Date</label>
            <input type="date" id="ticketDate" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:10px;border-radius:12px;border:2px solid #b8a080;margin-bottom:12px;font-size:14px;background:#f8f0e0;box-sizing:border-box;">

            <label for="ticketTime">⏰ Time</label>
            <input type="time" id="ticketTime" value="${new Date().toTimeString().slice(0, 5)}" style="width:100%;padding:10px;border-radius:12px;border:2px solid #b8a080;margin-bottom:12px;font-size:14px;background:#f8f0e0;box-sizing:border-box;">

            <label for="ticketNote">📝 Message to your leader (optional)</label>
            <textarea id="ticketNote" placeholder="Why do you want this badge? Any special request?"></textarea>

            <div class="modal-message" id="modalMessage"></div>

            <div class="modal-actions">
                <button class="btn-cancel" id="modalCancelBtn">Cancel</button>
                <button class="btn-submit" id="modalSubmitBtn">🎫 Request Badge</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    document.getElementById('modalSubmitBtn').addEventListener('click', async function() {
        const date = document.getElementById('ticketDate').value;
        const time = document.getElementById('ticketTime').value;
        const note = document.getElementById('ticketNote').value.trim();
        const messageEl = document.getElementById('modalMessage');
        const submitBtn = this;
        const cancelBtn = document.getElementById('modalCancelBtn');

        if (!date || !time) {
            messageEl.className = 'modal-message error';
            messageEl.textContent = '⚠️ Please select a date and time.';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Submitting...';
        cancelBtn.disabled = true;

        try {
            const module = await import('./tickets.js');
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));

            const fullNote = `📅 ${date} at ${time}\n${note ? `📝 ${note}` : ''}`;

            const result = await module.createTicket(
                currentUser.username,
                badge.id,
                badge.name,
                badge.icon,
                fullNote || ''
            );

            if (result.success) {
                messageEl.className = 'modal-message success';
                messageEl.textContent = `✅ Ticket created for "${badge.name}"! Your leader will review it.`;
                submitBtn.textContent = '✅ Submitted';
                submitBtn.disabled = true;
                cancelBtn.textContent = 'Close';
                cancelBtn.disabled = false;
                cancelBtn.onclick = closeModal;
                if (window.refreshTickets) window.refreshTickets();
                if (window.renderBadgeGrid) window.renderBadgeGrid();
                setTimeout(closeModal, 3500);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            messageEl.className = 'modal-message error';
            messageEl.textContent = `❌ Failed: ${error.message || 'Something went wrong. Try again.'}`;
            submitBtn.disabled = false;
            submitBtn.textContent = '🎫 Request Badge';
            cancelBtn.disabled = false;
        }
    });
}

// ─── REPORT MODAL (Scout submits work) ──────────────────
function openReportModal(ticket, badge) {
    const existing = document.querySelector('.report-modal-overlay');
    if (existing) existing.remove();

    currentReportTicket = ticket;

    const overlay = document.createElement('div');
    overlay.className = 'report-modal-overlay';

    const iconHtml = getIconHtml(badge.icon, badge.name, '48px');

    overlay.innerHTML = `
        <div class="report-modal">
            <button class="modal-close" id="reportCloseBtn">✕</button>

            <div class="badge-preview">
                ${iconHtml}
                <div class="info">
                    <div class="name">${badge.name}</div>
                    <div class="type">${badge.type.charAt(0).toUpperCase() + badge.type.slice(1)} Badge</div>
                </div>
            </div>

            <div style="margin-bottom:16px;padding:12px 16px;background:#d4c4a8;border-radius:10px;border-left:4px solid #8e44ad;">
                <strong style="color:#3d2b1f;">📋 Requirements:</strong>
                <div style="color:#3d2b1f;margin-top:4px;font-size:15px;">${ticket.requirements || 'No requirements assigned yet.'}</div>
                ${ticket.requirementsImage ? `<img src="${ticket.requirementsImage}" style="max-width:100%;max-height:150px;margin-top:8px;border-radius:8px;">` : ''}
                ${ticket.leaderName ? `<div style="font-size:12px;color:#6b5f4a;margin-top:4px;">Added by: ${ticket.leaderName}</div>` : ''}
            </div>

            <label for="reportNote">📝 Your Report Note</label>
            <textarea id="reportNote" placeholder="Describe what you did to complete this badge..."></textarea>

            <label style="margin-top:12px;">📸 Upload Images (max 5)</label>
            <div id="reportDropZone" style="border:2px dashed #b8a080;border-radius:12px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;background:#f8f0e0;">
                <div style="font-size:32px;margin-bottom:4px;">📸</div>
                <p style="color:#6b5f4a;font-size:13px;">Drag & drop images here, or click to select</p>
                <p style="font-size:11px;color:#8b7a6a;">Max 5 images</p>
                <input type="file" id="reportFileInput" multiple accept="image/*" style="display:none;">
            </div>

            <div id="reportImagePreview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;"></div>

            <div class="modal-message" id="reportMessage"></div>

            <div class="modal-actions">
                <button class="btn-cancel" id="reportCancelBtn">Cancel</button>
                <button class="btn-submit" id="reportSubmitBtn">📤 Submit Report</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.remove();
        currentReportTicket = null;
    };

    document.getElementById('reportCloseBtn').addEventListener('click', closeModal);
    document.getElementById('reportCancelBtn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // ─── Image upload handling ────────────────────────────
    let reportImages = [];

    const dropZone = document.getElementById('reportDropZone');
    const fileInput = document.getElementById('reportFileInput');
    const previewContainer = document.getElementById('reportImagePreview');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#b8860b';
        dropZone.style.background = '#f0e8d8';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#b8a080';
        dropZone.style.background = '#f8f0e0';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#b8a080';
        dropZone.style.background = '#f8f0e0';
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => handleFiles(fileInput.files));

    function handleFiles(files) {
        if (reportImages.length + files.length > 5) {
            document.getElementById('reportMessage').className = 'modal-message error';
            document.getElementById('reportMessage').textContent = '⚠️ Maximum 5 images allowed.';
            return;
        }

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            const reader = new FileReader();
            reader.onload = (e) => {
                reportImages.push(e.target.result);
                renderPreview();
            };
            reader.onerror = (e) => {
                console.error('File read error:', e);
                document.getElementById('reportMessage').className = 'modal-message error';
                document.getElementById('reportMessage').textContent = '❌ Error reading file.';
            };
            reader.readAsDataURL(file);
        }
    }

    function renderPreview() {
        previewContainer.innerHTML = '';
        reportImages.forEach((imgData, index) => {
            const div = document.createElement('div');
            div.style.cssText = 'position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:2px solid #b8a080;flex-shrink:0;';
            div.innerHTML = `
                <img src="${imgData}" style="width:100%;height:100%;object-fit:cover;">
                <button data-index="${index}" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;">×</button>
            `;
            div.querySelector('button').addEventListener('click', () => {
                reportImages.splice(index, 1);
                renderPreview();
            });
            previewContainer.appendChild(div);
        });
    }

    // ─── Submit report ──────────────────────────────────────
    document.getElementById('reportSubmitBtn').addEventListener('click', async function() {
        const note = document.getElementById('reportNote').value.trim();
        const messageEl = document.getElementById('reportMessage');
        const submitBtn = this;

        if (!note && reportImages.length === 0) {
            messageEl.className = 'modal-message error';
            messageEl.textContent = '⚠️ Please add a note or at least one image.';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Submitting...';

        try {
            const module = await import('./tickets.js');
            
            const imageBase64 = reportImages;

            console.log(`📤 Submitting report with ${imageBase64.length} images...`);

            const result = await module.submitReport(
                ticket.id,
                note || '',
                imageBase64
            );

            if (result.success) {
                messageEl.className = 'modal-message success';
                messageEl.textContent = '✅ Report submitted! Your leader will review it.';
                submitBtn.textContent = '✅ Submitted';
                if (window.refreshTickets) window.refreshTickets();
                if (window.renderBadgeGrid) window.renderBadgeGrid();
                setTimeout(closeModal, 3000);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Submit error:', error);
            messageEl.className = 'modal-message error';
            messageEl.textContent = `❌ Failed: ${error.message || 'Something went wrong.'}`;
            submitBtn.disabled = false;
            submitBtn.textContent = '📤 Submit Report';
        }
    });
}

// ─── SHOW TICKET DETAILS (Scout View) ──────────────────
function showTicketDetails(ticket, badge) {
    const existing = document.querySelector('.ticket-modal-overlay');
    if (existing) existing.remove();

    const statusColors = {
        pending: '#f39c12',
        'requirements_added': '#8e44ad',
        'report_submitted': '#e67e22',
        approved: '#27ae60',
        rejected: '#e74c3c',
        cancelled: '#95a5a6'
    };

    const statusLabels = {
        pending: '⏳ Waiting for Leader',
        'requirements_added': '📋 Requirements Assigned',
        'report_submitted': '📤 Report Submitted',
        approved: '✅ Approved!',
        rejected: '❌ Not Approved',
        cancelled: '🚫 Cancelled'
    };

    const overlay = document.createElement('div');
    overlay.className = 'ticket-modal-overlay';

    // Parse the request note to extract date/time
    let requestDate = 'Unknown';
    let requestTime = 'Unknown';
    let requestNote = '';
    if (ticket.requestNote) {
        const lines = ticket.requestNote.split('\n');
        for (const line of lines) {
            if (line.startsWith('📅')) {
                const parts = line.replace('📅 ', '').split(' at ');
                requestDate = parts[0] || 'Unknown';
                requestTime = parts[1] || 'Unknown';
            } else if (line.startsWith('📝')) {
                requestNote = line.replace('📝 ', '');
            }
        }
        if (!requestNote && lines.length === 1) {
            requestNote = lines[0];
        }
    }

    const iconHtml = getIconHtml(badge.icon, badge.name, '48px');

    overlay.innerHTML = `
        <div class="ticket-modal ticket-detail">
            <button class="modal-close" id="modalCloseBtn">✕</button>

            <div class="badge-preview">
                ${iconHtml}
                <div class="info">
                    <div class="name">${badge.name}</div>
                    <div class="type">${badge.type.charAt(0).toUpperCase() + badge.type.slice(1)} Badge</div>
                </div>
            </div>

            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:10px 14px;background:${statusColors[ticket.status] || '#95a5a6'}20;border-radius:10px;border-left:4px solid ${statusColors[ticket.status] || '#95a5a6'};">
                <span style="font-weight:700;color:${statusColors[ticket.status] || '#95a5a6'};font-size:15px;">${statusLabels[ticket.status] || ticket.status}</span>
                ${ticket.status === 'pending' ? `<button class="cancel-ticket-btn" data-ticket-id="${ticket.id}" style="margin-left:auto;background:#e74c3c;color:white;border:none;padding:4px 16px;border-radius:20px;font-size:12px;cursor:pointer;font-weight:600;">Cancel Request</button>` : ''}
                ${ticket.status === 'approved' ? `<span style="margin-left:auto;font-size:24px;">🎉</span>` : ''}
            </div>

            <div style="margin-bottom:12px;padding:10px 14px;background:#f8f0e0;border-radius:8px;">
                <strong style="color:#3d2b1f;font-size:13px;">📅 Request Details:</strong>
                <div style="color:#6b5f4a;margin-top:3px;font-size:14px;">
                    ${requestDate !== 'Unknown' ? `📅 ${requestDate} at ${requestTime}` : ''}
                    ${requestNote ? `<br>📝 ${requestNote}` : ''}
                </div>
            </div>

            ${ticket.requirements ? `
                <div style="margin-bottom:14px;padding:14px 16px;background:#d4c4a8;border-radius:10px;border:2px solid #8b6b4d;">
                    <strong style="color:#3d2b1f;font-size:14px;display:block;margin-bottom:6px;">📋 Requirements from ${ticket.leaderName || 'Leader'}</strong>
                    <div style="color:#3d2b1f;font-size:15px;line-height:1.5;">${ticket.requirements}</div>
                    ${ticket.requirementsImage ? `<img src="${ticket.requirementsImage}" style="max-width:100%;max-height:150px;margin-top:8px;border-radius:8px;">` : ''}
                    ${ticket.requirementsAddedAt ? `<div style="font-size:11px;color:#6b5f4a;margin-top:4px;">Added: ${new Date(ticket.requirementsAddedAt.seconds * 1000).toLocaleString()}</div>` : ''}
                    ${ticket.status === 'requirements_added' ? `<button id="submitReportBtn" style="margin-top:10px;background:#8e44ad;color:white;border:none;padding:6px 20px;border-radius:20px;font-size:13px;cursor:pointer;font-weight:600;">📤 Submit Report</button>` : ''}
                </div>
            ` : `
                <div style="margin-bottom:14px;padding:14px 16px;background:#f8f0e0;border-radius:10px;border:2px dashed #b8a080;text-align:center;">
                    <em style="color:#8b7a6a;font-size:14px;">⏳ Your leader is reviewing this request and will assign requirements soon.</em>
                </div>
            `}

            ${ticket.reportText ? `
                <div style="margin-bottom:12px;padding:10px 14px;background:#fdf2e9;border-radius:8px;border-left:3px solid #e67e22;">
                    <strong style="color:#3d2b1f;font-size:13px;">📤 Your Report:</strong>
                    <div style="color:#6b5f4a;margin-top:3px;font-size:14px;">${ticket.reportText}</div>
                    ${ticket.reportImages?.length ? `
                        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
                            ${ticket.reportImages.map(url => 
                                `<img src="${url}" style="max-width:80px;max-height:80px;border-radius:6px;object-fit:cover;border:1px solid #d4c4a8;cursor:pointer;" onclick="window.open('${url}','_blank')">`
                            ).join('')}
                        </div>
                    ` : ''}
                    ${ticket.reportSubmittedAt ? `<div style="font-size:11px;color:#6b5f4a;margin-top:4px;">Submitted: ${new Date(ticket.reportSubmittedAt.seconds * 1000).toLocaleString()}</div>` : ''}
                </div>
            ` : ''}

            ${ticket.decisionNote ? `
                <div style="margin-bottom:12px;padding:10px 14px;background:${ticket.status === 'approved' ? '#d4edda' : '#f8d7da'};border-radius:8px;border-left:3px solid ${ticket.status === 'approved' ? '#27ae60' : '#e74c3c'};">
                    <strong style="color:${ticket.status === 'approved' ? '#155724' : '#721c24'};font-size:13px;">${ticket.status === 'approved' ? '✅ Leader\'s Note:' : '❌ Leader\'s Note:'}</strong>
                    <div style="color:${ticket.status === 'approved' ? '#155724' : '#721c24'};margin-top:3px;font-size:14px;">${ticket.decisionNote}</div>
                </div>
            ` : ''}

            <div style="font-size:12px;color:#8b7a6a;margin-top:12px;border-top:1px solid #d4c4a8;padding-top:10px;display:flex;justify-content:space-between;">
                <span>Requested: ${ticket.createdAt?.seconds ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}</span>
                <span>Status: ${ticket.status}</span>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // ─── Cancel ticket ──────────────────────────────────────
    const cancelBtn = overlay.querySelector('.cancel-ticket-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async function() {
            if (confirm('Cancel this request?')) {
                const module = await import('./tickets.js');
                const result = await module.cancelTicket(ticket.id);
                if (result.success) {
                    alert('Request cancelled.');
                    if (window.refreshTickets) window.refreshTickets();
                    if (window.renderBadgeGrid) window.renderBadgeGrid();
                    closeModal();
                    renderGrid();
                } else {
                    alert('Error: ' + result.error);
                }
            }
        });
    }

    // ─── Submit Report button ──────────────────────────────
    const reportBtn = overlay.querySelector('#submitReportBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            closeModal();
            setTimeout(() => {
                openReportModal(ticket, badge);
            }, 300);
        });
    }
}

// ─── Render grid ─────────────────────────────────────────────
function renderGrid() {
    const grid = document.getElementById('pouchGrid');
    if (!grid) return;

    const filtered = getFilteredBadges();
    scoutTicketsCache = getScoutTickets();

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;color:#6b5f4a;padding:40px 0;font-size:14px;font-family:'Georgia',serif;font-style:italic;">
                No badges of this type yet. Keep exploring! 🧭
            </div>
        `;
        return;
    }

    renderGridWithTickets(filtered);
}

function renderGridWithTickets(filtered) {
    const grid = document.getElementById('pouchGrid');
    if (!grid) return;

    grid.innerHTML = '';

    filtered.forEach((badge) => {
        const isUnlocked = badge.unlocked;
        const ticket = scoutTicketsCache.find(t => t.badgeId === badge.id);
        const ticketStatus = ticket ? ticket.status : null;
        const requirements = ticket ? ticket.requirements : null;
        const leaderName = ticket ? ticket.leaderName : null;

        // ─── Determine slot style ──────────────────────────
        let slotClass = 'pouch-slot';
        let statusEmoji = '';
        let statusText = '';
        let hoverText = '';

        if (isUnlocked) {
            slotClass += ' unlocked';
            statusEmoji = '✅';
            statusText = 'Earned!';
            hoverText = 'Click to view report 🎉';
        } else if (ticketStatus === 'pending') {
            slotClass += ' ticket-pending';
            statusEmoji = '⏳';
            statusText = 'Pending';
            hoverText = '⏳ Waiting for leader...';
        } else if (ticketStatus === 'requirements_added') {
            slotClass += ' ticket-progress';
            statusEmoji = '📋';
            statusText = 'Requirements Assigned';
            hoverText = requirements ? `📋 ${requirements}` : '📋 Click to see requirements';
        } else if (ticketStatus === 'report_submitted') {
            slotClass += ' ticket-review';
            statusEmoji = '📤';
            statusText = 'Report Submitted';
            hoverText = '📤 Waiting for leader to review your report';
        } else if (ticketStatus === 'rejected') {
            slotClass += ' ticket-rejected';
            statusEmoji = '❌';
            statusText = 'Rejected';
            hoverText = '❌ Not approved. Talk to your leader.';
        } else if (ticketStatus === 'approved') {
            slotClass += ' unlocked';
            statusEmoji = '✅';
            statusText = 'Approved!';
            hoverText = '✅ Click to view report!';
        } else {
            slotClass += ' locked';
            statusEmoji = '🔒';
            statusText = 'Click to request';
            hoverText = 'Click to request this badge';
        }

        const slot = document.createElement('div');
        slot.className = slotClass;
        slot.dataset.index = badge.id;

        // ─── Icon HTML ─────────────────────────────────────────
        const iconHtml = getIconHtml(badge.icon, badge.name, '32px');

        slot.innerHTML = `
            ${iconHtml}
            <span class="slot-name">${badge.name}</span>
            <span class="slot-type">${typeLabels[badge.type] || ''}</span>
            ${!isUnlocked ? `<span class="lock-badge">${statusEmoji}</span>` : ''}
            ${ticket && ticket.leaderName && ticketStatus === 'requirements_added' ? `<span class="slot-type" style="font-size:7px;">by ${ticket.leaderName}</span>` : ''}
            <span class="tooltip-text">${hoverText}</span>
        `;

        // ─── Click handler ──────────────────────────────────
        slot.addEventListener('click', async () => {
            // ─── If badge is unlocked OR status is approved ──
            if (isUnlocked || ticketStatus === 'approved') {
                // Find the approved ticket for this badge
                const approvedTicket = scoutTicketsCache.find(t => 
                    t.badgeId === badge.id && t.status === 'approved'
                );
                
                if (approvedTicket) {
                    // Open the report viewer page
                    window.location.href = `report-viewer-ticket.html?ticketId=${approvedTicket.id}`;
                } else {
                    alert(`🎉 You earned "${badge.name}"!`);
                }
                return;
            }

            if (ticket) {
                showTicketDetails(ticket, badge);
                return;
            }

            openTicketModal(badge);
        });

        grid.appendChild(slot);
    });
}

// ─── Render the pouch ────────────────────────────────────
export function renderBadgePouch(containerId = 'page-content', scoutName = 'Scout', scoutRank = 'Membership') {
    const container = document.getElementById(containerId);
    if (!container) return;

    loadBadgeState();
    const { total, earned } = getBadgeStats();
    scoutTicketsCache = getScoutTickets();

    let html = `
        <style>
            .badge-page {
                max-width: 100%;
                width: 100%;
                background: #f2e8d5;
                background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4a882' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                border: 8px solid #6b4c3a;
                border-radius: 24px;
                box-shadow: inset 0 0 0 2px #8b6b4d, 0 8px 32px rgba(0,0,0,0.3);
                padding: 24px 24px 28px;
                margin: 0 auto;
                position: relative;
            }

            .corner-bracket {
                position: absolute;
                width: 32px;
                height: 32px;
                border: 3px solid #a08060;
                border-radius: 4px;
                opacity: 0.5;
                pointer-events: none;
            }
            .corner-tl { top: 16px; left: 16px; border-right: none; border-bottom: none; }
            .corner-tr { top: 16px; right: 16px; border-left: none; border-bottom: none; }
            .corner-bl { bottom: 16px; left: 16px; border-right: none; border-top: none; }
            .corner-br { bottom: 16px; right: 16px; border-left: none; border-top: none; }

            .pouch-header-text {
                text-align: center;
                margin-bottom: 20px;
                position: relative;
            }
            .pouch-header-text h2 {
                font-family: 'Georgia', 'Times New Roman', serif;
                font-size: 28px;
                color: #3d2b1f;
                background: #c4a882;
                display: inline-block;
                padding: 8px 32px;
                border-radius: 4px;
                box-shadow: 0 3px 0 #8b6b4d;
                letter-spacing: 2px;
                margin: 0;
                position: relative;
            }
            .pouch-header-text h2::after {
                content: '';
                position: absolute;
                bottom: -10px;
                left: 15%;
                width: 70%;
                height: 3px;
                background: #8b6b4d;
                border-radius: 2px;
            }
            .pouch-header-text p {
                font-size: 14px;
                color: #6b5f4a;
                margin: 12px 0 0 0;
                font-style: italic;
                font-family: 'Georgia', serif;
                letter-spacing: 1px;
            }

            .pouch-scout-card {
                background: #d4c4a8;
                border: 4px solid #8b6b4d;
                border-radius: 16px;
                box-shadow: inset 0 0 0 2px #b8a080, 0 4px 12px rgba(0,0,0,0.1);
                padding: 12px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 12px;
                cursor: pointer;
                transition: transform 0.2s;
            }
            .pouch-scout-card:hover {
                transform: scale(1.01);
            }
            .pouch-scout-card .scout-info {
                display: flex;
                align-items: center;
                gap: 16px;
            }
            .pouch-scout-card .scout-info .scout-avatar {
                width: 56px;
                height: 56px;
                image-rendering: pixelated;
                border-radius: 50%;
                background: #b8a080;
                padding: 4px;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .pouch-scout-card .scout-info .scout-avatar img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                image-rendering: pixelated;
                border-radius: 50%;
            }
            .pouch-scout-card .scout-info .name {
                font-weight: 700;
                font-size: 18px;
                color: #3d2b1f;
                font-family: 'Georgia', serif;
            }
            .pouch-scout-card .scout-info .rank {
                font-size: 13px;
                color: #6b5f4a;
                font-style: italic;
            }
            .pouch-scout-card .badge-count {
                background: #6b4c3a;
                padding: 6px 18px;
                border-radius: 40px;
                color: #f2e8d5;
                font-weight: 600;
                font-size: 14px;
                border: 2px solid #8b6b4d;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
                white-space: nowrap;
                font-family: 'Georgia', serif;
            }
            .pouch-scout-card .badge-count span {
                color: #ffd700;
            }

            .pouch-filters {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 16px;
                justify-content: center;
            }
            .pouch-filters .filter-btn {
                background: #d4c4a8;
                border: 2px solid #8b6b4d;
                padding: 6px 16px;
                border-radius: 40px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                color: #3d2b1f;
                font-family: 'Georgia', serif;
            }
            .pouch-filters .filter-btn:hover {
                background: #c4a882;
                transform: translateY(-2px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .pouch-filters .filter-btn.active {
                background: #6b4c3a;
                color: #f2e8d5;
                border-color: #6b4c3a;
            }

            .pouch-grid {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 12px;
                background: #d4c4a8;
                padding: 16px;
                border-radius: 16px;
                border: 3px solid #8b6b4d;
                box-shadow: inset 0 0 0 2px #b8a080, 0 4px 12px rgba(0,0,0,0.1);
                margin-bottom: 16px;
                min-height: 200px;
            }
            .pouch-slot {
                aspect-ratio: 1 / 1;
                background: #e8dcc8;
                background-image: repeating-linear-gradient(45deg, rgba(120,90,60,0.05) 0px, rgba(120,90,60,0.05) 2px, transparent 2px, transparent 6px);
                border: 2px dashed #a08060;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                cursor: pointer;
                transition: all 0.25s ease;
                position: relative;
                padding: 6px;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
                min-height: 80px;
            }
            .pouch-slot:hover {
                transform: translateY(-4px) scale(1.02);
                border-color: #b8860b;
                box-shadow: 0 6px 16px rgba(0,0,0,0.15), inset 0 2px 4px rgba(0,0,0,0.05);
                z-index: 2;
            }
            .pouch-slot.locked {
                opacity: 0.6;
                filter: grayscale(0.3);
            }
            .pouch-slot.unlocked {
                border: 2px solid #b8860b;
                background: #f0e8d8;
                box-shadow: 0 0 20px rgba(184,134,11,0.15), inset 0 2px 4px rgba(0,0,0,0.05);
                animation: slotGlow 3s ease-in-out infinite;
            }
            @keyframes slotGlow {
                0%, 100% { box-shadow: 0 0 10px rgba(184,134,11,0.1); }
                50% { box-shadow: 0 0 25px rgba(184,134,11,0.25); }
            }
            .pouch-slot .slot-name {
                font-size: 8px;
                color: #6b5f4a;
                margin-top: 3px;
                text-align: center;
                line-height: 1.2;
                font-weight: 600;
                font-family: 'Georgia', serif;
            }
            .pouch-slot.unlocked .slot-name {
                color: #3d2b1f;
            }
            .pouch-slot .slot-type {
                font-size: 6px;
                text-transform: uppercase;
                color: #8b7a6a;
                letter-spacing: 0.5px;
                margin-top: 1px;
                font-family: 'Georgia', serif;
            }
            .pouch-slot .lock-badge {
                position: absolute;
                top: 4px;
                right: 6px;
                font-size: 12px;
                opacity: 0.8;
            }
            .pouch-slot .tooltip-text {
                display: none;
                position: absolute;
                bottom: calc(100% + 10px);
                left: 50%;
                transform: translateX(-50%);
                background: #3d2b1f;
                color: #f2e8d5;
                padding: 4px 14px;
                border-radius: 8px;
                font-size: 10px;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                z-index: 10;
                font-weight: 500;
                border: 1px solid #8b6b4d;
                font-family: 'Georgia', serif;
            }
            .pouch-slot:hover .tooltip-text {
                display: block;
            }

            /* ─── TICKET STATUS ON BADGES ─── */
            .pouch-slot.ticket-pending {
                border: 2px solid #f39c12;
                animation: pulseOrange 1.5s ease-in-out infinite;
                background: #fef9e7;
            }
            @keyframes pulseOrange {
                0%, 100% { box-shadow: 0 0 5px rgba(243,156,18,0.2); }
                50% { box-shadow: 0 0 20px rgba(243,156,18,0.4); }
            }

            .pouch-slot.ticket-progress {
                border: 2px solid #8e44ad;
                animation: pulsePurple 1.5s ease-in-out infinite;
                background: #f4ecf7;
            }
            @keyframes pulsePurple {
                0%, 100% { box-shadow: 0 0 5px rgba(142,68,173,0.2); }
                50% { box-shadow: 0 0 20px rgba(142,68,173,0.4); }
            }

            .pouch-slot.ticket-review {
                border: 2px solid #e67e22;
                animation: pulseOrange 1.5s ease-in-out infinite;
                background: #fdf2e9;
            }

            .pouch-slot.ticket-rejected {
                border: 2px solid #e74c3c;
                opacity: 0.6;
                filter: grayscale(0.3);
            }

            .pouch-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .pouch-actions button {
                background: #6b4c3a;
                border: none;
                border-bottom: 3px solid #3d2b1f;
                color: #f2e8d5;
                padding: 8px 24px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.15s;
                font-family: 'Georgia', serif;
                letter-spacing: 0.5px;
            }
            .pouch-actions button:hover {
                transform: translateY(-2px);
                border-bottom-width: 5px;
                background: #8b6b4d;
            }
            .pouch-actions button.primary {
                background: #b8860b;
                color: #f2e8d5;
                border-bottom-color: #6b4c3a;
            }
            .pouch-actions button.primary:hover {
                background: #d4a017;
            }

            /* ─── MODALS ─── */
            .ticket-modal-overlay, .report-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            }

            .ticket-modal, .report-modal {
                background: #f2e8d5;
                border: 6px solid #6b4c3a;
                border-radius: 24px;
                padding: 32px;
                max-width: 500px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.4), inset 0 0 0 2px #8b6b4d;
                animation: slideUp 0.3s ease;
                position: relative;
            }

            .ticket-modal .modal-close, .report-modal .modal-close {
                position: absolute;
                top: 16px;
                right: 20px;
                background: none;
                border: none;
                font-size: 28px;
                color: #6b5f4a;
                cursor: pointer;
                transition: color 0.2s;
            }
            .ticket-modal .modal-close:hover, .report-modal .modal-close:hover {
                color: #3d2b1f;
            }

            .ticket-modal .badge-preview, .report-modal .badge-preview {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 20px;
                padding-bottom: 16px;
                border-bottom: 2px solid #d4c4a8;
            }
            .ticket-modal .badge-preview .icon, .report-modal .badge-preview .icon {
                font-size: 48px;
            }
            .ticket-modal .badge-preview .info .name, .report-modal .badge-preview .info .name {
                font-size: 20px;
                font-weight: 700;
                color: #3d2b1f;
                font-family: 'Georgia', serif;
            }
            .ticket-modal .badge-preview .info .type, .report-modal .badge-preview .info .type {
                font-size: 14px;
                color: #6b5f4a;
            }

            .ticket-modal label, .report-modal label {
                display: block;
                font-weight: 600;
                font-size: 14px;
                color: #3d2b1f;
                margin-bottom: 6px;
                font-family: 'Georgia', serif;
            }

            .ticket-modal textarea, .report-modal textarea {
                width: 100%;
                padding: 12px;
                border: 2px solid #b8a080;
                border-radius: 12px;
                font-family: inherit;
                font-size: 14px;
                resize: vertical;
                min-height: 80px;
                transition: border-color 0.2s;
                box-sizing: border-box;
                background: #f8f0e0;
            }
            .ticket-modal textarea:focus, .report-modal textarea:focus {
                outline: none;
                border-color: #b8860b;
            }

            .ticket-modal .modal-actions, .report-modal .modal-actions {
                display: flex;
                gap: 12px;
                margin-top: 20px;
            }
            .ticket-modal .modal-actions button, .report-modal .modal-actions button {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 40px;
                font-weight: 600;
                font-size: 15px;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Georgia', serif;
            }
            .ticket-modal .modal-actions .btn-cancel, .report-modal .modal-actions .btn-cancel {
                background: #d4c4a8;
                color: #3d2b1f;
            }
            .ticket-modal .modal-actions .btn-cancel:hover, .report-modal .modal-actions .btn-cancel:hover {
                background: #c4a882;
            }
            .ticket-modal .modal-actions .btn-submit, .report-modal .modal-actions .btn-submit {
                background: #6b4c3a;
                color: #f2e8d5;
            }
            .ticket-modal .modal-actions .btn-submit:hover, .report-modal .modal-actions .btn-submit:hover {
                background: #8b6b4d;
            }

            .ticket-modal .modal-message, .report-modal .modal-message {
                margin-top: 12px;
                padding: 10px;
                border-radius: 8px;
                font-size: 14px;
                text-align: center;
                display: none;
                font-family: 'Georgia', serif;
            }
            .ticket-modal .modal-message.success, .report-modal .modal-message.success {
                display: block;
                background: #d4edda;
                color: #155724;
            }
            .ticket-modal .modal-message.error, .report-modal .modal-message.error {
                display: block;
                background: #f8d7da;
                color: #721c24;
            }

            #reportDropZone {
                border: 2px dashed #b8a080;
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
                background: #f8f0e0;
            }
            #reportDropZone:hover {
                border-color: #b8860b;
                background: #f0e8d8;
            }
            #reportDropZone.dragover {
                border-color: #b8860b;
                background: #f0e8d8;
            }

            #reportImagePreview {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 10px;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            @media (max-width: 768px) {
                .badge-page { padding: 20px 16px; border-width: 6px; }
                .corner-bracket { width: 24px; height: 24px; }
                .corner-tl, .corner-bl { left: 12px; }
                .corner-tr, .corner-br { right: 12px; }
                .corner-tl, .corner-tr { top: 12px; }
                .corner-bl, .corner-br { bottom: 12px; }
                .pouch-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px; }
                .pouch-slot { font-size: 22px; min-height: 70px; }
                .pouch-slot .slot-name { font-size: 7px; }
                .pouch-header-text h2 { font-size: 20px; padding: 6px 20px; }
                .ticket-modal, .report-modal { padding: 24px; margin: 16px; }
            }
            @media (max-width: 500px) {
                .badge-page { padding: 16px 12px; border-width: 4px; }
                .pouch-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 10px; }
                .pouch-slot { font-size: 18px; min-height: 60px; }
                .pouch-scout-card { flex-direction: column; align-items: stretch; text-align: center; }
                .pouch-scout-card .scout-info { justify-content: center; }
                .pouch-scout-card .badge-count { text-align: center; }
                .pouch-filters .filter-btn { font-size: 10px; padding: 4px 12px; }
                .pouch-header-text h2 { font-size: 18px; }
                .ticket-modal, .report-modal { padding: 20px; }
                .ticket-modal .modal-actions, .report-modal .modal-actions { flex-direction: column; }
                #reportDropZone { padding: 12px; }
            }
        </style>

        <div class="badge-page">
            <div class="corner-bracket corner-tl"></div>
            <div class="corner-bracket corner-tr"></div>
            <div class="corner-bracket corner-bl"></div>
            <div class="corner-bracket corner-br"></div>

            <div class="pouch-header-text">
                <h2>📖 BADGE LOGBOOK</h2>
                <p>"Every badge tells a story"</p>
            </div>

            <div class="pouch-scout-card" id="scoutCard">
                <div class="scout-info">
                    <div class="scout-avatar">
                        <img id="scoutAvatar" src="idle.png" alt="Scout" />
                    </div>
                    <div>
                        <div class="name" id="scoutName">${scoutName}</div>
                        <div class="rank" id="scoutRank">${scoutRank}</div>
                    </div>
                </div>
                <div class="badge-count">
                    <span id="earnedCount">${earned}</span> / <span id="totalCount">${total}</span> badges earned
                </div>
            </div>

            <div class="pouch-filters">
                <button class="filter-btn active" data-filter="all">🎯 All</button>
                <button class="filter-btn" data-filter="camp">🏕️ Camp</button>
                <button class="filter-btn" data-filter="proficiency">🎯 Proficiency</button>
                <button class="filter-btn" data-filter="national">🇿🇦 National</button>
                <button class="filter-btn" data-filter="international">🌍 International</button>
                <button class="filter-btn" data-filter="special">⭐ Special</button>
            </div>

            <div class="pouch-grid" id="pouchGrid"></div>

            <div class="pouch-actions">
                <button id="pouchResetBtn">🔄 Reset</button>
                <button class="primary" id="pouchTicketBtn">🎫 Request Badge</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // ─── SCOUT AVATAR ANIMATION ──────────────────────────────
    function initAvatarAnimation() {
        const img = document.getElementById('scoutAvatar');
        if (!img) return;

        const frames = [
            { src: 'idle.png', duration: 3000 },
            { src: 'left.png', duration: 1500 },
            { src: 'right.png', duration: 1500 },
            { src: 'map.png', duration: 2000 },
            { src: 'left.png', duration: 1000 },
            { src: 'right.png', duration: 1000 },
            { src: 'idle.png', duration: 1000 },
            { src: 'wave.png', duration: 2000 },
        ];

        let currentFrame = 0;
        let timer = null;

        function nextFrame() {
            const frame = frames[currentFrame];
            img.src = frame.src;
            currentFrame = (currentFrame + 1) % frames.length;
            timer = setTimeout(nextFrame, frame.duration);
        }

        const preload = frames.map(f => { const i = new Image(); i.src = f.src; });
        nextFrame();

        window.addEventListener('beforeunload', () => {
            if (timer) clearTimeout(timer);
        });
    }

    // ─── Filter buttons ──────────────────────────────────────────
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.dataset.filter;
            setFilter(filter);
            renderGrid();
        });
    });

    // ─── Reset button ────────────────────────────────────────────
    document.getElementById('pouchResetBtn')?.addEventListener('click', () => {
        if (confirm('Reset all badges? This will lock everything.')) {
            resetBadges();
            const { total, earned } = getBadgeStats();
            document.getElementById('earnedCount').textContent = earned;
            renderGrid();
        }
    });

    // ─── Ticket button ───────────────────────────────────────────
    document.getElementById('pouchTicketBtn')?.addEventListener('click', () => {
        alert('🎫 Select a locked badge from the grid to request it.');
    });

    // ─── Click scout for surprise ───────────────────────────────
    document.getElementById('scoutCard')?.addEventListener('click', () => {
        const locked = badgeState.filter(b => !b.unlocked);
        if (locked.length === 0) {
            alert('🎉 All badges unlocked! You\'re a legend!');
            return;
        }
        const random = locked[Math.floor(Math.random() * locked.length)];
        random.unlocked = true;
        saveBadgeState();
        const { total, earned } = getBadgeStats();
        document.getElementById('earnedCount').textContent = earned;
        renderGrid();
    });

    // ─── INIT ──────────────────────────────────────────────────
    initAvatarAnimation();
    renderGrid();
}
