import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, PartyPopper } from 'lucide-react'
import { MOCK_CAMPUS, MOCK_NEARBY_CAMPUSES } from './mockAdsData.js'

/**
 * PROTOTYPE ONLY — entirely React state, nothing persisted anywhere.
 * "Publish" shows a success toast/modal per the explicit spec and
 * returns to the dashboard — it does not create anything real.
 */
const OBJECTIVES = ['Product Sales', 'Store Visits', 'Offer Redemption', 'Event Promotion']
const RADII = ['1 km', '3 km', '5 km']
const STEPS = ['objective', 'creative', 'details', 'target', 'budget', 'preview']

export default function CreateCampaignPage() {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [published, setPublished] = useState(false)

  const [objective, setObjective] = useState('')
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')
  const [radius, setRadius] = useState('3 km')
  const [budget, setBudget] = useState(500)

  const step = STEPS[stepIndex]
  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  const back = () => (stepIndex === 0 ? navigate('/ads/dashboard') : setStepIndex((i) => i - 1))

  if (published) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <PartyPopper className="w-7 h-7 text-green-600" />
          </div>
          <p className="mt-4 text-lg font-bold text-gray-900">Campaign created successfully 🎉</p>
          <p className="mt-1 text-sm text-gray-400">(Prototype only — nothing was actually saved.)</p>
          <button
            type="button"
            onClick={() => navigate('/ads/dashboard')}
            className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[560px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={back} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Create Campaign</span>
          </div>
          <div className="flex gap-1 px-4 pb-2">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-blue-600' : 'bg-gray-100'}`} />
            ))}
          </div>
        </header>

        <div className="p-4">
          {step === 'objective' && (
            <div>
              <p className="text-sm font-bold text-gray-900 mb-3">Choose objective</p>
              <div className="space-y-2">
                {OBJECTIVES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setObjective(o)}
                    className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all duration-200 ${
                      objective === o ? 'border-blue-500 bg-blue-50' : 'border-gray-100'
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-900">{o}</span>
                    {objective === o && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'creative' && (
            <div>
              <p className="text-sm font-bold text-gray-900 mb-3">Choose creative</p>
              <div className="aspect-video rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                <p className="text-sm text-gray-400">Upload Image (prototype)</p>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-900">Campaign details</p>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Headline — e.g. Freshers Collection"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Description"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-300 resize-none"
              />
            </div>
          )}

          {step === 'target' && (
            <div>
              <p className="text-sm font-bold text-gray-900 mb-3">Target campus</p>
              <div className="rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{MOCK_CAMPUS}</span>
                <Check className="w-4 h-4 text-blue-600" />
              </div>
              <p className="mt-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nearby</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {MOCK_NEARBY_CAMPUSES.map((c) => (
                  <span key={c} className="rounded-full bg-gray-100 text-gray-500 text-xs font-medium px-3 py-1.5">{c}</span>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Radius</p>
              <div className="flex gap-2 mt-2">
                {RADII.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadius(r)}
                    className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                      radius === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'budget' && (
            <div>
              <p className="text-sm font-bold text-gray-900 mb-3">Budget</p>
              <p className="text-2xl font-bold text-gray-900">₹{budget}<span className="text-sm font-normal text-gray-400">/day</span></p>
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full mt-4 accent-blue-600"
              />
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p className="text-sm font-bold text-gray-900 mb-3">Campaign preview</p>
              <div className="rounded-2xl border border-gray-100 p-4">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Sponsored · {MOCK_CAMPUS}</span>
                <div className="mt-2 aspect-video rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-3xl">📢</div>
                <p className="mt-2 text-sm font-bold text-gray-900">{headline || 'Your headline here'}</p>
                <p className="text-xs text-gray-500">{description || 'Your description here'}</p>
                <button type="button" className="mt-3 w-full rounded-full bg-blue-600 text-white text-xs font-semibold py-2">
                  {objective === 'Store Visits' ? 'Visit Store' : objective === 'Offer Redemption' ? 'Get Offer' : 'Shop Now'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={() => (step === 'preview' ? setPublished(true) : next())}
            className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 transition-all duration-300"
          >
            {step === 'preview' ? 'Publish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
