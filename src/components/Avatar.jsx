const sizes = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-2xl'
  }
  
  export default function Avatar({ initials, colorClass = 'from-blue-500 to-blue-600', size = 'md' }) {
    return (
      <div
        className={`flex-shrink-0 rounded-full bg-gradient-to-br ${colorClass} ${sizes[size]} flex items-center justify-center text-white font-semibold select-none`}
      >
        {initials}
      </div>
    )
  }