import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Camera, RotateCcw, Check, Upload, Users } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { updateUserProfile } from '../firebase/profileService.js'
import { AVATAR_STYLES, generateCampusAvatar } from './avatarProvider.js'
import { uploadCampusAvatar } from './avatarStorage.js'

/**
 * Full multi-step flow: intro -> camera -> confirm selfie -> style
 * select -> processing -> preview -> saved. Portal-based from the
 * start (the SwipeablePage transform lesson, applied consistently
 * throughout this project since it was first found).
 *
 * Camera handling covers every state the brief lists: permission
 * granted/denied/unsupported, user closes camera, retake, and an
 * explicit "upload a selfie instead" fallback for when the camera
 * genuinely isn't usable — matching "no blank screens, no infinite
 * spinners, every async operation needs loading/success/error/retry."
 */
export default function CampusAvatarFlow({ open, onClose, onSaved }) {
  const [step, setStep] = useState('intro') // intro | camera | confirm | style | processing | preview | error
  const [cameraStatus, setCameraStatus] = useState('idle') // idle | requesting | granted | denied | unsupported | error
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [capturedUrl, setCapturedUrl] = useState('')
  const [selectedStyle, setSelectedStyle] = useState(AVATAR_STYLES[0].id)
  const [processingMessage, setProcessingMessage] = useState('')
  const [generatedBlob, setGeneratedBlob] = useState(null)
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const startCamera = async () => {
    setCameraStatus('requesting')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraStatus('granted')
    } catch (err) {
      setCameraStatus(err?.name === 'NotAllowedError' ? 'denied' : 'error')
    }
  }

  useEffect(() => {
    if (step === 'camera') startCamera()
    else stopCamera()
    return stopCamera
  }, [step])

  useEffect(() => {
    if (!open) {
      setStep('intro')
      setCameraStatus('idle')
      setCapturedBlob(null)
      setCapturedUrl('')
      setGeneratedBlob(null)
      setGeneratedUrl('')
      setErrorMessage('')
      setSaving(false)
      stopCamera()
    }
  }, [open])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    // Mirror horizontally — front camera preview is typically mirrored, and the captured photo should match what the user saw of themselves.
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        setCapturedUrl(URL.createObjectURL(blob))
        setStep('confirm')
      },
      'image/jpeg',
      0.9
    )
  }

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setCapturedBlob(file)
    setCapturedUrl(URL.createObjectURL(file))
    setStep('confirm')
  }

  const handleRetake = () => {
    setCapturedBlob(null)
    setCapturedUrl('')
    setStep('camera')
  }

  const runGeneration = async () => {
    setStep('processing')
    setErrorMessage('')
    const messages = ['Reading your features…', 'Building your avatar…', 'Adding the Campinity touch…']
    let i = 0
    setProcessingMessage(messages[0])
    const interval = setInterval(() => {
      i = (i + 1) % messages.length
      setProcessingMessage(messages[i])
    }, 1100)

    try {
      const result = await generateCampusAvatar(capturedBlob, selectedStyle)
      clearInterval(interval)
      setGeneratedBlob(result)
      setGeneratedUrl(URL.createObjectURL(result))
      setStep('preview')
    } catch (err) {
      clearInterval(interval)
      setErrorMessage(err?.message || "Couldn't create your avatar.")
      setStep('error')
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setErrorMessage('')
    try {
      const uid = auth.currentUser?.uid
      const url = await uploadCampusAvatar(uid, generatedBlob)
      await updateUserProfile(uid, {
        campusAvatarUrl: url,
        avatarMode: 'avatar',
        campusAvatarUpdatedAt: new Date().toISOString()
      })
      onSaved?.(url)
      onClose()
    } catch (err) {
      setErrorMessage("Avatar created, but we couldn't save it.")
      setSaving(false)
    }
  }

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-white flex flex-col">
        <div className="h-14 flex items-center justify-between px-3 flex-shrink-0">
          <span className="text-base font-bold text-gray-900">Campus Avatar</span>
          <button type="button" aria-label="Close" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 pb-10">
          {step === 'intro' && (
            <div className="text-center max-w-xs">
              <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                <Users className="w-10 h-10 text-white" />
              </div>
              <p className="mt-6 text-xl font-bold text-gray-900">Create your Campus Avatar</p>
              <p className="mt-2 text-sm text-gray-500">Turn a selfie into your Campinity identity.</p>
              <button type="button" onClick={() => setStep('camera')} className="mt-8 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 transition-all duration-300">
                Create Avatar
              </button>
              <button type="button" onClick={onClose} className="mt-2 w-full text-sm font-medium text-gray-400 py-2">
                Maybe Later
              </button>
            </div>
          )}

          {step === 'camera' && (
            <div className="w-full max-w-xs">
              {cameraStatus === 'granted' && (
                <>
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
                    <div className="absolute inset-6 rounded-full border-2 border-white/70 pointer-events-none" />
                  </div>
                  <p className="mt-3 text-center text-xs text-gray-400">Center your face · Good lighting works best</p>
                  <button type="button" onClick={handleCapture} className="mt-4 mx-auto w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-700 transition-all duration-300">
                    <Camera className="w-6 h-6 text-white" />
                  </button>
                </>
              )}
              {cameraStatus === 'requesting' && <p className="text-center text-sm text-gray-400">Requesting camera access…</p>}
              {cameraStatus === 'denied' && (
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">We couldn't access your camera.</p>
                  <p className="mt-1 text-xs text-gray-400">Camera permission was denied. You can allow it in your browser settings, or upload a selfie instead.</p>
                  <button type="button" onClick={startCamera} className="mt-4 w-full rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5">Try Again</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-600 py-2.5">
                    <Upload className="w-4 h-4" /> Upload a Selfie Instead
                  </button>
                </div>
              )}
              {(cameraStatus === 'unsupported' || cameraStatus === 'error') && (
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">Camera unavailable on this device.</p>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5">
                    <Upload className="w-4 h-4" /> Upload a Selfie Instead
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="sr-only" onChange={handleFileUpload} />
            </div>
          )}

          {step === 'confirm' && (
            <div className="w-full max-w-xs text-center">
              <img src={capturedUrl} alt="Your selfie" className="w-full aspect-square rounded-2xl object-cover" />
              <p className="mt-3 text-sm font-semibold text-gray-900">Looks good?</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={handleRetake} className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5">Retake</button>
                <button type="button" onClick={() => setStep('style')} className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5">Continue</button>
              </div>
            </div>
          )}

          {step === 'style' && (
            <div className="w-full max-w-xs">
              <p className="text-center text-sm font-semibold text-gray-900 mb-4">Choose a style</p>
              <div className="space-y-2">
                {AVATAR_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedStyle(style.id)}
                    className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all duration-200 ${selectedStyle === style.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{style.label}</p>
                    <p className="text-xs text-gray-400">{style.description}</p>
                  </button>
                ))}
              </div>
              <button type="button" onClick={runGeneration} className="mt-5 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3">Generate avatar</button>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <p className="mt-5 text-sm font-semibold text-gray-900">Creating your Campus Avatar…</p>
              <p className="mt-1 text-xs text-gray-400">{processingMessage}</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="w-full max-w-xs text-center">
              <p className="text-lg font-bold text-gray-900">Your Campus Avatar</p>
              <img src={generatedUrl} alt="Your Campus Avatar" className="mt-3 w-48 h-48 mx-auto rounded-full object-cover" />
              <p className="mt-3 text-sm text-gray-500">Love it? Looks good as your Campinity identity.</p>
              {errorMessage && <p className="mt-2 text-xs text-red-500">{errorMessage}</p>}
              <button type="button" onClick={handleSave} disabled={saving} className="mt-5 w-full flex items-center justify-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold py-3 disabled:opacity-50">
                {saving ? 'Saving…' : (<><Check className="w-4 h-4" /> Use Avatar</>)}
              </button>
              <button type="button" onClick={() => setStep('style')} disabled={saving} className="mt-2 w-full text-sm font-semibold text-blue-600 py-2 disabled:opacity-50">Regenerate</button>
              <button type="button" onClick={handleRetake} disabled={saving} className="mt-1 w-full flex items-center justify-center gap-1 text-sm font-medium text-gray-400 py-2 disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" /> Retake Selfie
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900">{errorMessage || "Couldn't create your avatar."}</p>
              <button type="button" onClick={runGeneration} className="mt-4 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5">Try Again</button>
              <button type="button" onClick={handleRetake} className="mt-2 w-full text-sm font-semibold text-gray-500 py-2">Retake Selfie</button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
