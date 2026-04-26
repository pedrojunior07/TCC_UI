import { normalizeValue } from './normalize.js'
import { resolveWhatsappGroupsFromNucleo } from './whatsappGroups.js'

export const WHATSAPP_TRIGGER_OPTIONS = [
  { value: 'manual', label: 'Envio manual', hint: 'Apenas envia quando carrega no botão "Enviar".' },
  { value: 'actividade_criada', label: 'Quando a actividade é criada', hint: 'Ideal para convidar o grupo logo após marcar o encontro.' },
  { value: 'actividade_actualizada', label: 'Quando a actividade é alterada', hint: 'Avisar mudanças de data, hora ou local.' },
  { value: 'apos_confirmacao', label: 'Ao confirmar a actividade', hint: 'Envia confirmação final aos membros.' },
  { value: '24h_antes', label: '24 horas antes', hint: 'Lembrete um dia antes do encontro.' },
  { value: '2h_antes', label: '2 horas antes', hint: 'Lembrete rápido no dia do encontro.' },
]

const WHATSAPP_TRIGGER_LABELS = Object.fromEntries(WHATSAPP_TRIGGER_OPTIONS.map((item) => [item.value, item.label]))

export const WHATSAPP_FUNNEL_PRESETS = [
  {
    id: 'convite',
    nome: 'Convite ao marcar encontro',
    trigger: 'actividade_criada',
    template:
      'Paz e bem família do núcleo {nucleo}! 🙏\nEstá marcado: *{titulo}*\n📅 {data}\n🕒 {hora}\n📍 {local}\nContamos consigo!',
  },
  {
    id: 'lembrete-24h',
    nome: 'Lembrete 1 dia antes',
    trigger: '24h_antes',
    template:
      '⏰ Lembrete: amanhã temos *{titulo}* ({nucleo}).\n📅 {data} às {hora}\n📍 {local}\nBendita noite!',
  },
  {
    id: 'lembrete-2h',
    nome: 'Lembrete 2 horas antes',
    trigger: '2h_antes',
    template:
      'Já daqui a pouco! *{titulo}* do núcleo {nucleo}\n🕒 {hora}  📍 {local}\nAté já 🙌',
  },
  {
    id: 'confirmado',
    nome: 'Confirmação oficial',
    trigger: 'apos_confirmacao',
    template:
      '✅ Confirmado! *{titulo}* do núcleo {nucleo}\n📅 {data} às {hora}\n📍 {local}',
  },
  {
    id: 'alterado',
    nome: 'Mudança de data / local',
    trigger: 'actividade_actualizada',
    template:
      '⚠️ Atualização do núcleo {nucleo}: *{titulo}*\n📅 Nova data: {data} às {hora}\n📍 Novo local: {local}',
  },
]

export function labelForWhatsappTrigger(trigger) {
  return WHATSAPP_TRIGGER_LABELS[String(trigger || 'manual')] || String(trigger || 'manual')
}

export function buildWhatsAppTemplateMessage(template, { nucleo, actividade } = {}) {
  const replacements = {
    '{nucleo}': nucleo?.nome || '',
    '{titulo}': actividade?.titulo || 'Encontro',
    '{data}': actividade?.data || '',
    '{hora}': actividade?.horaInicio || nucleo?.horaEncontro || '',
    '{local}': actividade?.local || nucleo?.localEncontro || '',
  }

  let output = String(template || '')
  for (const [key, value] of Object.entries(replacements)) {
    output = output.split(key).join(String(value || ''))
  }
  return output.trim()
}

export async function sendAutomaticGroupNotifications({
  whatsappApi,
  notifications = [],
  trigger,
  nucleo,
  actividade = null,
}) {
  const destinations = resolveWhatsappGroupsFromNucleo(nucleo).filter((group) => normalizeValue(group?.groupId))
  if (destinations.length === 0) {
    return { trigger, total: 0, sent: 0, failed: [], reason: 'missing_group' }
  }

  const matching = notifications.filter(
    (item) =>
      item?.enabled !== false &&
      String(item?.trigger || 'manual') === String(trigger || 'manual') &&
      normalizeValue(item?.template),
  )

  if (matching.length === 0) {
    return { trigger, total: 0, sent: 0, failed: [], reason: 'no_templates' }
  }

  const results = await Promise.all(
    matching.flatMap((item) => destinations.map(async (group) => {
      const message = buildWhatsAppTemplateMessage(item.template, { nucleo, actividade })
      if (!message) {
        return {
          ok: false,
          name: item?.nome || 'Notificacao',
          groupId: group.groupId,
          groupName: group.groupName || group.groupId,
          error: 'Template vazio.',
        }
      }

      try {
        const response = await whatsappApi.sendGroupMessage({ groupJid: group.groupId, message })
        return {
          ok: true,
          name: item?.nome || 'Notificacao',
          groupId: group.groupId,
          groupName: group.groupName || group.groupId,
          message,
          response,
        }
      } catch (error) {
        return {
          ok: false,
          name: item?.nome || 'Notificacao',
          groupId: group.groupId,
          groupName: group.groupName || group.groupId,
          message,
          error: error?.message || 'Falha ao enviar notificacao.',
        }
      }
    })),
  )

  return {
    trigger,
    groups: destinations,
    total: results.length,
    sent: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok),
    results,
  }
}
