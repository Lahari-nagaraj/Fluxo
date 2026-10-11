export default function StatCard({
  title,
  value = "—",
  description,
  icon: Icon,
  accent = "violet",
}) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-title">{title}</span>

        <div className={`stat-icon ${accent}`}>
          <Icon size={19} />
        </div>
      </div>

      <div className="stat-value">{value}</div>
      <p className="stat-description">{description}</p>
    </article>
  );
}
