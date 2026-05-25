export default function SessionNameEditor({
  sessionName,
  nameDraft,
  setNameDraft,
  showNameEditor,
  setShowNameEditor,
  onSave,
}) {
  return (
    <>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{sessionName}</h3>
        <button
          type="button"
          onClick={() => {
            setNameDraft(sessionName || '')
            setShowNameEditor(true)
          }}
          className="text-sm font-medium text-cyan-400 transition hover:text-cyan-300"
        >
          {sessionName?.trim() ? 'Edit name' : 'Add name'}
        </button>
      </div>

      {showNameEditor ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            className="min-h-10 flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
            placeholder="Session name"
          />
          <button
            type="button"
            onClick={onSave}
            disabled={!nameDraft.trim() || nameDraft.trim() === sessionName}
            className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Save name
          </button>
          <button
            type="button"
            onClick={() => setShowNameEditor(false)}
            className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </>
  )
}
