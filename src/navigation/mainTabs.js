import { Home, MessageCircle, Orbit, ShoppingBag, User } from 'lucide-react'

/**
 * The app's top-level destinations, in ONE explicit order. BottomNav
 * renders its items from this list and the swipe navigation
 * (useTabSwipe.js) moves along it, so the two can never disagree about
 * what "next tab" means. Create Post is not a tab: it is the nav's
 * central + action (CREATE_POST_PATH).
 */
export const MAIN_TABS = [
  { id: 'home', label: 'Home', icon: Home, to: '/home' },
  { id: 'communities', label: 'Communities', icon: Orbit, to: '/communities' },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, to: '/marketplace' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, to: '/messages' },
  { id: 'profile', label: 'Profile', icon: User, to: '/profile' }
]

export const CREATE_POST_PATH = '/create'

/** Index of the tab whose route is exactly `pathname`, or -1 for any other page. */
export function getMainTabIndex(pathname) {
  return MAIN_TABS.findIndex((tab) => tab.to === pathname)
}

/** The neighbouring tab's path (direction: 1 = next, -1 = previous), or null at either end / off-tab. */
export function getAdjacentTabPath(pathname, direction) {
  const index = getMainTabIndex(pathname)
  if (index === -1) return null
  return MAIN_TABS[index + direction]?.to ?? null
}
