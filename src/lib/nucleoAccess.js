export function canAccessNucleo({ currentUser, nucleo }) {
  if (!currentUser) return false
  if (currentUser.role === 'super_admin' || currentUser.role === 'secretario') return true
  if (currentUser.role === 'chefe_nucleo') {
    return Array.isArray(nucleo?.chefeUserIds) && nucleo.chefeUserIds.includes(currentUser.userId)
  }
  return false
}

export function getAccessibleNucleos({ currentUser, nucleos }) {
  if (!currentUser) return []
  if (currentUser.role === 'super_admin' || currentUser.role === 'secretario') return nucleos
  if (currentUser.role === 'chefe_nucleo') {
    return nucleos.filter((n) => Array.isArray(n.chefeUserIds) && n.chefeUserIds.includes(currentUser.userId))
  }
  return []
}
