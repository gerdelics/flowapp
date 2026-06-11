import { formatDistanceToNow } from 'date-fns'
import BaseModal from './BaseModal'

function formatLastAlive(isoTimestamp) {
  if (!isoTimestamp) {
    return 'unknown'
  }
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) {
    return 'unknown'
  }
  return `${formatDistanceToNow(date)} ago`
}

export default function CrashRecoveryModal({
  open,
  meta,
  busy = false,
  onResume,
  onFinalize,
  onDiscard,
}) {
  const name = meta?.name || 'Untitled session'
  const pointCount = Number.isFinite(meta?.pointCount) ? meta.pointCount : 0

  return (
    <BaseModal
      open={open}
      closeOnBackdrop={false}
      variant="center"
      wrapperClassName="flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6"
      contentClassName="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5"
    >
      <p className="text-base font-bold text-slate-100">Recording was interrupted</p>
      <p className="mt-2 text-sm text-slate-400">
        A recording session was still active when the app last closed. It has been
        paused so no bad points are recorded — choose how to continue.
      </p>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm">
        <p className="font-semibold text-slate-100">{name}</p>
        <p className="mt-1 text-xs text-slate-500">
          Last alive {formatLastAlive(meta?.lastHeartbeatAt)} · {pointCount} point
          {pointCount === 1 ? '' : 's'} recorded
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onResume}
          disabled={busy}
          className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          Resume recording
        </button>
        <button
          type="button"
          onClick={onFinalize}
          disabled={busy}
          className="w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          Finish &amp; save
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={busy}
          className="w-full rounded-md border border-red-700/60 bg-red-950/40 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-950/70 disabled:opacity-50"
        >
          Discard
        </button>
      </div>
    </BaseModal>
  )
}
