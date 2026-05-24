export default function CountdownTimer({
  enabled,
  autoSecondsLeft,
  manualEnabled,
  manualSecondsLeft,
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-base text-slate-300">
      <p>
        <span className="font-semibold text-slate-100">Auto-record:</span>{' '}
        {enabled ? `next sample in ${autoSecondsLeft}s` : 'off'}
      </p>
      <p className="mt-2">
        <span className="font-semibold text-slate-100">Manual record:</span>{' '}
        {manualEnabled ? `recommended next sample in ${manualSecondsLeft}s` : 'off'}
      </p>
    </div>
  )
}
