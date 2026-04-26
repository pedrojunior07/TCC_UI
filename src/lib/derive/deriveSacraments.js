import { normalizeValue } from '../normalize.js'

export function deriveSacraments(member) {
  const baptismo = Boolean(normalizeValue(member?.['Data de Baptismo']))
  const crisma = Boolean(normalizeValue(member?.['Data do Crisma']))
  const casamento = Boolean(normalizeValue(member?.['Data do Casamento']))
  return { baptismo, crisma, casamento }
}

