export default function BaseModal({
  open,
  onClose,
  children,
  variant = 'center',
  closeOnBackdrop = true,
  backdropClassName,
  wrapperClassName,
  contentClassName,
  zIndexClassName = 'z-[2000]',
}) {
  if (!open) {
    return null
  }

  const isFullscreen = variant === 'fullscreen'
  const backdropClasses = backdropClassName || (isFullscreen ? 'bg-slate-950' : 'bg-black/60')
  const wrapperClasses =
    wrapperClassName ||
    (isFullscreen ? 'flex h-full w-full flex-col' : 'flex min-h-full items-end justify-center sm:items-center')

  function handleBackdropClick() {
    if (closeOnBackdrop) {
      onClose?.()
    }
  }

  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} ${backdropClasses}`.trim()}
      onClick={handleBackdropClick}
    >
      <div className={wrapperClasses}>
        <div
          className={contentClassName || ''}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
