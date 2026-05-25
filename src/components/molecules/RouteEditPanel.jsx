import RouteIdentityFields from './RouteIdentityFields'

export default function RouteEditPanel({
  editCity,
  setEditCity,
  editName,
  setEditName,
  editError,
  editSaving,
  onSave,
  onCancel,
  onDelete,
}) {
  return (
    <div className="flex flex-col gap-3">
      <RouteIdentityFields
        city={editCity}
        onCityChange={setEditCity}
        cityPlaceholder="City"
        name={editName}
        onNameChange={setEditName}
        namePlaceholder="Route name"
      />
      {editError ? <p className="text-xs text-red-400">{editError}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={editSaving || !editCity.trim() || !editName.trim()}
          onClick={onSave}
          className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-orange-400 disabled:opacity-50"
        >
          {editSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={editSaving}
          onClick={onCancel}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={editSaving}
          onClick={onDelete}
          className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-300 hover:border-red-400 hover:text-red-200"
        >
          Delete route
        </button>
      </div>
    </div>
  )
}
