import { useCallback, useRef, useState } from 'react'

/**
 * Minimal, dependency-free crop editor — no package.json visibility
 * confirmed a cropper library either exists or doesn't in this
 * project, and adding a new dependency for one feature isn't
 * justified when a reliable result is achievable with plain
 * React + Canvas. Drag-to-pan, slider-to-zoom, circular preview mask,
 * canvas-based export to a real cropped Blob at a fixed output size
 * (image optimization: consistent max resolution regardless of the
 * source photo's dimensions).
 */
const OUTPUT_SIZE = 512 // fixed output resolution — avoids uploading unnecessarily huge originals

export default function ImageCropper({ imageUrl, onCancel, onSave }) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragState = useRef(null)
  const [exporting, setExporting] = useState(false)

  const handlePointerDown = (e) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, offset }
  }

  const handlePointerMove = useCallback((e) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setOffset({ x: dragState.current.offset.x + dx, y: dragState.current.offset.y + dy })
  }, [])

  const handlePointerUp = () => {
    dragState.current = null
  }

  const handleReset = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  const handleSave = () => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container) return
    if (!img.naturalWidth || !img.naturalHeight) {
      console.error('Crop export failed: image not yet decoded (naturalWidth/naturalHeight is 0)')
      return
    }
    setExporting(true)

    try {
      const frameSize = container.clientWidth // the square visible crop frame
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')

      // Natural rendered size of the image at the current zoom, matching
      // exactly what the user sees in the preview frame.
      const renderedWidth = img.naturalWidth * (frameSize / Math.min(img.naturalWidth, img.naturalHeight)) * zoom
      const renderedHeight = img.naturalHeight * (frameSize / Math.min(img.naturalWidth, img.naturalHeight)) * zoom

      const scale = OUTPUT_SIZE / frameSize
      const drawWidth = renderedWidth * scale
      const drawHeight = renderedHeight * scale
      const drawX = (OUTPUT_SIZE - drawWidth) / 2 + offset.x * scale
      const drawY = (OUTPUT_SIZE - drawHeight) / 2 + offset.y * scale

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

      canvas.toBlob(
        (blob) => {
          setExporting(false)
          if (blob) {
            onSave(blob)
          } else {
            console.error('Crop export failed: canvas.toBlob returned null')
          }
        },
        'image/jpeg',
        0.9
      )
    } catch (err) {
      console.error('Crop export failed:', err)
      setExporting(false)
    }
  }

  return (
    <div className="w-full max-w-xs mx-auto">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-900 cursor-grab active:cursor-grabbing touch-none"
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: `${zoom * 100}%`,
            height: `${zoom * 100}%`,
            objectFit: 'cover',
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`
          }}
        />
        {/* Circular preview mask — visual guide only, final crop stays square per spec's 'square crop, circular preview' */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', borderRadius: '50%', margin: '4%' }}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-gray-400">Zoom</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-blue-600"
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2.5 hover:border-gray-300 transition-all duration-300"
        >
          Reset
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2.5 hover:border-gray-300 transition-all duration-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={exporting}
          className="rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 disabled:opacity-60 transition-all duration-300"
        >
          {exporting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
