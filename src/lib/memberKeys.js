import { makeMemberKey } from './derive/makeMemberKey.js'
import { normalizeValue } from './normalize.js'

export function getMemberBackendKey(member) {
  return normalizeValue(member?.__memberKey)
}

export function resolveMemberKey(member) {
  return getMemberBackendKey(member) || makeMemberKey(member)
}

export function matchesMemberKey(member, key) {
  const wanted = String(key || '')
  if (!wanted) return false
  return resolveMemberKey(member) === wanted || makeMemberKey(member) === wanted
}

export function findMemberByKey(members, key) {
  return (members || []).find((member) => matchesMemberKey(member, key)) ?? null
}
