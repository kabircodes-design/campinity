import { Mail, MessageCircle, Send as TelegramIcon, Share2 } from 'lucide-react'
import { getCanonicalUrl } from './shareTypes.js'

/**
 * Native Web Share API where available (this covers Instagram,
 * Facebook, X, and everything else that registers as a native share
 * target on the device — the OS share sheet handles per-app behavior,
 * not this code). Explicit fallback buttons only for the apps that
 * actually have a public, unauthenticated web share URL scheme:
 * WhatsApp (wa.me), Telegram (t.me/share), and email (mailto).
 *
 * Honest limitation, not faked: Instagram, Facebook, and X do NOT
 * have a public web URL that opens their share composer with
 * pre-filled content — that capability only exists through their
 * native app SDKs or the OS share sheet (which Web Share API already
 * covers on supporting devices). Building a fake "Share to Instagram"
 * button that just opens instagram.com would be worse than not having
 * one — it wouldn't do what it claims. Devices without Web Share API
 * support (most desktop browsers) get the real fallback list below,
 * not a promise this code can't keep.
 */
export default function ExternalShareRow({ referenceType, referenceId, preview }) {
  const path = getCanonicalUrl(referenceType, referenceId)
  const url = path ? `${window.location.origin}${path}` : window.location.href
  const shareText = preview?.title || 'Check this out on Campinity'

  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: shareText, url })
    } catch {
      // User cancelled, or the share failed for another reason —
      // either way, not an error to surface; the fallback row below
      // is always visible for devices without native share support.
    }
  }

  const externalLinks = [
    { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}` },
    { key: 'telegram', label: 'Telegram', Icon: TelegramIcon, href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}` },
    { key: 'email', label: 'Email', Icon: Mail, href: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(url)}` }
  ]

  return (
    <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto scroll-hidden">
      {canUseNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 transition-all duration-200"
        >
          <Share2 className="w-3.5 h-3.5" />
          More
        </button>
      )}
      {externalLinks.map(({ key, label, Icon, href }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 transition-all duration-200"
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </a>
      ))}
    </div>
  )
}
