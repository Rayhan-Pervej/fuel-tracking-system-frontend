interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'octane' | 'diesel' | 'petrol';
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, { container: string; label: string; value: string; sub: string }> = {
  default: {
    container: 'bg-white border-gray-200',
    label: 'text-gray-500',
    value: 'text-gray-800',
    sub: 'text-gray-400',
  },
  octane: {
    container: 'bg-green-50 border-green-200',
    label: 'text-green-700',
    value: 'text-green-900',
    sub: 'text-green-700/80',
  },
  diesel: {
    container: 'bg-orange-50 border-orange-200',
    label: 'text-orange-700',
    value: 'text-orange-900',
    sub: 'text-orange-700/80',
  },
  petrol: {
    container: 'bg-red-50 border-red-200',
    label: 'text-red-700',
    value: 'text-red-900',
    sub: 'text-red-700/80',
  },
};

export default function StatCard({ label, value, sub, tone = 'default' }: StatCardProps) {
  const c = toneClasses[tone];
  return (
    <div className={`border rounded-lg p-5 ${c.container}`}>
      <p className={`text-xs uppercase tracking-wide ${c.label}`}>{label}</p>
      <p className={`text-2xl font-bold mt-1 ${c.value}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${c.sub}`}>{sub}</p>}
    </div>
  );
}
