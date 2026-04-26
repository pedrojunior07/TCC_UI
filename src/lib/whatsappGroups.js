import { normalizeValue } from './normalize.js'

export function normalizeWhatsappGroup(group) {
  if (!group || typeof group !== 'object') return null

  const next = {
    groupId: normalizeValue(group.groupId || group.groupJid || group.jid || group.id),
    groupName: normalizeValue(group.groupName || group.subject || group.name),
    inviteLink: normalizeValue(group.inviteLink),
  }

  return Object.values(next).some(Boolean) ? next : null
}

export function normalizeWhatsappGroups(groups = []) {
  const seen = new Set()
  const next = []

  for (const item of Array.isArray(groups) ? groups : []) {
    const normalized = normalizeWhatsappGroup(item)
    if (!normalized) continue

    const key = normalized.groupId || [normalized.groupName, normalized.inviteLink].filter(Boolean).join('|')
    if (!key || seen.has(key)) continue

    seen.add(key)
    next.push(normalized)
  }

  return next
}

export function resolveWhatsappGroupsFromNucleo(nucleo) {
  const groups = normalizeWhatsappGroups(nucleo?.whatsappGroups)
  if (groups.length > 0) return groups

  const legacyGroup = normalizeWhatsappGroup(nucleo?.whatsappGroup)
  return legacyGroup ? [legacyGroup] : []
}

export function primaryWhatsappGroupFromNucleo(nucleo) {
  return resolveWhatsappGroupsFromNucleo(nucleo)[0] || null
}
