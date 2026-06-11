export default function TrafficLevelButton({ level, selected, onClick, compact = false, row = false }) {
  const sizeClass = row
    ? 'flex-1 py-3 text-sm'
    : compact
      ? 'px-1 py-2 text-[11px]'
      : 'px-3 py-2 text-sm'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-md border font-bold transition ${sizeClass} ${
        selected ? level.selectedClassName : level.inactiveClassName
      }`}
    >
      {level.shortLabel}
    </button>
  )
}
