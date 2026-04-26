export function Input({ label, value, onChange, placeholder, name }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <input
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
      />
    </label>
  )
}

export function Textarea({ label, value, onChange, placeholder, name, rows = 4 }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <textarea
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
      />
    </label>
  )
}

export function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

