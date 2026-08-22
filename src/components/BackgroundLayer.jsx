import FloatingIcon from './FloatingIcon.jsx'
import Particles from './Particles.jsx'
import { CAMPUS_ICONS } from './icons/CampusIcons.jsx'

/**
 * Renders whatever element list it's given — has no knowledge of
 * "variant" or "theme", just draws icons + particles. This is what
 * keeps the animation engine reusable: AnimatedBackground.jsx decides
 * WHICH elements to pass based on variant/theme/viewport, this
 * component just renders them.
 */
export default function BackgroundLayer({ elements, particleCount }) {
  return (
    <>
      {elements.map((element, index) => {
        const Icon = CAMPUS_ICONS[element.icon]
        if (!Icon) return null
        return (
          <FloatingIcon
            key={`${element.icon}-${index}`}
            Icon={Icon}
            top={element.top}
            left={element.left}
            size={element.size}
            opacity={element.opacity}
            duration={element.duration}
            delay={element.delay}
            drift={element.drift}
            rotate={element.rotate}
          />
        )
      })}
      <Particles count={particleCount} />
    </>
  )
}