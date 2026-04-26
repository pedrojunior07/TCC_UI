function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function para(text) {
  return `<p style="margin: 0 0 10pt 0;">${escapeHtml(text)}</p>`
}

function joinLine(parts) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' ')
}

function extractDateParts(dateStr) {
  const raw = String(dateStr || '').trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]

  if (iso) {
    const monthIndex = Number(iso[2]) - 1
    return { y: iso[1], m: monthNames[monthIndex] || iso[2], d: iso[3], raw }
  }

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (slash) {
    const monthIndex = Number(slash[2]) - 1
    return { y: slash[3], m: monthNames[monthIndex] || slash[2], d: String(slash[1]).padStart(2, '0'), raw }
  }

  const months = {
    janeiro: 'Janeiro',
    fevereiro: 'Fevereiro',
    marco: 'Março',
    março: 'Março',
    abril: 'Abril',
    maio: 'Maio',
    junho: 'Junho',
    julho: 'Julho',
    agosto: 'Agosto',
    setembro: 'Setembro',
    outubro: 'Outubro',
    novembro: 'Novembro',
    dezembro: 'Dezembro',
  }

  const ptLong = raw.match(/^(\d{1,2})\s*(?:de\s+)?([A-Za-zÀ-ÿ]+)\s*(?:de\s+)?(\d{4})$/i)
  if (ptLong) {
    const day = String(ptLong[1]).padStart(2, '0')
    const monthKey = String(ptLong[2] || '').trim().toLowerCase()
    const month = months[monthKey] || ptLong[2]
    return { y: ptLong[3], m: month, d: day, raw }
  }
  return { y: '', m: '', d: '', raw }
}

function parseAssentoRef(value) {
  const raw = String(value || '').trim()
  const m = raw.match(/^(\d+)\s*\/\s*(\d{4})$/)
  if (!m) return null
  return { folha: m[1], ano: m[2] }
}

export function buildBaptismCertificateHtml({
  logoUrl,
  headerLine = 'ARQUIDIOCESE DE MAPUTO – MOÇAMBIQUE',
  title = 'CERTIDÃO DE BAPTISMO',
  data,
}) {
  const {
    folha = '',
    numero_assento = '',
    paroquia = '',
    ano_registo = '',
    data_baptismo = '',
    dia_baptismo = '',
    mes_baptismo = '',
    sexo = '',
    nome_baptizado = '',
    local_nascimento = '',
    distrito = '',
    dia_nascimento = '',
    mes_nascimento = '',
    ano_nascimento = '',
    nome_pai = '',
    profissao_pai = '',
    naturalidade_pai = '',
    nome_mae = '',
    profissao_mae = '',
    naturalidade_mae = '',
    avo_paterno = '',
    avo_materno = '',
    nome_padrinho = '',
    estado_padrinho = '',
    profissao_padrinho = '',
    nome_madrinha = '',
    estado_madrinha = '',
    profissao_madrinha = '',
    anotacoes = '',
    local_emissao = '',
    dia = '',
    mes = '',
    ano = '',
    assinante = '',
    cargo_assinante = '',
  } = data || {}

  const baptismoQuando = data_baptismo
    ? `no dia ${data_baptismo}`
    : `no dia ${dia_baptismo} do mês de ${mes_baptismo} do referido ano`

  const mainText = [
    `CERTIFICO que, das folhas nº ${folha}, sob o nº ${numero_assento} do Livro de Registo de Baptismos desta ${paroquia}, referentes ao ano de ${ano_registo}, consta que ${baptismoQuando}, foi baptizado(a) nesta Igreja um indivíduo do sexo ${sexo}, com o nome de ${nome_baptizado}, nascido(a) em ${local_nascimento}, distrito de ${distrito}, aos ${dia_nascimento} dias do mês de ${mes_nascimento} do ano de ${ano_nascimento}, filho(a) de ${nome_pai}, profissão ${profissao_pai}, natural de ${naturalidade_pai}, e de ${nome_mae}, profissão ${profissao_mae}, natural de ${naturalidade_mae}.`,
  ].join(' ')

  const avosLine = joinLine([`Neto(a) paterno(a) de ${avo_paterno}`, `e materno(a) de ${avo_materno}.`])

  const padrinhosLine = joinLine([
    'Foram padrinhos:',
    `${nome_padrinho}, estado ${estado_padrinho}, profissão ${profissao_padrinho};`,
    `${nome_madrinha}, estado ${estado_madrinha}, profissão ${profissao_madrinha}.`,
  ])

  const margem = anotacoes ? `À margem: ${anotacoes}` : ''

  const footerText = 'Por ser verdade, passo a presente certidão que vou assinar e autenticar com o selo em uso nesta Paróquia.'
  const dateLine = joinLine([local_emissao ? `${local_emissao},` : '', `aos ${dia} de ${mes} de ${ano}.`])

  return `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 30mm 25mm 25mm 25mm; }
      html, body { height: 100%; }
      body {
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.5;
        color: #111827;
        margin: 0;
      }
      .page { position: relative; }
      .header { text-align: center; }
      .logo { display: block; margin: 0 auto 8mm auto; width: 28mm; height: auto; }
      .line1 { font-size: 12pt; letter-spacing: 0.5px; text-transform: uppercase; color: #0f172a; }
      .title { margin-top: 3mm; font-size: 18pt; font-weight: 700; text-transform: uppercase; color: #1e3a8a; }
      .content { margin-top: 10mm; text-align: justify; }
      .italic { font-style: italic; font-size: 11pt; }
      .sig { margin-top: 14mm; }
      .sig-line { margin-top: 10mm; display: flex; justify-content: center; }
      .sig-line .rule { width: 75mm; border-bottom: 1px solid #111827; height: 1px; }
      .sig-name { text-align: center; margin-top: 4mm; }
      .stamp {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 38mm;
        height: 38mm;
        border: 2px solid rgba(30, 58, 138, 0.25);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(30, 58, 138, 0.35);
        font-weight: 700;
        font-size: 10pt;
        text-transform: uppercase;
        transform: rotate(-8deg);
      }
      .meta { margin-top: 12mm; font-size: 10pt; color: #475569; text-align: center; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="Logo" />` : ''}
        <div class="line1">${escapeHtml(headerLine)}</div>
        <div class="title">${escapeHtml(title)}</div>
      </div>

      <div class="content">
        ${para(mainText)}
        ${para(avosLine)}
        ${para(padrinhosLine)}
        ${margem ? `<p class="italic" style="margin-top: 12pt;">${escapeHtml(margem)}</p>` : ''}

        <div class="sig">
          ${para(footerText)}
          ${para(dateLine)}
          <div class="sig-line"><div class="rule"></div></div>
          <div class="sig-name">
            <div style="font-weight: 700;">${escapeHtml(cargo_assinante || 'O')}</div>
            <div>${escapeHtml(assinante)}</div>
          </div>
        </div>
      </div>

      <div class="stamp">Selo</div>
      <div class="meta">Documento gerado pelo sistema Paroquia_FinalTest (simulação).</div>
    </div>
  </body>
</html>`
}

export function buildMarriageCertificateHtml({
  logoUrl,
  headerLine = 'ARQUIDIOCESE DE MAPUTO – MOÇAMBIQUE',
  title = 'CERTIDÃO DE CASAMENTO',
  data,
}) {
  const {
    folha = '',
    numero_registo = '',
    paroquia = '',
    ano = '',
    dia = '',
    mes = '',
    nome_noivo = '',
    pai_noivo = '',
    nome_noiva = '',
    pai_noiva = '',
    nome_oficiante = '',
    nome_testemunha_1 = '',
    nome_testemunha_2 = '',
    local_emissao = '',
    assinante = '',
    cargo_assinante = '',
  } = data || {}

  const mainText = [
    `CERTIFICO que das folhas ${folha}, sob o nº ${numero_registo} do Livro de Registo de Casamentos celebrados nesta ${paroquia}, referentes ao ano de ${ano}, consta que no dia ${dia} do mês de ${mes} do ano de ${ano}, foi celebrado o casamento canónico de ${nome_noivo}, filho de ${pai_noivo}, com ${nome_noiva}, filha de ${pai_noiva}, sendo oficiante ${nome_oficiante}.`,
  ].join(' ')

  const witnesses = joinLine(['Foram testemunhas:', `${nome_testemunha_1};`, `${nome_testemunha_2}.`])

  const footerText = 'Por ser verdade, passo a presente certidão que assino e autentico com o selo em uso.'
  const dateLine = joinLine([local_emissao ? `${local_emissao},` : '', `aos ${dia} de ${mes} de ${ano}.`])

  return `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 30mm 25mm 25mm 25mm; }
      html, body { height: 100%; }
      body {
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.5;
        color: #111827;
        margin: 0;
      }
      .page { position: relative; }
      .header { text-align: center; }
      .logo { display: block; margin: 0 auto 8mm auto; width: 28mm; height: auto; }
      .line1 { font-size: 12pt; letter-spacing: 0.5px; text-transform: uppercase; color: #0f172a; }
      .title { margin-top: 3mm; font-size: 18pt; font-weight: 700; text-transform: uppercase; color: #1e3a8a; }
      .content { margin-top: 10mm; text-align: justify; }
      .sig { margin-top: 14mm; }
      .sig-line { margin-top: 10mm; display: flex; justify-content: center; }
      .sig-line .rule { width: 75mm; border-bottom: 1px solid #111827; height: 1px; }
      .sig-name { text-align: center; margin-top: 4mm; }
      .stamp {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 38mm;
        height: 38mm;
        border: 2px solid rgba(30, 58, 138, 0.25);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(30, 58, 138, 0.35);
        font-weight: 700;
        font-size: 10pt;
        text-transform: uppercase;
        transform: rotate(-8deg);
      }
      .meta { margin-top: 12mm; font-size: 10pt; color: #475569; text-align: center; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="Logo" />` : ''}
        <div class="line1">${escapeHtml(headerLine)}</div>
        <div class="title">${escapeHtml(title)}</div>
      </div>

      <div class="content">
        ${para(mainText)}
        ${para(witnesses)}

        <div class="sig">
          ${para(footerText)}
          ${para(dateLine)}
          <div class="sig-line"><div class="rule"></div></div>
          <div class="sig-name">
            <div style="font-weight: 700;">${escapeHtml(cargo_assinante || 'O')}</div>
            <div>${escapeHtml(assinante)}</div>
          </div>
        </div>
      </div>

      <div class="stamp">Selo</div>
      <div class="meta">Documento gerado pelo sistema Paroquia_FinalTest (simulação).</div>
    </div>
  </body>
</html>`
}

export function buildCertificatePrefillFromMember({ type, member }) {
  const m = member || {}

  const baptismoParts = extractDateParts(m?.['Data de Baptismo'])
  const nascimentoParts = extractDateParts(m?.['Data de Nascimento'])
  const casamentoParts = extractDateParts(m?.['Data do Casamento'])
  const assentoRef = parseAssentoRef(m?.['Numero do Assento'])

  if (type === 'batismo') {
    return {
      folha: assentoRef?.folha || '',
      numero_assento: m?.['Numero do Assento'] || '',
      paroquia: '',             // preenchido pelo servidor via ParoquiaConfig
      ano_registo: baptismoParts.y || assentoRef?.ano || '',
      data_baptismo: m?.['Data de Baptismo'] || '',
      dia_baptismo: baptismoParts.d || '',
      mes_baptismo: baptismoParts.m || baptismoParts.raw || '',
      sexo: '',
      nome_baptizado: m?.['Nome Completo'] || '',
      local_nascimento: m?.Naturalidade || '',
      distrito: '',
      dia_nascimento: nascimentoParts.d || '',
      mes_nascimento: nascimentoParts.m || nascimentoParts.raw || '',
      ano_nascimento: nascimentoParts.y || '',
      nome_pai: m?.['Nome do Pai'] || '',
      profissao_pai: '',
      naturalidade_pai: m?.['Naturalidade do Pai'] || '',
      nome_mae: m?.['Nome da Mae'] || '',
      profissao_mae: '',
      naturalidade_mae: '',
      avo_paterno: m?.['Avos Paternos'] || '',
      avo_materno: m?.['Avos Maternos'] || '',
      nome_padrinho: m?.['Nome do Padrinho'] || '',
      estado_padrinho: m?.['Estado Civil.1'] || '',
      profissao_padrinho: m?.['Profissao.1'] || '',
      nome_madrinha: m?.['Nome da Madrinha'] || '',
      estado_madrinha: m?.['Estado Civil da Madrinha'] || '',
      profissao_madrinha: m?.['Profisssao da Madrinha'] || '',
      anotacoes: '',
      nome_oficiante: '',       // preenchido pelo servidor via ParoquiaConfig
      local_emissao: '',        // preenchido pelo servidor via ParoquiaConfig
      dia: '',
      mes: '',
      ano: '',
      assinante: '',            // preenchido pelo servidor via ParoquiaConfig
      cargo_assinante: '',      // preenchido pelo servidor via ParoquiaConfig
      __source: { baptismoParts, nascimentoParts },
    }
  }

  if (type === 'casamento') {
    return {
      folha: assentoRef?.folha || '',
      numero_registo: m?.['Numero do Assento'] || '',
      paroquia: '',             // preenchido pelo servidor via ParoquiaConfig
      ano: casamentoParts.y || assentoRef?.ano || '',
      dia: casamentoParts.d || '',
      mes: casamentoParts.m || casamentoParts.raw || '',
      nome_noivo: '',
      pai_noivo: '',
      mae_noivo: '',
      nome_noiva: '',
      pai_noiva: '',
      mae_noiva: '',
      nome_oficiante: '',       // preenchido pelo servidor via ParoquiaConfig
      nome_testemunha_1: '',
      nome_testemunha_2: '',
      autenticacao: '',         // preenchido pelo servidor via ParoquiaConfig
      local_emissao: '',        // preenchido pelo servidor via ParoquiaConfig
      assinante: '',            // preenchido pelo servidor via ParoquiaConfig
      cargo_assinante: '',      // preenchido pelo servidor via ParoquiaConfig
      __source: { casamentoParts },
    }
  }

  if (type === 'crisma') {
    const crismaParts = extractDateParts(m?.['Data do Crisma'])
    return {
      folha: assentoRef?.folha || '',
      numero_assento: m?.['Numero do Assento'] || '',
      paroquia: 'Igreja Paroquial da Missão de Santa Teresinha do Menino Jesus',
      ano_registo: crismaParts.y || assentoRef?.ano || '',
      data_crisma: m?.['Data do Crisma'] || '',
      dia_crisma: crismaParts.d || '',
      mes_crisma: crismaParts.m || crismaParts.raw || '',
      nome_crismado: m?.['Nome Completo'] || '',
      sexo: '',
      local_nascimento: m?.Naturalidade || '',
      distrito: 'Matola',
      dia_nascimento: nascimentoParts.d || '',
      mes_nascimento: nascimentoParts.m || nascimentoParts.raw || '',
      ano_nascimento: nascimentoParts.y || '',
      nome_pai: m?.['Nome do Pai'] || '',
      profissao_pai: '',
      naturalidade_pai: m?.['Naturalidade do Pai'] || '',
      nome_mae: m?.['Nome da Mae'] || '',
      profissao_mae: '',
      naturalidade_mae: '',
      nome_padrinho: m?.['Nome do Padrinho'] || '',
      estado_padrinho: m?.['Estado Civil.1'] || '',
      profissao_padrinho: m?.['Profissao.1'] || '',
      nome_madrinha: m?.['Nome da Madrinha'] || '',
      estado_madrinha: m?.['Estado Civil da Madrinha'] || '',
      profissao_madrinha: m?.['Profisssao da Madrinha'] || '',
      nome_bispo: '',
      data_baptismo: m?.['Data de Baptismo'] || '',
      paroquia_baptismo: '',
      anotacoes: '',
      autenticacao: 'selo',
      local_emissao: 'Matola',
      dia: '',
      mes: '',
      ano: '',
      assinante: '',
      cargo_assinante: '',
      __source: { crismaParts, nascimentoParts },
    }
  }

  return {}
}
