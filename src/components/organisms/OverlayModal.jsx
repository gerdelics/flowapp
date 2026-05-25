import BaseModal from './BaseModal'

export default function OverlayModal({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = 'max-w-md',
}) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      variant="center"
      closeOnBackdrop
      wrapperClassName="flex min-h-full items-end justify-center sm:items-center"
      contentClassName={`w-full ${maxWidthClassName} rounded-t-2xl border border-slate-700 bg-slate-900 p-5 sm:rounded-2xl`}
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
    </BaseModal>
  )
}
