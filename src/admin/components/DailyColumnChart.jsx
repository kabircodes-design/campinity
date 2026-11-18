import { useMemo, useState } from 'react'
import { Table2, BarChart3 } from 'lucide-react'

/**
 * Single-series daily column chart (small multiples on the Overview).
 * - One series per chart, so no legend: the card title names it.
 * - Columns: brand accent (#1677ff, validated against the light #ffffff
 *   and dark #11131a surfaces), <= 24px wide, 4px rounded data-end,
 *   square at the baseline, 2px surface gap between neighbours.
 * - Recessive grid (3 ticks, clean numbers), text in text tokens only.
 * - Hover / keyboard focus => per-column tooltip (date + exact count).
 * - Days that couldn't be measured (null) render as an empty slot, never 0.
 * - "Table" toggle gives the exact numbers.
 */
const W = 360
const H = 150
const PAD = { top: 10, right: 4, bottom: 22, left: 30 }

function niceMax(v) {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v))
  const steps = [1, 2, 2.5, 5, 10]
  for (const s of steps) if (s * pow >= v) return s * pow
  return 10 * pow
}

const dayLabel = (ms, opts = { day: 'numeric', month: 'short' }) => new Date(ms).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })

export default function DailyColumnChart({ title, data, unit = 'per day' }) {
  const [hover, setHover] = useState(null)
  const [asTable, setAsTable] = useState(false)
  const values = data.map((d) => d.count)
  const known = values.filter((v) => typeof v === 'number')
  const total30 = known.length ? known.reduce((s, v) => s + v, 0) : null
  const total7 = data.slice(-7).every((d) => typeof d.count === 'number') ? data.slice(-7).reduce((s, d) => s + d.count, 0) : null
  const max = niceMax(Math.max(0, ...known))
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const slot = plotW / Math.max(data.length, 1)
  const barW = Math.min(24, Math.max(2, slot - 2))
  const ticks = [0, max / 2, max]
  const y = (v) => PAD.top + plotH - (v / max) * plotH

  const bars = useMemo(
    () =>
      data.map((d, i) => {
        const x = PAD.left + i * slot + (slot - barW) / 2
        if (typeof d.count !== 'number' || d.count === 0) return { x, h: 0, d, i }
        const h = Math.max(2, plotH - (y(d.count) - PAD.top))
        return { x, h, d, i }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, slot, barW, plotH, max]
  )

  const tip = hover !== null ? bars[hover] : null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-gray-900">{title}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {total30 !== null ? <><span className="font-semibold text-gray-900 tabular-nums">{total30.toLocaleString('en-IN')}</span> in 30 days</> : 'Partly unavailable'}
            {total7 !== null && <> · <span className="font-semibold text-gray-900 tabular-nums">{total7.toLocaleString('en-IN')}</span> in 7 days</>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          aria-label={asTable ? 'Show as chart' : 'Show as table'}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"
        >
          {asTable ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
        </button>
      </div>

      {asTable ? (
        <div className="mt-3 max-h-[188px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-medium py-1">Day (UTC)</th>
                <th className="text-right font-medium py-1">{title}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.dayStartMs} className="border-t border-gray-100">
                  <td className="py-1 text-gray-700">{dayLabel(d.dayStartMs, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className="py-1 text-right tabular-nums text-gray-900">{typeof d.count === 'number' ? d.count : 'n/a'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}, daily counts for the last ${data.length} days. ${total30 ?? 'Unknown'} total.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--theme-divider)" strokeWidth="1" />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fill="var(--theme-muted)" fontSize="10.5">
                  {Number.isInteger(t) ? t.toLocaleString('en-IN') : t.toFixed(1)}
                </text>
              </g>
            ))}
            {bars.map(({ x, h, d, i }) => {
              const top = PAD.top + plotH - h
              const r = Math.min(4, barW / 2, h)
              return (
                <g key={d.dayStartMs}>
                  {h > 0 && (
                    <path
                      d={`M${x},${PAD.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD.top + plotH} Z`}
                      fill="#1677ff"
                      opacity={hover === null || hover === i ? 1 : 0.45}
                    />
                  )}
                  {typeof d.count !== 'number' && (
                    <line x1={x} x2={x + barW} y1={PAD.top + plotH - 1} y2={PAD.top + plotH - 1} stroke="var(--theme-muted)" strokeDasharray="2 2" />
                  )}
                  {/* hit target larger than the mark */}
                  <rect
                    x={PAD.left + i * slot}
                    y={PAD.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${dayLabel(d.dayStartMs)}: ${typeof d.count === 'number' ? d.count : 'not available'}`}
                  />
                </g>
              )
            })}
            <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--theme-border)" strokeWidth="1" />
            {[0, Math.floor(data.length / 2), data.length - 1].map((i) =>
              data[i] ? (
                <text key={i} x={i === 0 ? PAD.left : i === data.length - 1 ? W - PAD.right : PAD.left + i * slot + slot / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fill="var(--theme-muted)" fontSize="10.5">
                  {dayLabel(data[i].dayStartMs)}
                </text>
              ) : null
            )}
          </svg>
          {tip && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap"
              style={{ left: `${((tip.x + barW / 2) / W) * 100}%`, top: `${((PAD.top + plotH - tip.h - 6) / H) * 100}%`, background: 'var(--theme-textPrimary)', color: 'var(--theme-surface)' }}
            >
              <span className="font-semibold">{typeof tip.d.count === 'number' ? tip.d.count.toLocaleString('en-IN') : 'n/a'}</span> {unit}
              <span style={{ opacity: 0.7 }}> · {dayLabel(tip.d.dayStartMs, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
