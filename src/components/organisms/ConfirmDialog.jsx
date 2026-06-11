import BaseModal from './BaseModal'

const TONE_CLASSES = {
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-500',
  amber: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
  red: 'bg-red-600 text-white hover:bg-red-500',
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'emerald',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmClasses = TONE_CLASSES[tone] || TONE_CLASSES.emerald

  return (
    <BaseModal
      open={open}
      onClose={onCancel}
      variant="center"
      closeOnBackdrop
      wrapperClassName="flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6"
      contentClassName="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5"
    >
      <p className="text-base font-bold text-slate-100">{title}</p>
      {message ? <p className="mt-2 text-sm text-slate-400">{message}</p> : null}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`rounded-md px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${confirmClasses}`}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </BaseModal>
  )
}
