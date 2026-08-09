export default function GlassCard({ children, as: Tag = 'div', className = '', ...props }) {
  return (
    <Tag className={`chp-glass ${className}`.trim()} {...props}>
      {children}
    </Tag>
  )
}
