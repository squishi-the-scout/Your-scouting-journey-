// data/badges-data.js — All badge data with SVG icons + colors

export const allBadges = [
    // ─── PROFICIENCY BADGES ──────────────────────────────────
    // Type 1: Blue/Purple theme
    {
        id: 'advance-pioneer',
        name: 'Advance Pioneer',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><path d="M8 7l4 2 4-2"/></svg>`,
        type: 'proficiency',
        color: '#6c3b8c', // Purple
        description: 'Master advanced pioneering skills'
    },
    {
        id: 'advance-swimmer',
        name: 'Advance Swimmer',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M6 8v2a6 6 0 0 0 12 0V8"/><path d="M4 18h16"/><path d="M8 22l2-2"/><path d="M16 22l2-2"/></svg>`,
        type: 'proficiency',
        color: '#3498db', // Blue
        description: 'Advanced swimming and water safety'
    },
    {
        id: 'ambulance',
        name: 'Ambulance',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/><path d="M18 6V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>`,
        type: 'proficiency',
        color: '#e74c3c', // Red
        description: 'First aid and emergency response'
    },
    {
        id: 'angler',
        name: 'Angler',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L8 8h8L12 2z"/><path d="M12 8v10"/><path d="M6 18c0-2 2-4 6-4s6 2 6 4"/><path d="M6 18h12"/><path d="M9 18v2"/><path d="M15 18v2"/></svg>`,
        type: 'proficiency',
        color: '#27ae60', // Green
        description: 'Fishing skills and knowledge'
    },
    {
        id: 'artist',
        name: 'Artist',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0-7.07 17.07A10 10 0 0 0 12 22a10 10 0 0 0 7.07-17.07A10 10 0 0 0 12 2z"/><path d="M12 6v4"/><path d="M9 9l6 0"/><path d="M9 13l6 0"/><path d="M9 17l4 0"/></svg>`,
        type: 'proficiency',
        color: '#f39c12', // Orange
        description: 'Creative arts and crafts'
    },
    {
        id: 'backwoods-skills',
        name: 'Backwoods Skills',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L20 4"/><path d="M6 16l4 4"/><path d="M8 12l4 4"/><path d="M12 8l4 4"/><path d="M16 4l4 4"/><path d="M4 4l16 16"/></svg>`,
        type: 'proficiency',
        color: '#2d5a4a', // Dark green
        description: 'Survival and bushcraft skills'
    },
    {
        id: 'boatswain',
        name: 'Boatswain',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l10 5 10-5"/><path d="M2 12l10-5 10 5"/><path d="M12 7v10"/><path d="M4 17l4 2"/><path d="M20 17l-4 2"/></svg>`,
        type: 'proficiency',
        color: '#2980b9', // Dark blue
        description: 'Boat handling and seamanship'
    },
    {
        id: 'camp-cook',
        name: 'Camp Cook',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/><path d="M18 18l2 2"/><path d="M6 6l2 2"/><path d="M6 18l2-2"/><path d="M18 6l-2 2"/></svg>`,
        type: 'proficiency',
        color: '#d4a017', // Gold
        description: 'Outdoor cooking and camp meals'
    },
    {
        id: 'camp-warden',
        name: 'Camp Warden',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><circle cx="12" cy="12" r="3"/></svg>`,
        type: 'proficiency',
        color: '#8e44ad', // Purple
        description: 'Camp management and leadership'
    },
    {
        id: 'camper',
        name: 'Camper',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><path d="M8 15l4-3 4 3"/></svg>`,
        type: 'proficiency',
        color: '#16a085', // Teal
        description: 'Camping skills and outdoor living'
    },
    {
        id: 'communicator',
        name: 'Communicator',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
        type: 'proficiency',
        color: '#3498db', // Blue
        description: 'Communication and signalling skills'
    },
    {
        id: 'community',
        name: 'Community',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        type: 'proficiency',
        color: '#2ecc71', // Green
        description: 'Community service and involvement'
    },
    {
        id: 'cook',
        name: 'Cook',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0-7.07 17.07A10 10 0 0 0 12 22a10 10 0 0 0 7.07-17.07A10 10 0 0 0 12 2z"/><path d="M8 12h8"/><path d="M12 8v8"/><path d="M8 16l8-8"/></svg>`,
        type: 'proficiency',
        color: '#e67e22', // Orange
        description: 'General cooking and meal preparation'
    },
    {
        id: 'craft',
        name: 'Craft',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><path d="M8 7l4 2 4-2"/><path d="M6 13l4 2 4-2"/></svg>`,
        type: 'proficiency',
        color: '#8e44ad', // Purple
        description: 'Handicrafts and practical skills'
    },
    {
        id: 'cyclist',
        name: 'Cyclist',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><path d="M12 18V6l4 2"/><path d="M16 10l-4 2"/><path d="M8 10l4-2"/></svg>`,
        type: 'proficiency',
        color: '#2c3e50', // Dark
        description: 'Cycling skills and road safety'
    },
    {
        id: 'diy',
        name: 'D.I.Y (Do It Yourself)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><path d="M8 7l4 2 4-2"/><path d="M6 13l4 2 4-2"/><path d="M4 9l4 2 4-2"/></svg>`,
        type: 'proficiency',
        color: '#d35400', // Dark orange
        description: 'DIY projects and repairs'
    },
    {
        id: 'entertainer',
        name: 'Entertainer',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
        type: 'proficiency',
        color: '#f1c40f', // Yellow
        description: 'Performance and entertainment skills'
    },
    {
        id: 'explorer',
        name: 'Explorer',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`,
        type: 'proficiency',
        color: '#2980b9', // Blue
        description: 'Exploration and discovery'
    },
    {
        id: 'fire-fighter',
        name: 'Fire Fighter',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8 6 6 10 6 14c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-2-8-6-12z"/><path d="M12 8v6"/><path d="M10 12h4"/></svg>`,
        type: 'proficiency',
        color: '#e74c3c', // Red
        description: 'Fire safety and firefighting skills'
    },
    {
        id: 'forester',
        name: 'Forester',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><path d="M8 7l4 2 4-2"/><path d="M6 11l4 2 4-2"/></svg>`,
        type: 'proficiency',
        color: '#27ae60', // Green
        description: 'Forestry and tree identification'
    },
    {
        id: 'guide',
        name: 'Guide',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`,
        type: 'proficiency',
        color: '#8e44ad', // Purple
        description: 'Guiding and leadership skills'
    },
    {
        id: 'hobbies',
        name: 'Hobbies',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`,
        type: 'proficiency',
        color: '#f39c12', // Orange
        description: 'Personal hobbies and interests'
    },
    {
        id: 'information-technology',
        name: 'Information Technology',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
        type: 'proficiency',
        color: '#2c3e50', // Dark
        description: 'IT and digital skills'
    },
    {
        id: 'interpreter',
        name: 'Interpreter',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 8l4 4-4 4"/><path d="M16 8l-4 4 4 4"/></svg>`,
        type: 'proficiency',
        color: '#3498db', // Blue
        description: 'Language translation and interpretation'
    },
    {
        id: 'librarian',
        name: 'Librarian',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="14" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>`,
        type: 'proficiency',
        color: '#8e44ad', // Purple
        description: 'Library and research skills'
    },
    {
        id: 'life-saver',
        name: 'Life Saver',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>`,
        type: 'proficiency',
        color: '#e74c3c', // Red
        description: 'Lifesaving and water rescue'
    },
    {
        id: 'map-maker',
        name: 'Map Maker',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><path d="M6 7l6 3 6-3"/><path d="M6 12l6 3 6-3"/></svg>`,
        type: 'proficiency',
        color: '#2980b9', // Blue
        description: 'Cartography and map reading'
    },
    {
        id: 'mechanic',
        name: 'Mechanic',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        type: 'proficiency',
        color: '#2c3e50', // Dark
        description: 'Mechanical skills and repairs'
    },
    {
        id: 'meteorologist',
        name: 'Meteorologist',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/><path d="M8 12h8"/></svg>`,
        type: 'proficiency',
        color: '#3498db', // Blue
        description: 'Weather observation and forecasting'
    },
    {
        id: 'model-maker',
        name: 'Model Maker',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h4"/><path d="M16 16h0"/></svg>`,
        type: 'proficiency',
        color: '#f39c12', // Orange
        description: 'Model building and construction'
    },
    {
        id: 'musician',
        name: 'Musician',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 12l12-2"/></svg>`,
        type: 'proficiency',
        color: '#8e44ad', // Purple
        description: 'Musical skills and performance'
    },
    {
        id: 'naturalist',
        name: 'Naturalist',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><path d="M6 11l6 3 6-3"/><path d="M4 15l8 4 8-4"/></svg>`,
        type: 'proficiency',
        color: '#27ae60', // Green
        description: 'Nature study and conservation'
    },
    {
        id: 'navigator',
        name: 'Navigator',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`,
        type: 'proficiency',
        color: '#2980b9', // Blue
        description: 'Navigation and orienteering'
    },
    {
        id: 'observer',
        name: 'Observer',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
        type: 'proficiency',
        color: '#f39c12', // Orange
        description: 'Observation and reporting skills'
    },
    {
        id: 'photographer',
        name: 'Photographer',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M9 3l1 2h4l1-2"/></svg>`,
        type: 'proficiency',
        color: '#2c3e50', // Dark
        description: 'Photography skills and techniques'
    },
    {
        id: 'pioneer',
        name: 'Pioneer',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><path d="M8 7l4 2 4-2"/></svg>`,
        type: 'proficiency',
        color: '#8e44ad', // Purple
        description: 'Pioneering and construction skills'
    },
    {
        id: 'power-coxswain',
        name: 'Power Coxswain',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l10 5 10-5"/><path d="M2 12l10-5 10 5"/><path d="M12 7v10"/><path d="M4 17l4 2"/><path d="M20 17l-4 2"/><circle cx="12" cy="12" r="2"/></svg>`,
        type: 'proficiency',
        color: '#2980b9', // Blue
        description: 'Power boat handling and navigation'
    },
    {
        id: 'quarter-master',
        name: 'Quarter Master',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 8h8"/><path d="M8 12h6"/><path d="M8 16h4"/></svg>`,
        type: 'proficiency',
        color: '#2c3e50', // Dark
        description: 'Logistics and equipment management'
    },
    {
        id: 'secretary',
        name: 'Secretary',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 22v-10"/><path d="M8 7l4 2 4-2"/><path d="M6 11l6 3 6-3"/></svg>`,
        type: 'proficiency',
        color: '#8e44ad', // Purple
        description: 'Administrative and record keeping skills'
    },
    {
        id: 'swimmer',
        name: 'Swimmer',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M6 8v2a6 6 0 0 0 12 0V8"/><path d="M4 18h16"/></svg>`,
        type: 'proficiency',
        color: '#3498db', // Blue
        description: 'Swimming skills and water safety'
    },
    {
        id: 'water-sports',
        name: 'Water Sports',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4L4 8l8 4 8-4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/><path d="M4 20l8 4 8-4"/><path d="M12 8v4"/></svg>`,
        type: 'proficiency',
        color: '#2980b9', // Blue
        description: 'Water sports and activities'
    },
    {
        id: 'world-conservation',
        name: 'World Conservation',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`,
        type: 'proficiency',
        color: '#27ae60', // Green
        description: 'Environmental conservation and awareness'
    },
    {
        id: 'world-friendship',
        name: 'World Friendship',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/></svg>`,
        type: 'proficiency',
        color: '#f1c40f', // Yellow
        description: 'International friendship and cultural exchange'
    }
];

// ─── TYPE LABELS ──────────────────────────────────────────
export const typeLabels = {
    proficiency: 'Proficiency',
    camp: 'Camp',
    national: 'National',
    international: 'International',
    special: 'Special'
};
