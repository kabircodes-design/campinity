/**
 * PROTOTYPE ONLY — every value below is invented mock data, isolated
 * to this one file per the explicit instruction. Nothing here reads
 * from or writes to Firebase. Do not treat any of this as real.
 */
export const MOCK_STORES = [
  { id: 'store-1', name: 'The Burger Club', category: 'Food', distance: '450 m away', rating: 4.6, reviews: 128, offer: '20% OFF', deliveryMin: 30, emoji: '🍔' },
  { id: 'store-2', name: 'Urban Drip', category: 'Fashion', distance: '600 m away', rating: 4.4, reviews: 96, offer: '15% OFF', deliveryMin: 45, emoji: '👕' },
  { id: 'store-3', name: 'Tech World', category: 'Electronics', distance: '700 m away', rating: 4.5, reviews: 76, offer: '10% OFF', deliveryMin: 40, emoji: '💻' },
  { id: 'store-4', name: 'Book Nook', category: 'Books', distance: '800 m away', rating: 4.3, reviews: 54, offer: '5% OFF', deliveryMin: 60, emoji: '📚' }
]

export const MOCK_FLASH_DEALS = [
  { id: 'deal-1', name: 'Wireless Earbuds', brand: 'SoundCore', price: 1799, originalPrice: 2999, discount: '40% OFF', emoji: '🎧' },
  { id: 'deal-2', name: 'Campus Hoodie', brand: 'Drip Culture', price: 999, originalPrice: 1599, discount: '37% OFF', emoji: '🧥' },
  { id: 'deal-3', name: 'Protein Bar', brand: 'Whole Truth', price: 299, originalPrice: 499, discount: '40% OFF', emoji: '🍫' },
  { id: 'deal-4', name: 'Smart Watch', brand: 'Noise', price: 2499, originalPrice: 4999, discount: '50% OFF', emoji: '⌚' }
]

export const MOCK_SPONSORED = [
  { id: 'sp-1', name: "Domino's Pizza", distance: '500 m away', offer: '25% OFF', emoji: '🍕' },
  { id: 'sp-2', name: 'Nike Store', distance: '750 m away', offer: '20% OFF', emoji: '👟' },
  { id: 'sp-3', name: 'Starbucks', distance: '550 m away', offer: '15% OFF', emoji: '☕' },
  { id: 'sp-4', name: 'Lenovo Official', distance: '800 m away', offer: '10% OFF', emoji: '💻' }
]

export const MOCK_CATEGORIES = [
  { key: 'food', label: 'Food & Beverages', emoji: '🍔' },
  { key: 'fashion', label: 'Fashion & Lifestyle', emoji: '👕' },
  { key: 'electronics', label: 'Electronics', emoji: '💻' },
  { key: 'books', label: 'Books & Stationery', emoji: '📚' },
  { key: 'fitness', label: 'Sports & Fitness', emoji: '🏋️' }
]

export const MOCK_CAMPUS = 'Thakur College of Science & Commerce'
export const MOCK_STUDENT_NAME = 'Kabir'

export const MOCK_CAMPAIGN_PERFORMANCE = {
  spent: 2450,
  impressions: '18.4K',
  clicks: 1284,
  ctr: '7.1%'
}

export const MOCK_CAMPAIGNS = [
  { id: 'camp-1', name: 'Campus Coffee Offer', progress: 78 },
  { id: 'camp-2', name: 'Freshers Combo', progress: 52 }
]

export const MOCK_PRODUCTS_OWNED = [
  { id: 'p-1', name: 'Campus Hoodie', price: 799, views: '1.2K', clicks: 84, emoji: '🧥' },
  { id: 'p-2', name: 'Custom Prints', price: 349, views: '640', clicks: 41, emoji: '🖨️' }
]

export const MOCK_NEARBY_CAMPUSES = ['KJ Somaiya', 'SIES College', 'VJTI', 'Mithibai College']
