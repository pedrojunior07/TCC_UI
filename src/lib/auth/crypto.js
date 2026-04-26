function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64FromArrayBuffer(buf) {
  return bytesToBase64(new Uint8Array(buf))
}

export function makeSalt(bytes = 16) {
  try {
    const arr = new Uint8Array(bytes)
    crypto.getRandomValues(arr)
    return bytesToBase64(arr)
  } catch {
    return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
  }
}

export async function hashPassword(password, salt) {
  const normalized = String(password ?? '')
  const s = String(salt ?? '')
  const data = new TextEncoder().encode(`paroquia:v1:${s}:${normalized}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64FromArrayBuffer(digest)
}

