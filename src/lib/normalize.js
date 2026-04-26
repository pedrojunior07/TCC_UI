const NULLISH_RE = /^(?:n\/a|na|null|undefined|-)$/i

export function normalizeSpaces(input) {
  return String(input ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function normalizeValue(value) {
  const cleaned = normalizeSpaces(value)
  if (!cleaned) return ''
  if (NULLISH_RE.test(cleaned)) return ''
  return cleaned
}

export function normalizeForKey(value) {
  return normalizeValue(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/[ ]+/g, ' ')
    .trim()
}

