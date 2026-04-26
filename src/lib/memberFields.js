export const CANONICAL_FIELDS = [
  'Ord.',
  'Nome Completo',
  'Comunidade',
  'Data de Baptismo',
  'Data de Nascimento',
  'Naturalidade',
  'Nome do Pai',
  'Naturalidade do Pai',
  'Estado Civil',
  'Profissao',
  'Nome da Mae',
  'Avos Paternos',
  'Avos Maternos',
  'Nome do Padrinho',
  'Estado Civil.1',
  'Profissao.1',
  'Residencia',
  'Nome da Madrinha',
  'Estado Civil da Madrinha',
  'Profisssao da Madrinha',
  'Residencia da Madrinha',
  'Data do Crisma',
  'Data do Casamento',
  'Numero do Assento',
  'Observacoes',
]

export const REQUIRED_FIELDS = ['Nome Completo']

export const FIELD_LABELS = {
  'Ord.': 'Ord.',
  'Nome Completo': 'Nome Completo',
  Comunidade: 'Comunidade',
  'Data de Baptismo': 'Data de Baptismo',
  'Data de Nascimento': 'Data de Nascimento',
  Naturalidade: 'Naturalidade',
  'Nome do Pai': 'Nome do Pai',
  'Naturalidade do Pai': 'Naturalidade do Pai',
  'Estado Civil': 'Estado Civil (Membro)',
  Profissao: 'Profissão (Membro)',
  'Nome da Mae': 'Nome da Mãe',
  'Avos Paternos': 'Avós Paternos',
  'Avos Maternos': 'Avós Maternos',
  'Nome do Padrinho': 'Nome do Padrinho',
  'Estado Civil.1': 'Estado Civil (Padrinho)',
  'Profissao.1': 'Profissão (Padrinho)',
  Residencia: 'Residência',
  'Nome da Madrinha': 'Nome da Madrinha',
  'Estado Civil da Madrinha': 'Estado Civil da Madrinha',
  'Profisssao da Madrinha': 'Profissão da Madrinha',
  'Residencia da Madrinha': 'Residência da Madrinha',
  'Data do Crisma': 'Data do Crisma',
  'Data do Casamento': 'Data do Casamento',
  'Numero do Assento': 'Número do Assento',
  Observacoes: 'Observações',
}

export const FIELD_GROUPS = [
  { title: 'Identificação', fields: ['Ord.', 'Nome Completo', 'Comunidade'] },
  { title: 'Origem', fields: ['Data de Nascimento', 'Naturalidade'] },
  {
    title: 'Pais & Avós',
    fields: ['Nome do Pai', 'Naturalidade do Pai', 'Nome da Mae', 'Avos Paternos', 'Avos Maternos'],
  },
  { title: 'Estado civil & Profissão', fields: ['Estado Civil', 'Profissao', 'Residencia'] },
  {
    title: 'Padrinhos',
    fields: [
      'Nome do Padrinho',
      'Estado Civil.1',
      'Profissao.1',
      'Nome da Madrinha',
      'Estado Civil da Madrinha',
      'Profisssao da Madrinha',
      'Residencia da Madrinha',
    ],
  },
  {
    title: 'Sacramentos (colunas)',
    fields: ['Data de Baptismo', 'Data do Crisma', 'Data do Casamento', 'Numero do Assento'],
  },
  { title: 'Observações', fields: ['Observacoes'] },
]

export function getFieldLabel(field) {
  return FIELD_LABELS[field] ?? field
}

export function getCanonicalBaseFields() {
  const seen = new Set()
  const bases = []
  for (const field of CANONICAL_FIELDS) {
    const base = field.replace(/\.\d+$/, '')
    if (seen.has(base)) continue
    seen.add(base)
    bases.push(base)
  }
  return bases
}

