export default function OverlayModal({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = 'max-w-md',
}) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClassName} rounded-t-2xl border border-slate-700 bg-slate-900 p-5 sm:rounded-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-bold text-slate-100">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-200"
          >
            Cancel
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
