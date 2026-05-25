export default function IconAvatar({ src, alt = '', sizeClassName = 'h-7 w-7', className = '' }) {
  if (!src) {
    return <div className={`${sizeClassName} rounded bg-slate-700 ${className}`.trim()} />
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClassName} rounded bg-white object-contain p-1 ${className}`.trim()}
    />
  )
}
