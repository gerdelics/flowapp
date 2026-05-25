export default function ProviderForm({
  onSubmit,
  submitLabel,
  name,
  onNameChange,
  csvName,
  onCsvNameChange,
  iconUrl = '',
  onIconUrlChange,
  onDefaultIcon,
  onRemoveIcon,
  active = true,
  onActiveChange,
  showAdvancedFields = false,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm text-slate-300">
        Provider name
        <input
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
        />
      </label>

      <label className="block text-sm text-slate-300">
        CSV name
        <input
          type="text"
          value={csvName}
          onChange={(event) => onCsvNameChange(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
        />
      </label>

      {showAdvancedFields ? (
        <>
          <label className="block text-sm text-slate-300">
            Icon URL
            <input
              type="url"
              inputMode="url"
              placeholder="https://..."
              value={iconUrl}
              onChange={(event) => onIconUrlChange(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDefaultIcon}
              className="rounded bg-slate-700 px-2 py-1 text-xs"
            >
              Default icon
            </button>
            <button
              type="button"
              onClick={onRemoveIcon}
              className="rounded bg-slate-700 px-2 py-1 text-xs"
            >
              Remove icon
            </button>
          </div>

          <label className="mt-1 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => onActiveChange(event.target.checked)}
            />
            Provider active
          </label>
        </>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-md bg-cyan-500 px-3 py-2 font-semibold text-slate-950"
      >
        {submitLabel}
      </button>
    </form>
  )
}
