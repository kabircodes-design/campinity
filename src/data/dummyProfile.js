export const currentUserProfile = {
    uid: 'aarav-sharma',
    name: 'Aarav Sharma',
    username: 'aarav-sharma',
    initials: 'AS',
    colorClass: 'from-blue-500 to-blue-600',
    coverGradient: 'from-blue-600 via-indigo-600 to-blue-700',
    college: 'Xavier Institute of Engineering',
    department: 'Computer Science',
    year: 'FY',
    bio: 'Building things, breaking things, learning DBMS the hard way. Coding Club core member.',
    followers: 482,
    following: 213,
    postsCount: 12,
    skills: ['React', 'Python', 'Data Structures', 'UI Design'],
    interests: ['Photography', 'Football', 'Open Source', 'Chess']
  }
  
  /** Cross-referenced by id against src/data/dummySearch.js's events array. */
  export const myEventIds = ['freshers-party', 'campus-hackathon']
  
  export const profileTabs = [
    { label: 'Posts', key: 'posts' },
    { label: 'Notes', key: 'notes' },
    { label: 'Events', key: 'events' },
    { label: 'Marketplace', key: 'marketplace' }
  ]