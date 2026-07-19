export const currentUser = {
  name: 'Aarav Sharma',
  username: 'aarav-sharma',
  initials: 'AS',
  colorClass: 'from-blue-500 to-blue-600'
}

export const stories = [
  {
    id: 'write',
    label: 'Your Note',
    initials: currentUser.initials,
    colorClass: currentUser.colorClass,
    isAdd: true
  },
  {
    id: 's1',
    label: 'Priya P.',
    username: 'priya-patel',
    initials: 'PP',
    colorClass: 'from-violet-500 to-purple-600',
    ringClass: 'from-pink-500 via-red-500 to-yellow-500'
  },
  {
    id: 's2',
    label: 'Rahul M.',
    username: 'rahul-mehta',
    initials: 'RM',
    colorClass: 'from-emerald-500 to-teal-600',
    ringClass: 'from-pink-500 via-red-500 to-yellow-500'
  },
  {
    id: 's3',
    label: 'Coding Club',
    username: 'coding-club',
    initials: 'CC',
    colorClass: 'from-blue-600 to-indigo-600',
    ringClass: 'from-blue-400 via-blue-500 to-indigo-500'
  },
  {
    id: 's4',
    label: 'Tech Fest',
    username: 'tech-fest',
    initials: 'TF',
    colorClass: 'from-orange-500 to-pink-600',
    ringClass: 'from-orange-400 via-pink-500 to-rose-500'
  },
  {
    id: 's5',
    label: 'Neha V.',
    username: 'neha-verma',
    initials: 'NV',
    colorClass: 'from-pink-500 to-rose-500',
    ringClass: 'from-pink-500 via-red-500 to-yellow-500'
  },
  { id: 'more', label: 'More', isMore: true }
]

/**
 * label = what's shown on the tab; key = what post.feedCategories entries
 * are matched against when filtering.
 */
export const feedTabs = [
  { label: 'For You', key: 'forYou' },
  { label: 'Following', key: 'following' },
  { label: 'Campus', key: 'campus' },
  { label: 'Clubs', key: 'clubs' }
]

/**
 * 'general' and 'study' were added for Feature 4B (Create Post) — every
 * post.type value that can exist (seed data or user-created) must have an
 * entry here, or PostCard's badge rendering throws on an unknown type.
 */
export const postTypeConfig = {
  general: { label: 'General', color: 'text-gray-600 bg-gray-100' },
  study: { label: 'Study', color: 'text-purple-600 bg-purple-50' },
  notes: { label: 'Notes', color: 'text-blue-600 bg-blue-50' },
  event: { label: 'Event', color: 'text-orange-600 bg-orange-50' },
  club: { label: 'Club update', color: 'text-indigo-600 bg-indigo-50' },
  marketplace: { label: 'Marketplace', color: 'text-emerald-600 bg-emerald-50' },
  lostfound: { label: 'Lost & Found', color: 'text-pink-600 bg-pink-50' }
}

export const posts = [
  {
    id: 1,
    type: 'notes',
    name: 'Aarav Sharma',
    username: 'aarav-sharma',
    initials: 'AS',
    avatarColor: 'from-blue-500 to-blue-600',
    department: 'Computer Science',
    year: 'FY · B',
    college: 'Xavier Institute of Engineering',
    time: '2h ago',
    text: "Sharing my complete DBMS Unit 4 notes — covers normalization, trees and indexing. Hope this helps before tomorrow's viva.",
    file: { name: 'DBMS_Unit4_Trees.pdf', size: '2.4 MB' },
    likes: 214,
    comments: 38,
    likedByMe: false,
    feedCategories: ['forYou', 'following']
  },
  {
    id: 2,
    type: 'event',
    name: 'Student Council',
    username: 'student-council',
    initials: 'SC',
    avatarColor: 'from-indigo-500 to-blue-600',
    department: 'Official',
    year: '',
    college: 'Xavier Institute of Engineering',
    time: '4h ago',
    text: 'Freshers Party is here — food, music and a lineup of performances. Tickets go live tonight at 8 PM.',
    event: { title: 'Freshers Party 2026', date: 'Aug 18 · 6:00 PM', location: 'Main Auditorium' },
    likes: 482,
    comments: 96,
    likedByMe: true,
    feedCategories: ['forYou', 'campus']
  },
  {
    id: 3,
    type: 'club',
    name: 'Coding Club',
    username: 'coding-club',
    initials: 'CC',
    avatarColor: 'from-blue-600 to-indigo-600',
    department: 'Official Club',
    year: '',
    college: 'Xavier Institute of Engineering',
    time: '5h ago',
    text: 'Hackathon registrations close this Friday. Teams of up to 4 — sign up on the Events tab before slots run out.',
    likes: 156,
    comments: 24,
    likedByMe: false,
    feedCategories: ['forYou', 'campus', 'clubs']
  },
  {
    id: 4,
    type: 'marketplace',
    name: 'Priya Patel',
    username: 'priya-patel',
    initials: 'PP',
    avatarColor: 'from-violet-500 to-purple-600',
    department: 'Electronics',
    year: 'SY · A',
    college: 'Xavier Institute of Engineering',
    time: '7h ago',
    text: "Selling my barely-used drafter set and lab coat — moved to a branch that doesn't need them. Good condition.",
    marketplace: { item: 'Drafter Set + Lab Coat', price: '₹450' },
    likes: 32,
    comments: 11,
    likedByMe: false,
    feedCategories: ['forYou', 'following']
  },
  {
    id: 5,
    type: 'lostfound',
    name: 'Rahul Mehta',
    username: 'rahul-mehta',
    initials: 'RM',
    avatarColor: 'from-emerald-500 to-teal-600',
    department: 'Mechanical',
    year: 'TY · C',
    college: 'Xavier Institute of Engineering',
    time: '9h ago',
    text: "Found a black wired earphone near the library entrance this morning. DM if it's yours with a description.",
    lostFound: { status: 'Found', location: 'Library Entrance' },
    likes: 19,
    comments: 6,
    likedByMe: false,
    feedCategories: ['forYou', 'campus']
  }
]