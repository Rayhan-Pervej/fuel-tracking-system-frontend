const colors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  employee: 'bg-blue-100 text-blue-700',
  customer: 'bg-gray-100 text-gray-700',
  pump_admin: 'bg-yellow-100 text-yellow-700',
  octane: 'bg-green-100 text-green-700',
  diesel: 'bg-orange-100 text-orange-700',
  petrol: 'bg-red-100 text-red-700',
  car: 'bg-sky-100 text-sky-700',
  truck: 'bg-amber-100 text-amber-700',
  bike: 'bg-teal-100 text-teal-700',
  bus: 'bg-indigo-100 text-indigo-700',
};

export default function Badge({ value }: { value: string }) {
  const cls = colors[value] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}
