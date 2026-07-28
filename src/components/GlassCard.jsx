/**
 * Reusable glassmorphism surface — backdrop-blur, soft border, premium
 * shadow. `as` lets it render as a <div>, <button>, or any element
 * (e.g. a semantic wrapper) without duplicating the glass styling.
 */
export default function GlassCard({ children, as: Tag = 'div', className = '', ...props }) {
  return (
    <Tag className={`chp-glass ${className}`.trim()} {...props}>
      {children}
    </Tag>
  )
}