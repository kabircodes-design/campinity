/**
 * Used for every section without a confirmed real backend service in
 * this pass — Photo Verification, College Requests, User
 * Verification, Moderation, Lost & Found, Marketplace, Notifications,
 * Audit Log. Honest per explicit instruction: "if something genuinely
 * isn't implemented in the backend yet, show Coming Soon instead of
 * pretending it works." These aren't necessarily unbuilt in the real
 * project — I don't have their service files in this sandbox to
 * build against safely without inventing field names.
 */
export default function AdminComingSoon({ title }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <div className="mt-10 flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-semibold text-gray-900">Coming Soon</p>
        <p className="mt-1 text-sm text-gray-400 max-w-[280px]">
          This section isn't wired up in the admin panel yet.
        </p>
      </div>
    </div>
  )
}
