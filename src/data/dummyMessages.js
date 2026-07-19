export const conversations = [
    {
      id: 'conv-1',
      username: 'priya-patel',
      name: 'Priya Patel',
      initials: 'PP',
      colorClass: 'from-violet-500 to-purple-600',
      isOnline: true,
      lastMessage: 'Sounds good, see you there!',
      lastMessageTime: '2m ago',
      unreadCount: 2
    },
    {
      id: 'conv-2',
      username: 'rahul-mehta',
      name: 'Rahul Mehta',
      initials: 'RM',
      colorClass: 'from-emerald-500 to-teal-600',
      isOnline: false,
      lastMessage: 'Thanks for the notes!',
      lastMessageTime: '1h ago',
      unreadCount: 0
    },
    {
      id: 'conv-3',
      username: 'coding-club',
      name: 'Coding Club',
      initials: 'CC',
      colorClass: 'from-blue-600 to-indigo-600',
      isOnline: true,
      lastMessage: 'Hackathon team slots are almost full',
      lastMessageTime: '3h ago',
      unreadCount: 5
    },
    {
      id: 'conv-4',
      username: 'neha-verma',
      name: 'Neha Verma',
      initials: 'NV',
      colorClass: 'from-pink-500 to-rose-500',
      isOnline: false,
      lastMessage: 'Can you send the OS notes?',
      lastMessageTime: 'Yesterday',
      unreadCount: 0
    },
    {
      id: 'conv-5',
      username: 'kabir-joshi',
      name: 'Kabir Joshi',
      initials: 'KJ',
      colorClass: 'from-amber-500 to-orange-500',
      isOnline: false,
      lastMessage: 'Haha true 😂',
      lastMessageTime: '2d ago',
      unreadCount: 0
    }
  ]
  
  export const messagesByConversationId = {
    'conv-1': [
      { id: 'm1', sender: 'them', text: 'Hey! Are you coming to the study group tonight?', time: '10:02 AM', read: true },
      { id: 'm2', sender: 'me', text: "Yeah I'll be there, just finishing up a lab report", time: '10:05 AM', read: true },
      { id: 'm3', sender: 'them', text: "Perfect, we're meeting at the library 2nd floor", time: '10:06 AM', read: true },
      { id: 'm4', sender: 'me', text: 'Got it, see you around 6', time: '10:07 AM', read: true },
      { id: 'm5', sender: 'them', text: 'Sounds good, see you there!', time: '10:08 AM', read: false }
    ],
    'conv-2': [
      { id: 'm6', sender: 'me', text: 'Here are the DBMS notes I mentioned', time: 'Yesterday', read: true },
      { id: 'm7', sender: 'them', text: 'Thanks for the notes!', time: 'Yesterday', read: true }
    ],
    'conv-3': [
      { id: 'm8', sender: 'them', text: 'Reminder: hackathon registrations close Friday', time: '3h ago', read: true },
      { id: 'm9', sender: 'them', text: 'Hackathon team slots are almost full', time: '3h ago', read: false }
    ],
    'conv-4': [{ id: 'm10', sender: 'them', text: 'Can you send the OS notes?', time: 'Yesterday', read: true }],
    'conv-5': [
      { id: 'm11', sender: 'me', text: 'Did you see the match last night', time: '2d ago', read: true },
      { id: 'm12', sender: 'them', text: 'Haha true 😂', time: '2d ago', read: true }
    ]
  }