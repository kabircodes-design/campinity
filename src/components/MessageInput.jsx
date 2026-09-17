import { useEffect, useRef, useState } from 'react'
import { CornerUpLeft, FileText, Mic, Paperclip, Send, Trash2, X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { uploadChatFile, uploadChatImage, uploadChatVoice } from '../firebase/chatService.js'
import { useTypingBroadcast } from '../hooks/useTypingIndicator.js'

const MAX_RECORDING_SECONDS = 120 // generous for a chat voice note, not unbounded
const MIN_RECORDING_SECONDS = 1 // below this, a tap is almost certainly accidental — discard, don't send a near-silent blip

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return ''
}

const WAV_SAMPLE_RATE = 16000 // enough for clear speech, keeps voice-note files small

/**
 * ROOT CAUSE (confirmed after the first "seek hack" attempt made things
 * worse, not better): MediaRecorder's raw WebM/Opus output is a live-
 * stream container — no Cues (seek index), no resolved Segment Duration
 * — a well-documented Chromium limitation, not something this app's
 * upload path got wrong. Forcing a `currentTime` seek past the file's
 * real content (the previous fix) could push an un-indexed file into a
 * genuine decode error instead of just leaving it silently stuck, which
 * is why that attempt made the retry state appear MORE, not less.
 *
 * The actual fix belongs at the recording layer, not playback: decode
 * whatever MediaRecorder produced (webm/opus on Chrome, mp4/aac on
 * Safari — decodeAudioData handles either) and re-encode it as a plain
 * PCM WAV before upload. WAV has no streaming-container ambiguity — the
 * header is written complete and correct in one shot — so every browser
 * that can play <audio> at all can play it back with zero hacks. Uses
 * only the standard Web Audio API already available in every browser
 * this app supports; no new dependency, no server-side transcoding.
 *
 * If conversion fails for any reason (very old browser, decode error),
 * falls back to uploading the raw recorder output rather than blocking
 * the send entirely — a rare edge case still handled gracefully by
 * VoiceMessagePlayer's error/retry state, not a crash.
 */
async function convertRecordingToWav(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) throw new Error('Web Audio API not available')

  const arrayBuffer = await blob.arrayBuffer()
  const decodeCtx = new AudioCtx()
  let decoded
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer)
  } finally {
    decodeCtx.close?.().catch?.(() => {})
  }

  const frameCount = Math.max(1, Math.ceil(decoded.duration * WAV_SAMPLE_RATE))
  const offlineCtx = new OfflineAudioContext(1, frameCount, WAV_SAMPLE_RATE)
  const source = offlineCtx.createBufferSource()
  source.buffer = decoded
  source.connect(offlineCtx.destination)
  source.start()
  const rendered = await offlineCtx.startRendering()

  return encodeWavBlob(rendered.getChannelData(0), WAV_SAMPLE_RATE)
}

function encodeWavBlob(samples, sampleRate) {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true) // byte rate
  view.setUint16(32, bytesPerSample, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

// At minimum: JPG/JPEG/PNG/WEBP/GIF images (previewed inline) and PDF
// documents (shown as a file card) — the two categories this app's
// Storage/rendering path actually supports end to end.
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB — generous for a campus chat attachment, not unbounded

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Props match ChatPage.jsx's usage: <MessageInput onSend={sendMessage}
 * disabled={sending} chatId={chatId} />. Two attachment kinds now:
 * images (existing uploadChatImage path, previewed as a thumbnail) and
 * generic files/PDFs (new uploadChatFile path, previewed as a file
 * card) — both go through the same sendMessage() call, just with
 * different `options`.
 */
export default function MessageInput({ onSend, disabled, chatId, replyingTo, onCancelReply }) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState(null) // { file, kind: 'image' | 'file', previewUrl? }
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordingStreamRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const { notifyTyping, stopTyping } = useTypingBroadcast(chatId, auth.currentUser?.uid)

  // Recording is real-time state, not something that should survive an
  // unmount mid-tap (leaving to another chat, or the composer
  // disappearing) — stop the mic track and clear the interval exactly
  // like teardown() does for calls, so nothing keeps the microphone
  // indicator lit after the user has left.
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current)
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // Denormalized snapshot only — matches sendMessage()'s own expected
  // shape (chatService.js builds the actual stored replyTo from these
  // same 4 fields), never a live reference to the original doc.
  const replyToPayload = replyingTo
    ? { messageId: replyingTo.id, senderId: replyingTo.senderId, text: replyingTo.text, type: replyingTo.type || 'text' }
    : null

  const handleSend = async () => {
    if (disabled || uploading) return
    if (!text.trim() && !attachment) return
    stopTyping() // covers "message is sent" — cleared before the async send/upload work below, not after

    if (attachment) {
      const uid = auth.currentUser?.uid
      if (!uid || !chatId) return
      setUploading(true)
      setUploadError('')
      try {
        if (attachment.kind === 'image') {
          const imageUrl = await uploadChatImage(chatId, uid, attachment.file)
          onSend(text.trim(), { type: 'image', imageUrl, replyTo: replyToPayload })
        } else {
          const uploaded = await uploadChatFile(chatId, uid, attachment.file)
          onSend(text.trim(), {
            type: 'file',
            fileUrl: uploaded.url,
            fileName: uploaded.name,
            fileSize: uploaded.size,
            mimeType: uploaded.mimeType,
            replyTo: replyToPayload
          })
        }
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
        setAttachment(null)
        setText('')
        onCancelReply?.()
      } catch (err) {
        setUploadError(err?.message || "Couldn't send attachment. Try again.")
        setUploading(false)
        return
      }
      setUploading(false)
      return
    }

    onSend(text.trim(), { replyTo: replyToPayload })
    setText('')
    onCancelReply?.()
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleAttach = (event) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setUploadError('')

    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`That file is too large (max ${formatFileSize(MAX_FILE_BYTES)}).`)
      return
    }
    const isImage = file.type.startsWith('image/')
    if (!isImage && file.type !== 'application/pdf') {
      setUploadError('Unsupported file type. Images (JPG/PNG/WEBP/GIF) and PDFs only.')
      return
    }

    setAttachment({ file, kind: isImage ? 'image' : 'file', previewUrl: isImage ? URL.createObjectURL(file) : null })
  }

  const clearAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    setAttachment(null)
    setUploadError('')
  }

  const stopRecordingStream = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop())
    recordingStreamRef.current = null
  }

  const startRecording = async () => {
    if (disabled || uploading || recording) return
    setUploadError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordingStreamRef.current = stream
      const mimeType = pickRecorderMimeType()
      if (mimeType === null) {
        stream.getTracks().forEach((t) => t.stop())
        setUploadError('Voice messages are not supported on this browser.')
        return
      }
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recordedChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => {
          if (s + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording(true)
            return s
          }
          return s + 1
        })
      }, 1000)
    } catch (err) {
      setUploadError(err?.name === 'NotAllowedError' ? 'Microphone access was denied.' : 'Could not access the microphone.')
    }
  }

  // stopRecording is called both by the user (tap send/cancel) and by
  // the MAX_RECORDING_SECONDS auto-stop above — `send` decides whether
  // the recorded blob becomes a real message or is just discarded.
  const stopRecording = (send) => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    const durationAtStop = recordingSeconds
    recorder.onstop = () => {
      stopRecordingStream()
      const shouldSend = send && durationAtStop >= MIN_RECORDING_SECONDS && recordedChunksRef.current.length > 0
      if (shouldSend) {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        sendVoiceMessage(blob, recorder.mimeType, durationAtStop)
      }
      recordedChunksRef.current = []
      mediaRecorderRef.current = null
      setRecording(false)
      setRecordingSeconds(0)
    }
    recorder.stop()
  }

  const sendVoiceMessage = async (rawBlob, rawMimeType, durationSec) => {
    const uid = auth.currentUser?.uid
    if (!uid || !chatId) return
    stopTyping()
    setUploading(true)
    setUploadError('')
    try {
      let uploadBlob = rawBlob
      let uploadMimeType = rawMimeType
      try {
        uploadBlob = await convertRecordingToWav(rawBlob)
        uploadMimeType = 'audio/wav'
      } catch (err) {
        // Falls back to the original recorder output — still send
        // something rather than block the user entirely. Logged only in
        // DEV; never surfaced to the sender as an error.
        if (import.meta.env.DEV) console.warn('[voice message] WAV conversion failed, uploading raw recording:', err)
      }
      const fileUrl = await uploadChatVoice(chatId, uid, uploadBlob, uploadMimeType)
      onSend('', { type: 'voice', fileUrl, durationSec, replyTo: replyToPayload })
      onCancelReply?.()
    } catch {
      setUploadError("Couldn't send voice message. Try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleChange = (event) => {
    const value = event.target.value
    setText(value)
    if (value.trim()) {
      notifyTyping()
    } else {
      stopTyping() // covers "composer becomes empty"
    }
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    handleAttach({ target: { files: [file], value: '' } })
  }

  return (
    <div
      className="px-3 py-2.5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {replyingTo && (
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 pl-2.5 pr-1.5 py-1.5 mb-2 [animation:fadeIn_150ms_ease-out]">
          <CornerUpLeft className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-blue-600">Replying to {replyingTo.senderId === auth.currentUser?.uid ? 'yourself' : 'this message'}</p>
            <p className="text-xs text-gray-500 truncate">
              {replyingTo.text || (replyingTo.type === 'image' ? 'Photo' : replyingTo.type === 'voice' ? 'Voice message' : 'Attachment')}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {attachment && (
        <div className="mb-2">
          {attachment.kind === 'image' ? (
            <div className="relative inline-block">
              <img src={attachment.previewUrl} alt="Attachment preview" className="h-20 rounded-lg object-cover" />
              <button
                type="button"
                onClick={clearAttachment}
                aria-label="Remove attachment"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="relative inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 pr-8">
              <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate max-w-[160px]">{attachment.file.name}</p>
                <p className="text-[10px] text-gray-400">{formatFileSize(attachment.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={clearAttachment}
                aria-label="Remove attachment"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
      {uploadError && <p className="mb-1.5 text-xs text-red-500">{uploadError}</p>}
      {recording ? (
        // Recording is its own row, not a state layered onto the normal
        // composer — the textarea/attach button are irrelevant mid-
        // recording (you can't type and record at once), so replacing
        // them outright avoids a cramped, half-disabled-looking bar.
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stopRecording(false)}
            aria-label="Cancel recording"
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all duration-200"
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
          <div className="flex-1 flex items-center gap-2 rounded-[20px] border border-red-200 bg-red-50 px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium text-red-600 tabular-nums">{formatDuration(recordingSeconds)}</span>
            <span className="text-xs text-red-400">Recording…</span>
          </div>
          <button
            type="button"
            onClick={() => stopRecording(true)}
            aria-label="Send voice message"
            title="Send"
            className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all duration-200"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            aria-label="Attach a photo or file"
            title="Attach a photo or file"
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-40 transition-all duration-200"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>
          <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={handleAttach} className="sr-only" />

          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || uploading}
            placeholder={attachment ? 'Add a caption...' : 'Type a message...'}
            aria-label="Message"
            className="flex-1 resize-none rounded-[20px] border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
          />
          {/* No text, no attachment → mic (tap to record). Either one
              present → send. Matches the spec exactly: the trailing
              button is never both/neither. */}
          {!text.trim() && !attachment ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled || uploading}
              aria-label="Record a voice message"
              title="Record a voice message"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Mic className="w-4.5 h-4.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || uploading}
              aria-label="Send message"
              title="Send"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {uploading ? (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
