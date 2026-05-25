export default function PanelSection({
  title,
  children,
  className = 'rounded-xl border border-slate-700 bg-slate-900 p-4',
  titleClassName = 'text-xl font-semibold',
}) {
  return (
    <section className={className}>
      <h2 className={titleClassName}>{title}</h2>
      {children}
    </section>
  )
}
