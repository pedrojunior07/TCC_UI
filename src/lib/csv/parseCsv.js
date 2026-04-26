import { getCanonicalBaseFields, REQUIRED_FIELDS } from '../memberFields.js'
import { normalizeSpaces, normalizeValue } from '../normalize.js'

function countOccurrences(haystack, needle) {
  return (haystack.match(new RegExp(`\\${needle}`, 'g')) ?? []).length
}

function parseDelimited(text, delimiter) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }

  const pushRow = () => {
    rows.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        const next = text[index + 1]
        if (next === '"') {
          field += '"'
          index += 1
          continue
        }
        inQuotes = false
        continue
      }
      field += char
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === delimiter) {
      pushField()
      continue
    }

    if (char === '\r') continue

    if (char === '\n') {
      pushField()
      pushRow()
      continue
    }

    field += char
  }

  pushField()
  pushRow()

  return rows
}

function isEmptyRow(cells) {
  return cells.every((c) => !normalizeSpaces(c))
}

function canonicalizeHeaderCell(cell, baseFields) {
  const cleaned = normalizeSpaces(cell)
  if (!cleaned) return ''
  const cleanedCompare = cleaned.toLowerCase().replace(/[ ]+/g, ' ')

  for (const base of baseFields) {
    const baseCompare = base.toLowerCase().replace(/[ ]+/g, ' ')
    if (baseCompare === cleanedCompare) return base
  }

  return cleaned
}

function dedupeHeaders(headers) {
  const counts = new Map()
  return headers.map((h) => {
    const base = h
    const current = counts.get(base) ?? 0
    counts.set(base, current + 1)
    if (current === 0) return base
    return `${base}.${current}`
  })
}

export async function parseCsv(file) {
  const text = typeof file === 'string' ? file : await file.text()
  const trimmed = text.replace(/^\uFEFF/, '')

  const firstNonEmptyLine =
    trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ''

  if (!firstNonEmptyLine) throw new Error('Ficheiro vazio.')

  const semicolons = countOccurrences(firstNonEmptyLine, ';')
  const commas = countOccurrences(firstNonEmptyLine, ',')
  if (semicolons <= 0 && commas > 0) {
    throw new Error('Separador inválido: esperado ";" (CSV com ponto e vírgula).')
  }
  if (semicolons <= 0) {
    throw new Error('Ficheiro sem cabeçalho válido (não foi possível detetar ";").')
  }

  const baseFields = getCanonicalBaseFields()
  const rawRows = parseDelimited(trimmed, ';').filter((r) => !isEmptyRow(r))
  if (rawRows.length === 0) throw new Error('Ficheiro sem cabeçalho.')

  const rawHeader = rawRows[0]
  const canonicalHeader = rawHeader.map((cell) => canonicalizeHeaderCell(cell, baseFields))
  const columns = dedupeHeaders(canonicalHeader)

  const warnings = []

  const hasRequired = REQUIRED_FIELDS.every((req) => columns.includes(req))
  if (!hasRequired) throw new Error('Cabeçalho não reconhecido: falta "Nome Completo".')

  const known = new Set([...baseFields, ...baseFields.map((b) => `${b}.1`)])
  const knownCount = columns.filter((c) => known.has(c)).length
  if (knownCount < 2) throw new Error('Cabeçalho não reconhecido: colunas não correspondem ao modelo esperado.')

  const unknownColumns = columns.filter((c) => !known.has(c))
  if (unknownColumns.length > 0) {
    warnings.push(`Colunas desconhecidas serão mantidas: ${unknownColumns.join(', ')}`)
  }

  const rows = []
  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex += 1) {
    const cells = rawRows[rowIndex]
    const member = {}
    for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
      const key = columns[colIndex]
      const value = normalizeValue(cells[colIndex] ?? '')
      member[key] = value
    }

    const name = normalizeValue(member['Nome Completo'])
    if (!name) warnings.push(`Linha ${rowIndex + 1}: sem "Nome Completo" (será ignorada na importação).`)

    rows.push(member)
  }

  return { columns, rows, warnings, delimiter: ';' }
}

