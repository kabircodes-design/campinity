import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Megaphone, Package, Plus, TrendingUp } from 'lucide-react'
import { MOCK_CAMPAIGN_PERFORMANCE, MOCK_CAMPAIGNS, MOCK_PRODUCTS_OWNED } from './mockAdsData.js'

/**
 * PROTOTYPE ONLY — advertiser dashboard mockup, dummy data from
 * mockAdsData.js, no backend. "Create Campaign" opens the frontend-
 * only wizard prototype; nothing here is ever saved anywhere.
 */
export default function AdsDashboardPage() {
  const navigate = useNavigate()
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2000)
  }

  const stats = [
    { label: 'Spent', value: `₹${MOCK_CAMPAIGN_PERFORMANCE.spent.toLocaleString('en-IN')}` },
    { label: 'Impressions', value: MOCK_CAMPAIGN_PERFORMANCE.impressions },
    { label: 'Clicks', value: MOCK_CAMPAIGN_PERFORMANCE.clicks.toLocaleString('en-IN') },
    { label: 'CTR', value: MOCK_CAMPAIGN_PERFORMANCE.ctr }
  ]

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[720px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={() => navigate('/ads')} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Advertiser Dashboard</span>
          </div>
        </header>

        <div className="p-4">
          <p className="text-lg font-bold text-gray-900">Good morning, Campus Cafe 👋</p>
          <p className="text-sm text-gray-400">Your campaigns are performing well.</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-100 p-3.5">
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                <Megaphone className="w-4 h-4 text-indigo-500" /> Active Campaigns
              </p>
              <button
                type="button"
                onClick={() => navigate('/ads/create-campaign')}
                className="flex items-center gap-1 rounded-full bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-blue-700 transition-all duration-200"
              >
                <Plus className="w-3.5 h-3.5" /> Create
              </button>
            </div>
            <div className="space-y-2.5">
              {MOCK_CAMPAIGNS.map((c) => (
                <div key={c.id} className="rounded-xl border border-gray-100 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <span className="text-xs text-gray-400">{c.progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${c.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
              <Package className="w-4 h-4 text-indigo-500" /> Your Products
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MOCK_PRODUCTS_OWNED.map((p) => (
                <div key={p.id} className="rounded-2xl border border-gray-100 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">{p.emoji}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-sm font-bold text-blue-600">₹{p.price}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{p.views} views</span>
                    <span>{p.clicks} clicks</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button type="button" onClick={() => showToast('Prototype only')} className="flex-1 rounded-full border border-gray-200 text-gray-700 text-xs font-semibold py-1.5 hover:border-gray-300 transition-all duration-200">
                      Edit
                    </button>
                    <button type="button" onClick={() => showToast('Prototype only')} className="flex-1 rounded-full bg-blue-600 text-white text-xs font-semibold py-1.5 hover:bg-blue-700 transition-all duration-200">
                      Promote
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-100 p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> Top Campus
            </p>
            <p className="text-sm text-gray-700">Thakur College</p>
            <p className="text-xs text-gray-400">2.8K impressions</p>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] rounded-full bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
