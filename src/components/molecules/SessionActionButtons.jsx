export default function SessionActionButtons({
  session,
  onOpen,
  onExport,
  onExportJson,
  onDelete,
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onOpen(session.id)}
        className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
      >
        Open
      </button>
      <button
        type="button"
        onClick={() => onExport(session.id)}
        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
      >
        CSV
      </button>
      <button
        type="button"
        onClick={() => onExportJson(session.id)}
        className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold"
      >
        JSON
      </button>
      <button
        type="button"
        onClick={() => onDelete(session.id)}
        className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white"
      >
        Delete
      </button>
    </div>
  )
}
