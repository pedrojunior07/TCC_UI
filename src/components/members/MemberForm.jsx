import { CANONICAL_FIELDS, FIELD_GROUPS, getFieldLabel } from '../../lib/memberFields.js'
import { normalizeValue } from '../../lib/normalize.js'
import { Input, Textarea } from '../ui/Form.jsx'

function ensureAllFields(member) {
  const next = { ...(member ?? {}) }
  for (const field of CANONICAL_FIELDS) {
    next[field] = normalizeValue(member?.[field] ?? '')
  }
  return next
}

export function MemberForm({ value, onChange }) {
  const member = ensureAllFields(value)

  const setField = (field, fieldValue) => {
    onChange({ ...member, [field]: fieldValue })
  }

  return (
    <div className="space-y-6">
      {FIELD_GROUPS.map((group) => (
        <section key={group.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">{group.title}</div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.fields.map((field) => {
              if (field === 'Observacoes') {
                return (
                  <div key={field} className="sm:col-span-2">
                    <Textarea
                      label={getFieldLabel(field)}
                      value={member[field]}
                      onChange={(v) => setField(field, v)}
                    />
                  </div>
                )
              }
              return (
                <Input
                  key={field}
                  label={getFieldLabel(field)}
                  value={member[field]}
                  onChange={(v) => setField(field, v)}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
