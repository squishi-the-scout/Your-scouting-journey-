import { db } from './firebase-config.js';
import { 
    collection, doc, getDoc, getDocs, setDoc, 
    updateDoc, deleteDoc, onSnapshot, query, 
    where, orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── Collection name ──────────────────────────────────────
const TICKETS_COLLECTION = 'tickets';

// ─── Create a new ticket ──────────────────────────────────
export async function createTicket(scoutId, badgeId, badgeName, badgeIcon, note = '') {
    try {
        const ticketRef = doc(collection(db, TICKETS_COLLECTION));
        const ticketData = {
            ticketId: ticketRef.id,
            scoutId: scoutId,
            badgeId: badgeId,
            badgeName: badgeName,
            badgeIcon: badgeIcon,
            note: note || '',
            status: 'pending', // pending | in-progress | needs-review | approved | rejected | cancelled
            requirements: '',
            leaderNote: '',
            reportNote: '',
            reportImages: [],
            reportSubmittedAt: null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            approvedAt: null,
            rejectedAt: null,
            cancelledAt: null,
        };
        await setDoc(ticketRef, ticketData);
        return { success: true, ticketId: ticketRef.id };
    } catch (error) {
        console.error('Error creating ticket:', error);
        return { success: false, error: error.message };
    }
}

// ─── Get a single ticket ──────────────────────────────────
export async function getTicket(ticketId) {
    try {
        const docRef = doc(db, TICKETS_COLLECTION, ticketId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { success: true, data: docSnap.data() };
        } else {
            return { success: false, error: 'Ticket not found' };
        }
    } catch (error) {
        console.error('Error getting ticket:', error);
        return { success: false, error: error.message };
    }
}

// ─── Get tickets for a scout ──────────────────────────────
export async function getScoutTickets(scoutId) {
    try {
        const q = query(
            collection(db, TICKETS_COLLECTION),
            where('scoutId', '==', scoutId)
        );
        const snapshot = await getDocs(q);
        const tickets = [];
        snapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
        });
        // Sort in JavaScript (newest first)
        tickets.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });
        return { success: true, data: tickets };
    } catch (error) {
        console.error('Error getting scout tickets:', error);
        return { success: false, error: error.message };
    }
}

// ─── Get all tickets (for leaders) ──────────────────────
export async function getAllTickets() {
    try {
        const q = query(
            collection(db, TICKETS_COLLECTION),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const tickets = [];
        snapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: tickets };
    } catch (error) {
        console.error('Error getting all tickets:', error);
        return { success: false, error: error.message };
    }
}

// ─── Get pending tickets (for leader notification) ──────
export async function getPendingTickets() {
    try {
        const q = query(
            collection(db, TICKETS_COLLECTION),
            where('status', 'in', ['pending', 'in-progress', 'needs-review']),
            orderBy('createdAt', 'asc')
        );
        const snapshot = await getDocs(q);
        const tickets = [];
        snapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: tickets };
    } catch (error) {
        console.error('Error getting pending tickets:', error);
        return { success: false, error: error.message };
    }
}

// ─── Get pending count (for badge notification) ──────────
export async function getPendingTicketCount() {
    const result = await getPendingTickets();
    if (result.success) {
        return result.data.length;
    }
    return 0;
}

// ─── Update ticket status ──────────────────────────────────
export async function updateTicketStatus(ticketId, status) {
    try {
        const docRef = doc(db, TICKETS_COLLECTION, ticketId);
        const updateData = {
            status: status,
            updatedAt: Timestamp.now()
        };
        if (status === 'approved') {
            updateData.approvedAt = Timestamp.now();
        } else if (status === 'rejected') {
            updateData.rejectedAt = Timestamp.now();
        } else if (status === 'cancelled') {
            updateData.cancelledAt = Timestamp.now();
        }
        await updateDoc(docRef, updateData);
        return { success: true };
    } catch (error) {
        console.error('Error updating ticket status:', error);
        return { success: false, error: error.message };
    }
}

// ─── Update ticket requirements (leader) ──────────────────
export async function updateTicketRequirements(ticketId, requirements, leaderNote = '') {
    try {
        const docRef = doc(db, TICKETS_COLLECTION, ticketId);
        await updateDoc(docRef, {
            requirements: requirements,
            leaderNote: leaderNote,
            status: 'in-progress',
            updatedAt: Timestamp.now()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating requirements:', error);
        return { success: false, error: error.message };
    }
}

// ─── Submit a report (scout submits work) ──────────────────
export async function submitReport(ticketId, note, images = []) {
    try {
        const docRef = doc(db, TICKETS_COLLECTION, ticketId);
        
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            return { success: false, error: 'Ticket not found' };
        }
        
        const ticketData = docSnap.data();
        
        if (!ticketData.requirements || ticketData.requirements.trim() === '') {
            return { success: false, error: 'No requirements assigned yet. Wait for your leader.' };
        }
        
        const updateData = {
            status: 'needs-review',
            reportNote: note || '',
            reportImages: images || [],
            reportSubmittedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        
        await updateDoc(docRef, updateData);
        return { success: true };
    } catch (error) {
        console.error('Error submitting report:', error);
        return { success: false, error: error.message };
    }
}

// ─── Cancel a ticket (scout) ──────────────────────────────
export async function cancelTicket(ticketId) {
    return await updateTicketStatus(ticketId, 'cancelled');
}

// ─── Real-time listener for scout tickets ──────────────────
export function listenToScoutTickets(scoutId, callback) {
    const q = query(
        collection(db, TICKETS_COLLECTION),
        where('scoutId', '==', scoutId),
        orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        const tickets = [];
        snapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
        });
        callback(tickets);
    }, (error) => {
        console.error('Error listening to tickets:', error);
        callback([]);
    });
}

// ─── Real-time listener for all tickets (leaders) ──────────
export function listenToAllTickets(callback) {
    const q = query(
        collection(db, TICKETS_COLLECTION),
        orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        const tickets = [];
        snapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
        });
        callback(tickets);
    }, (error) => {
        console.error('Error listening to tickets:', error);
        callback([]);
    });
}

// ─── Real-time listener for pending tickets (leaders) ──────
export function listenToPendingTickets(callback) {
    const q = query(
        collection(db, TICKETS_COLLECTION),
        where('status', 'in', ['pending', 'in-progress', 'needs-review']),
        orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
        const tickets = [];
        snapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
        });
        callback(tickets);
    }, (error) => {
        console.error('Error listening to pending tickets:', error);
        callback([]);
    });
}
