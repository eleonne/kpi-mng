interface StatCardsProps {
  total: number;
  onTrack: number;
  inProgress: number;
  atRisk: number;
  noData: number;
}

export function ExecutiveStatCards({ total, onTrack, inProgress, atRisk, noData }: StatCardsProps) {
  const cards = [
    { label: "Total KPIs", value: total, bg: "bg-slate-900", text: "text-white" },
    { label: "On Track", value: onTrack, bg: "bg-green-600", text: "text-white" },
    { label: "In Progress", value: inProgress, bg: "bg-amber-500", text: "text-white" },
    { label: "At Risk", value: atRisk, bg: "bg-red-600", text: "text-white" },
    { label: "No Data", value: noData, bg: "bg-gray-400", text: "text-white" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl ${card.bg} ${card.text} p-5 shadow-sm`}>
          <p className="text-3xl font-bold">{card.value}</p>
          <p className="text-sm font-medium opacity-90">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
