export const WHATSAPP_SESSION_POLL_MS = 5000

export function unwrapWhatsappData(payload) {
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload
  }
  return null
}

export function sessionTone(payload) {
  const data = unwrapWhatsappData(payload)
  const value = String(data?.status || data?.state || data?.connection || '').toLowerCase()
  if (value.includes('connect') || value.includes('open')) return 'green'
  if (value.includes('qr') || value.includes('pair') || value.includes('awaiting')) return 'yellow'
  if (value.includes('close') || value.includes('disconnect') || value.includes('error')) return 'red'
  return 'gray'
}

export function sessionValue(payload) {
  const data = unwrapWhatsappData(payload)
  return String(data?.status || data?.state || data?.connection || '').toLowerCase()
}

export function sessionLabel(payload) {
  const value = sessionValue(payload)
  if (value === 'connected' || value === 'open') return 'conectado'
  if (value === 'awaiting_qr_scan') return 'aguardando qr'
  if (value === 'connecting') return 'a conectar'
  if (value === 'logged_out') return 'sessao terminada'
  if (value === 'disconnected' || value === 'close') return 'desconectado'
  if (value === 'idle') return 'inativo'
  return 'desconhecido'
}

export function isSessionConnected(payload) {
  return unwrapWhatsappData(payload)?.isConnected === true
}

export function sessionDescription(payload) {
  const data = unwrapWhatsappData(payload)
  const value = sessionValue(payload)

  if (data?.qrAvailable) return 'Leia o QR no WhatsApp para concluir a ligacao.'
  if (data?.isConnected) return 'Ligacao ativa com o WhatsApp.'
  if (value === 'connecting') return 'A preparar a sessao do WhatsApp.'
  if (value === 'logged_out') return 'Sessao encerrada. Prepare uma nova sessao para gerar QR.'
  if (value === 'disconnected') return data?.lastError || 'Conexao encerrada.'
  if (data?.lastError) return data.lastError
  return 'Sem sessao ativa no momento.'
}

export function hasVisibleQr(payload) {
  return Boolean(qrSrcOf(payload) || qrTextOf(payload) || qrAsciiOf(payload))
}

export function shouldPollWhatsappSession(payload) {
  const data = unwrapWhatsappData(payload)
  if (!data) return true
  if (data.qrAvailable) return true
  if (data.isConnected === true) return false

  const value = String(data?.status || data?.state || data?.connection || '').toLowerCase()
  return value.includes('connecting') || value.includes('awaiting') || value.includes('disconnected') || value === 'idle' || value === 'logged_out'
}

export function shouldAutoEnsureWhatsappSession(payload) {
  const data = unwrapWhatsappData(payload)
  if (!data) return true
  if (data.isConnected === true) return false
  if (data.qrAvailable) return false

  const value = String(data?.status || data?.state || data?.connection || '').toLowerCase()
  return !value || value === 'idle' || value === 'logged_out' || value.includes('disconnect') || value === 'close'
}

export function qrSrcOf(payload) {
  const data = unwrapWhatsappData(payload)
  const raw = String(data?.qrCode || data?.qr || data?.base64 || data?.dataUrl || '').trim()
  if (!raw) return ''
  if (raw.startsWith('data:image/') || raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return ''
}

export function qrTextOf(payload) {
  const data = unwrapWhatsappData(payload)
  return String(data?.qr || '').trim()
}

export function qrAsciiOf(payload) {
  const data = unwrapWhatsappData(payload)
  return String(data?.qrAscii || '').trim()
}
