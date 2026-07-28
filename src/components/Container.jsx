export default function Container({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-content container-px ${className}`}>{children}</div>
}