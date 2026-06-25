export default function RouteIdentityFields({
  city,
  onCityChange,
  cities = [],
  name,
  onNameChange,
  namePlaceholder = 'e.g. Downtown loop',
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
    </>
  )
}
