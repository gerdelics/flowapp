export default function TrafficLevelButton({ level, selected, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-md border px-3 py-2 font-bold transition ${compact ? 'text-[11px] px-1 py-2' : 'text-sm'} ${
        selected ? level.selectedClassName : level.inactiveClassName
      }`}
    >
      {level.shortLabel}
    </button>
  )
}
