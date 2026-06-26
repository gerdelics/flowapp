export default function RouteIdentityFields({
  city,
  onCityChange,
  cities = [],
  name,
  onNameChange,
  namePlaceholder = 'e.g. Downtown loop',
  link = '',
  onLinkChange,
  required = false,
}) {
  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          City
        </label>
        <select
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          required={required}
          className={`w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none ${
            city ? 'border-slate-600 text-slate-100' : 'border-slate-600 text-slate-500'
          }`}
        >
          <option value="" disabled>
            {cities.length === 0 ? 'Add a city first' : 'Select a city'}
          </option>
          {cities.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Route name
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={namePlaceholder}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          required={required}
        />
      </div>

      {onLinkChange ? (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Google Maps link <span className="font-normal normal-case text-slate-500">(optional)</span>
          </label>
          <input
            type="url"
            value={link}
            onChange={(event) => onLinkChange(event.target.value)}
            placeholder="https://www.google.com/maps/dir/..."
            inputMode="url"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">
            A Google Maps directions link (with multiple stops) used for “Drive with Google”.
          </p>
        </div>
      ) : null}
    </>
  )
}
