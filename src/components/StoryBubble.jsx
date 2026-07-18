import { MoreHorizontal, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function StoryBubble({ story }) {
  const navigate = useNavigate()

  if (story.isMore) {
    return (
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[68px]">
        <div className="w-16 h-16 rounded-full border-2 border-gray-200 bg-gray-50 flex items-center justify-center">
          <MoreHorizontal className="w-5 h-5 text-gray-400" />
        </div>
        <span className="text-[11px] text-gray-500 font-medium truncate w-full text-center">{story.label}</span>
      </div>
    )
  }

  const handleClick = () => {
    if (story.isAdd) {
      navigate('/create')
      return
    }
    if (story.username) {
      navigate(`/student/${story.username}`)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[68px]"
    >
      <div
        className={`relative w-16 h-16 rounded-full p-[2.5px] ${
          story.isAdd ? 'border-2 border-dashed border-gray-300' : `bg-gradient-to-tr ${story.ringClass}`
        }`}
      >
        <div className="w-full h-full rounded-full bg-white p-[2px]">
          <div
            className={`w-full h-full rounded-full bg-gradient-to-br ${story.colorClass} flex items-center justify-center text-white text-sm font-semibold`}
          >
            {story.initials}
          </div>
        </div>
        {story.isAdd && (
          <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
            <Plus className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
        )}
      </div>
      <span className="text-[11px] text-gray-600 font-medium truncate w-full text-center">{story.label}</span>
    </button>
  )
}