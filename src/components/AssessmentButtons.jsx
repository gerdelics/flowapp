const options = [
  { key: 'free', label: 'FREE', className: 'bg-emerald-600 hover:bg-emerald-500' },
  {
    key: 'medium',
    label: 'MEDIUM',
    className: 'bg-amber-500 text-slate-900 hover:bg-amber-400',
  },
  { key: 'heavy', label: 'HEAVY', className: 'bg-red-600 hover:bg-red-500' },
]

export default function AssessmentButtons({ value, onChange }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
      <p className="mb-2 text-sm font-medium text-slate-300">Observer Assessment</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition ${option.className} ${
              value === option.key ? 'ring-2 ring-white/80' : 'opacity-75'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
