import { normalizeForKey } from '../normalize.js'

export function makeMemberKey(member) {
  const nome = normalizeForKey(member?.['Nome Completo'])
  const nascimento = normalizeForKey(member?.['Data de Nascimento'])
  const pai = normalizeForKey(member?.['Nome do Pai'])
  const mae = normalizeForKey(member?.['Nome da Mae'])
  return [nome, nascimento, pai, mae].join('|')
}

