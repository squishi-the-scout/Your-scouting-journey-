// tickets.js — Firebase Ticket Operations (Base64 version)
import { db } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    updateDoc,
    doc,
    getDoc,
    deleteDoc,
    Timestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── HELPERS ──────────────────────────────────────────────

function getCurrentUser() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) throw new Error('No user logged in');
    return user;
}

// ─── Get display name: "Username (Leader)" ──────────────
function getUserDisplayName(user) {
    const username = user.username || 'Leader';
    const role = user.role || 'Leader';
    // Format: "Username (Leader)" — e.g., "Hazfar (Leader)"
    return `${username} (${role})`;
}

function generateTicketId() {
    return `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

// ─── CREATE TICKET ─────────────────────────────────────────

export async function createTicket(scoutName, badgeId, badgeName, badgeIcon, note = '') {
    try {
        const user = getCurrentUser();
        const ticketData = {
            ticketId: generateTicketId(),
            scoutId: user.uid || 'anonymous',
            scoutName: scoutName || user.username || 'Scout',
            badgeId: badgeId,
            badgeName: badgeName,
            badgeIcon: badgeIcon || '🏅',
            status: 'pending',
            
            // Scout request
            requestNote: note || '',
            createdAt: Timestamp.now(),
            
            // Leader fields (empty initially)
            requirements: null,
            requirementsImage: null,
            leaderId: null,
            leaderName: null,
            leaderNote: null,
            requirementsAddedAt: null,
            
            // Scout report (empty initially)
            reportText: null,
            reportImages: [],
            reportSubmittedAt: null,
            
            // Decision (empty initially)
            decision: null,
            decisionNote: null,
            decidedAt: null,
            decidedBy: null
        };

        const docRef = await addDoc(collection(db, 'tickets'), ticketData);
        console.log(`✅ Ticket created: ${docRef.id}`);
        
        return { success: true, ticketId: docRef.id, data: ticketData };
    } catch (error) {
        console.error('❌ Failed to create ticket:', error);
        return { success: false, error: error.message };
    }
}

// ─── GET SCOUT TICKETS ────────────────────────────────────

export async function getScoutTickets(scoutName) {
    try {
        const ticketsRef = collection(db, 'tickets');
        const q = query(
            ticketsRef,
            where('scoutName', '==', scoutName),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const tickets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return { success: true, data: tickets };
    } catch (error) {
        console.error('❌ Failed to get scout tickets:', error);
        return { success: false, error: error.message, data: [] };
    }
}

// ─── GET ALL TICKETS (for Leader) ─────────────────────────

export async function getAllTickets() {
    try {
        const ticketsRef = collection(db, 'tickets');
        const q = query(ticketsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const tickets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return { success: true, data: tickets };
    } catch (error) {
        console.error('❌ Failed to get all tickets:', error);
        return { success: false, error: error.message, data: [] };
    }
}

// ─── GET TICKET BY ID ─────────────────────────────────────

export async function getTicketById(ticketId) {
    try {
        const docRef = doc(db, 'tickets', ticketId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            return { success: false, error: 'Ticket not found' };
        }
        return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
    } catch (error) {
        console.error('❌ Failed to get ticket:', error);
        return { success: false, error: error.message };
    }
}

// ─── GET PENDING COUNT ─────────────────────────────────────

export async function getPendingTicketCount() {
    try {
        const ticketsRef = collection(db, 'tickets');
        const q = query(ticketsRef, where('status', 'in', ['pending', 'requirements_added', 'report_submitted']));
        const snapshot = await getDocs(q);
        return { success: true, count: snapshot.size };
    } catch (error) {
        console.error('❌ Failed to get pending count:', error);
        return { success: false, error: error.message, count: 0 };
    }
}

// ─── LEADER: ADD REQUIREMENTS ─────────────────────────────

export async function addRequirements(ticketId, requirementsText, imageFile = null, leaderName = null) {
    try {
        const user = getCurrentUser();
        const docRef = doc(db, 'tickets', ticketId);
        
        // Use provided leaderName or get from user
        const leaderDisplayName = leaderName || getUserDisplayName(user);
        
        let imageBase64 = null;
        if (imageFile) {
            imageBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });
        }

        await updateDoc(docRef, {
            requirements: requirementsText,
            requirementsImage: imageBase64,
            leaderId: user.uid || 'leader',
            leaderName: leaderDisplayName,
            leaderNote: null,
            requirementsAddedAt: Timestamp.now(),
            status: 'requirements_added'
        });

        console.log(`✅ Requirements added to ticket: ${ticketId} by ${leaderDisplayName}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to add requirements:', error);
        return { success: false, error: error.message };
    }
}

// ─── LEADER: REJECT TICKET ────────────────────────────────

export async function rejectTicket(ticketId, reason = '') {
    try {
        const user = getCurrentUser();
        const docRef = doc(db, 'tickets', ticketId);
        
        const leaderDisplayName = getUserDisplayName(user);
        
        await updateDoc(docRef, {
            status: 'rejected',
            decision: 'rejected',
            decisionNote: reason || 'No reason provided',
            decidedAt: Timestamp.now(),
            decidedBy: leaderDisplayName,
            leaderName: leaderDisplayName
        });

        console.log(`❌ Ticket rejected: ${ticketId} by ${leaderDisplayName}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to reject ticket:', error);
        return { success: false, error: error.message };
    }
}

// ─── SCOUT: SUBMIT REPORT ──────────────────────────────────

export async function submitReport(ticketId, reportText, imageBase64 = []) {
    try {
        const docRef = doc(db, 'tickets', ticketId);
        
        // Cap image count at 5
        const images = imageBase64.slice(0, 5);
        
        await updateDoc(docRef, {
            reportText: reportText,
            reportImages: images,
            reportSubmittedAt: Timestamp.now(),
            status: 'report_submitted'
        });

        console.log(`✅ Report submitted for ticket: ${ticketId} with ${images.length} images`);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to submit report:', error);
        return { success: false, error: error.message };
    }
}

// ─── LEADER: APPROVE TICKET ───────────────────────────────

export async function approveTicket(ticketId, note = '') {
    try {
        const user = getCurrentUser();
        const docRef = doc(db, 'tickets', ticketId);
        
        const leaderDisplayName = getUserDisplayName(user);
        
        await updateDoc(docRef, {
            status: 'approved',
            decision: 'approved',
            decisionNote: note || 'Approved! Well done!',
            decidedAt: Timestamp.now(),
            decidedBy: leaderDisplayName,
            leaderName: leaderDisplayName
        });

        console.log(`✅ Ticket approved: ${ticketId} by ${leaderDisplayName}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to approve ticket:', error);
        return { success: false, error: error.message };
    }
}

// ─── SCOUT: CANCEL TICKET ──────────────────────────────────

export async function cancelTicket(ticketId) {
    try {
        const docRef = doc(db, 'tickets', ticketId);
        await updateDoc(docRef, {
            status: 'cancelled'
        });
        console.log(`🚫 Ticket cancelled: ${ticketId}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to cancel ticket:', error);
        return { success: false, error: error.message };
    }
}

// ─── DELETE TICKET (admin only) ───────────────────────────

export async function deleteTicket(ticketId) {
    try {
        const docRef = doc(db, 'tickets', ticketId);
        await deleteDoc(docRef);
        console.log(`🗑️ Ticket deleted: ${ticketId}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to delete ticket:', error);
        return { success: false, error: error.message };
    }
}

// ─── GET TICKETS BY STATUS ─────────────────────────────────

export async function getTicketsByStatus(status) {
    try {
        const ticketsRef = collection(db, 'tickets');
        const q = query(ticketsRef, where('status', '==', status), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const tickets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return { success: true, data: tickets };
    } catch (error) {
        console.error('❌ Failed to get tickets by status:', error);
        return { success: false, error: error.message, data: [] };
    }
}

// ─── LISTEN FOR TICKET UPDATES (real-time) ────────────────

export function listenToTickets(callback) {
    const ticketsRef = collection(db, 'tickets');
    const q = query(ticketsRef, orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
        const tickets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(tickets);
    }, (error) => {
        console.error('❌ Ticket listener error:', error);
    });
}

// ─── LISTEN TO SCOUT TICKETS (real-time) ──────────────────

export function listenToScoutTickets(scoutName, callback) {
    const ticketsRef = collection(db, 'tickets');
    const q = query(
        ticketsRef,
        where('scoutName', '==', scoutName),
        orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
        const tickets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(tickets);
    }, (error) => {
        console.error('❌ Scout ticket listener error:', error);
    });
}
