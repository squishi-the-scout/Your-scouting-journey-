import { allBadges, typeLabels } from './data/badges-data.js';

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
function getIconHtml(icon, name, size = '36px') {
    if (typeof icon === 'string' && isImageIcon(icon)) {
        return `<img src="${icon}" alt="${name}" style="width:${size};height:${size};object-fit:contain;display:block;margin:0 auto;">`;
    }
    return `<span style="font-size:${size};">${icon}</span>`;
}

// ─── TICKET MODAL (Request) ──────────────────────────────
function openTicketModal(badge) {
    const existing = document.querySelector('.ticket-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ticket-modal-overlay';

    const iconHtml = getIconHtml(badge.icon, badge.name, '48px');

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

        // ─── Use badge color if available ──────────────────────
        const badgeColor = badge.color || '#6b4c3a';

        // ─── Add color to slot ─────────────────────────────────
        slot.style.borderColor = isUnlocked ? '#b8860b' : badgeColor;
        slot.style.background = isUnlocked ? '#f0e8d8' : `linear-gradient(135deg, ${badgeColor}15, ${badgeColor}05)`;

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

    // ─── Build the HTML ──────────────────────────────────────
    // (Same as before, no changes here)
    // ... (keeping it short, but it's the same as your current file)
}
