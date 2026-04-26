import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

function mm(value) {
  return (Number(value) * 72) / 25.4
}

function wrapText({ text, font, fontSize, maxWidth }) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ['']
  const words = raw.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    const width = font.widthOfTextAtSize(next, fontSize)
    if (width <= maxWidth) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = w
  }
  if (line) lines.push(line)
  return lines
}

function joinLine(parts) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' ')
}

function buildBaptismText(d) {
  const baptismoQuando = d.data_baptismo
    ? `no dia ${d.data_baptismo}`
    : `no dia ${d.dia_baptismo || ''} do mês de ${d.mes_baptismo || ''} do referido ano`

  return `CERTIFICO que, das folhas nº ${d.folha || ''}, sob o nº ${d.numero_assento || ''} do Livro de Registo de Baptismos desta ${
    d.paroquia || ''
  }, referentes ao ano de ${d.ano_registo || ''}, consta que ${baptismoQuando}, foi baptizado(a) nesta Igreja um indivíduo do sexo ${
    d.sexo || ''
  }, com o nome de ${d.nome_baptizado || ''}, nascido(a) em ${d.local_nascimento || ''}, distrito de ${d.distrito || ''}, aos ${
    d.dia_nascimento || ''
  } dias do mês de ${d.mes_nascimento || ''} do ano de ${d.ano_nascimento || ''}, filho(a) de ${d.nome_pai || ''}, profissão ${
    d.profissao_pai || ''
  }, natural de ${d.naturalidade_pai || ''}, e de ${d.nome_mae || ''}, profissão ${d.profissao_mae || ''}, natural de ${
    d.naturalidade_mae || ''
  }.`
}

function buildMarriageText(d) {
  return `CERTIFICO que das folhas ${d.folha || ''}, sob o nº ${d.numero_registo || ''} do Livro de Registo de Casamentos celebrados nesta ${
    d.paroquia || ''
  }, referentes ao ano de ${d.ano || ''}, consta que no dia ${d.dia || ''} do mês de ${d.mes || ''} do ano de ${d.ano || ''}, foi celebrado o casamento canónico de ${
    d.nome_noivo || ''
  }, filho de ${d.pai_noivo || ''}, com ${d.nome_noiva || ''}, filha de ${d.pai_noiva || ''}, sendo oficiante ${d.nome_oficiante || ''}.`
}

export async function buildCertificatePdfBytes({ type, data, logoBytes }) {
  const d = data || {}

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 in points

  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesItalic)

  const marginTop = mm(30)
  const marginBottom = mm(25)
  const marginX = mm(25)
  const contentW = page.getWidth() - marginX * 2

  let y = page.getHeight() - marginTop

  if (logoBytes) {
    try {
      const img = await pdfDoc.embedPng(logoBytes)
      const width = mm(28)
      const ratio = img.height / img.width
      const height = width * ratio
      const x = (page.getWidth() - width) / 2
      page.drawImage(img, { x, y: y - height, width, height })
      y -= height + mm(8)
    } catch {
      // ignore logo failures
    }
  }

  const headerLine = 'ARQUIDIOCESE DE MAPUTO – MOÇAMBIQUE'
  const title = type === 'casamento' ? 'CERTIDÃO DE CASAMENTO' : 'CERTIDÃO DE BAPTISMO'

  page.drawText(headerLine, {
    x: marginX,
    y: y - 12,
    size: 12,
    font: fontRegular,
    color: rgb(0.058, 0.090, 0.164),
  })
  y -= 12 + mm(3)

  const titleSize = 18
  const titleW = fontBold.widthOfTextAtSize(title, titleSize)
  page.drawText(title, {
    x: Math.max(marginX, (page.getWidth() - titleW) / 2),
    y: y - titleSize,
    size: titleSize,
    font: fontBold,
    color: rgb(0.118, 0.227, 0.541),
  })
  y -= titleSize + mm(10)

  const bodySize = 12
  const lineH = bodySize * 1.5
  const bottomLimit = marginBottom

  const drawParagraph = ({ text, font = fontRegular, size = bodySize, italics = false, extraGap = 0 }) => {
    const f = italics ? fontItalic : font
    const lines = wrapText({ text, font: f, fontSize: size, maxWidth: contentW })
    for (const ln of lines) {
      if (y - lineH < bottomLimit) break
      page.drawText(ln, { x: marginX, y: y - size, size, font: f, color: rgb(0.067, 0.094, 0.153) })
      y -= lineH
    }
    y -= extraGap
  }

  if (type === 'casamento') {
    drawParagraph({ text: buildMarriageText(d) })
    drawParagraph({
      text: joinLine(['Foram testemunhas:', `${d.nome_testemunha_1 || ''};`, `${d.nome_testemunha_2 || ''}.`]),
    })
  } else {
    drawParagraph({ text: buildBaptismText(d) })
    drawParagraph({ text: joinLine([`Neto(a) paterno(a) de ${d.avo_paterno || ''}`, `e materno(a) de ${d.avo_materno || ''}.`]) })
    drawParagraph({
      text: joinLine([
        'Foram padrinhos:',
        `${d.nome_padrinho || ''}, estado ${d.estado_padrinho || ''}, profissão ${d.profissao_padrinho || ''};`,
        `${d.nome_madrinha || ''}, estado ${d.estado_madrinha || ''}, profissão ${d.profissao_madrinha || ''}.`,
      ]),
    })
    if (d.anotacoes) drawParagraph({ text: `À margem: ${d.anotacoes}`, size: 11, italics: true, extraGap: mm(2) })
  }

  drawParagraph({
    text:
      type === 'casamento'
        ? 'Por ser verdade, passo a presente certidão que assino e autentico com o selo em uso.'
        : 'Por ser verdade, passo a presente certidão que vou assinar e autenticar com o selo em uso nesta Paróquia.',
    extraGap: mm(2),
  })
  drawParagraph({
    text: joinLine([d.local_emissao ? `${d.local_emissao},` : '', `aos ${d.dia || ''} de ${d.mes || ''} de ${d.ano || ''}.`]),
    extraGap: mm(6),
  })

  // signature line
  const sigW = mm(75)
  const sigX = marginX + (contentW - sigW) / 2
  page.drawLine({ start: { x: sigX, y: y }, end: { x: sigX + sigW, y: y }, thickness: 1, color: rgb(0.067, 0.094, 0.153) })
  y -= mm(6)

  const cargo = d.cargo_assinante || 'O'
  const cargoW = fontBold.widthOfTextAtSize(cargo, 12)
  page.drawText(cargo, { x: marginX + (contentW - cargoW) / 2, y: y - 12, size: 12, font: fontBold })
  y -= lineH

  const assin = d.assinante || ''
  if (assin) {
    const assinW = fontRegular.widthOfTextAtSize(assin, 12)
    page.drawText(assin, { x: marginX + (contentW - assinW) / 2, y: y - 12, size: 12, font: fontRegular })
    y -= lineH
  }

  // stamp (simple circle)
  const stampR = mm(19)
  page.drawCircle({
    x: page.getWidth() - marginX - stampR,
    y: marginBottom + stampR,
    size: stampR,
    borderWidth: 2,
    borderColor: rgb(0.576, 0.773, 0.984),
  })
  const selo = 'Selo'
  const seloW = fontBold.widthOfTextAtSize(selo, 10)
  page.drawText(selo, {
    x: page.getWidth() - marginX - stampR - seloW / 2,
    y: marginBottom + stampR - 5,
    size: 10,
    font: fontBold,
    color: rgb(0.576, 0.773, 0.984),
  })

  return pdfDoc.save()
}

