import { useMemo, useState } from 'react'
import { CANONICAL_FIELDS, getFieldLabel } from '../lib/memberFields.js'
import { normalizeValue } from '../lib/normalize.js'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { makeMemberKey } from '../lib/derive/makeMemberKey.js'
import { extractBi, extractAssento, confirmBi } from '../lib/api/ocr.js'
import { ImagePreview } from '../components/ocr/ImagePreview.jsx'
import { DropZone } from '../components/ocr/DropZone.jsx'

function emptyMember() {
  const m = {}
  for (const f of CANONICAL_FIELDS) m[f] = ''
  return m
}

function normalizeMember(member) {
  const next = {}
  for (const f of CANONICAL_FIELDS) next[f] = normalizeValue(member?.[f] ?? '')
  return next
}

function parseLooseText(text) {
  const member = emptyMember()
  const confidence = {}

  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const mapping = [
    { re: /^n[.oº]\s+do\s+assento:\s*(.+)$/i, field: 'Numero do Assento', conf: 0.7 },
    { re: /^numero\s+do\s+assento:\s*(.+)$/i, field: 'Numero do Assento', conf: 0.7 },
    { re: /^nome(?:\s+completo)?:\s*(.+)$/i, field: 'Nome Completo', conf: 0.9 },
    { re: /^comunidade:\s*(.+)$/i, field: 'Comunidade', conf: 0.8 },
    { re: /^data\s+de\s+nascimento:\s*(.+)$/i, field: 'Data de Nascimento', conf: 0.8 },
    { re: /^data\s+de\s+baptismo:\s*(.+)$/i, field: 'Data de Baptismo', conf: 0.8 },
    { re: /^naturalidade:\s*(.+)$/i, field: 'Naturalidade', conf: 0.75 },
    { re: /^nome\s+do\s+pai:\s*(.+)$/i, field: 'Nome do Pai', conf: 0.7 },
    { re: /^naturalidade\s+do\s+pai:\s*(.+)$/i, field: 'Naturalidade do Pai', conf: 0.65 },
    { re: /^estado\s+civil:\s*(.+)$/i, field: 'Estado Civil', conf: 0.6 },
    { re: /^profiss[aã]o:\s*(.+)$/i, field: 'Profissao', conf: 0.6 },
    { re: /^nome\s+da\s+mae:\s*(.+)$/i, field: 'Nome da Mae', conf: 0.7 },
    { re: /^avos\s+paternos:\s*(.+)$/i, field: 'Avos Paternos', conf: 0.55 },
    { re: /^avos\s+maternos:\s*(.+)$/i, field: 'Avos Maternos', conf: 0.55 },
    { re: /^padrinho:\s*(.+)$/i, field: 'Nome do Padrinho', conf: 0.7 },
    { re: /^estado\s+civil\s+do\s+padrinho:\s*(.+)$/i, field: 'Estado Civil.1', conf: 0.6 },
    { re: /^profiss[aã]o\s+do\s+padrinho:\s*(.+)$/i, field: 'Profissao.1', conf: 0.55 },
    { re: /^madrinha:\s*(.+)$/i, field: 'Nome da Madrinha', conf: 0.7 },
    { re: /^estado\s+civil\s+da\s+madrinha:\s*(.+)$/i, field: 'Estado Civil da Madrinha', conf: 0.6 },
    { re: /^profiss[aã]o\s+da\s+madrinha:\s*(.+)$/i, field: 'Profisssao da Madrinha', conf: 0.55 },
    { re: /^residencia\s+da\s+madrinha:\s*(.+)$/i, field: 'Residencia da Madrinha', conf: 0.6 },
    { re: /^residencia:\s*(.+)$/i, field: 'Residencia', conf: 0.6 },
    { re: /^observa[cç][oõ]es?:\s*(.+)$/i, field: 'Observacoes', conf: 0.55 },
  ]

  for (const line of lines) {
    for (const m of mapping) {
      const match = line.match(m.re)
      if (!match) continue
      member[m.field] = normalizeValue(match[1] ?? '')
      confidence[m.field] = m.conf
    }
  }

  for (const f of CANONICAL_FIELDS) {
    if (confidence[f] != null) continue
    confidence[f] = member[f] ? 0.55 : 0.2
  }

  return { member, confidence, transcript: String(text || '') }
}

export function OcrSim() {
  const { members, addMember, updateMemberByKey, addLog } = useAppData()
  const { session } = useAuth()

  const [mode, setMode] = useState('bi') // 'bi' | 'assento'
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)         // assento OU BI frente (legacy)
  const [imageBack, setImageBack] = useState(null) // BI verso
  const [draft, setDraft] = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [validation, setValidation] = useState(null)
  const [regions, setRegions] = useState({})
  const [pageMeta, setPageMeta] = useState(null)
  const [aiInfo, setAiInfo] = useState(null)
  const [useAi, setUseAi] = useState(true)
  const [autoCrop, setAutoCrop] = useState(true)
  const [croppedFront, setCroppedFront] = useState(null) // data URL
  const [croppedBack, setCroppedBack] = useState(null)
  const [highlight, setHighlight] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)

  const steps = [
    {
      label: 'A enviar imagem',
      svg: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
      ),
    },
    {
      label: 'A recortar documento',
      svg: (
        <>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.12 8.12L20 20M8.12 15.88L20 4" />
        </>
      ),
    },
    {
      label: 'A detectar campos',
      svg: (
        <>
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
        </>
      ),
    },
    {
      label: 'A interpretar com IA',
      svg: (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" />
          <rect x="7" y="7" width="10" height="10" rx="2" />
        </>
      ),
    },
    {
      label: 'A validar dados',
      svg: (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </>
      ),
    },
  ]

  const REQUIRED_HIGHLIGHT = ['Nome Completo', 'Data de Nascimento', 'Naturalidade']

  // Ordena os campos para mostrar primeiro os que o OCR/IA conseguiu preencher,
  // depois os obrigatórios em falta, depois os restantes — mantendo a ordem
  // canónica dentro de cada grupo.
  const orderedFields = useMemo(() => {
    if (!draft) return CANONICAL_FIELDS
    const filled = []
    const requiredEmpty = []
    const rest = []
    for (const f of CANONICAL_FIELDS) {
      const value = String(draft[f] ?? '').trim()
      if (value) filled.push(f)
      else if (REQUIRED_HIGHLIGHT.includes(f)) requiredEmpty.push(f)
      else rest.push(f)
    }
    return [...filled, ...requiredEmpty, ...rest]
  }, [draft])

  const possibleDuplicate = useMemo(() => {
    if (!draft) return null
    const key = makeMemberKey(draft)
    return members.find((m) => makeMemberKey(m) === key) ?? null
  }, [draft, members])

  const resetAll = () => {
    setDraft(null)
    setConfidence(null)
    setValidation(null)
    setRegions({})
    setPageMeta(null)
    setAiInfo(null)
    setCroppedFront(null)
    setCroppedBack(null)
    setHighlight('')
    setText('')
    setImage(null)
    setImageBack(null)
    setError('')
    setProcessing(false)
    setProcessingStep(0)
  }

  const processFromBackend = async (kind) => {
    if (kind === 'bi' && !image) {
      setError('Carregue a imagem da frente do BI.')
      return
    }
    if (kind === 'assento' && !image) {
      setError('Carregue uma imagem do assento.')
      return
    }
    setProcessing(true)
    setProcessingStep(0)
    setError('')
    const tick = window.setInterval(() => {
      setProcessingStep((s) => Math.min(s + 1, 3))
    }, 500)
    try {
      const res =
        kind === 'bi'
          ? await extractBi({ front: image, back: imageBack, accessToken: session?.accessToken, useAi, crop: autoCrop })
          : await extractAssento(image, session?.accessToken, { useAi, crop: autoCrop })

      const fields = emptyMember()
      const conf = {}
      for (const f of CANONICAL_FIELDS) {
        if (res.fields?.[f] != null) {
          fields[f] = normalizeValue(res.fields[f])
          conf[f] = res.confidence?.[f] ?? 0.5
        } else {
          conf[f] = 0.2
        }
      }
      setDraft(fields)
      setConfidence(conf)
      setValidation(res.validation ?? null)
      setRegions(res.regions ?? {})
      // Para BI dual-face, preferimos a página frontal para overlay.
      setPageMeta(res.pages?.front ?? res.page ?? null)
      setAiInfo(res.ai ?? (res.fields_pre_ai ? { applied: true } : null))
      // Imagens recortadas devolvidas pelo backend (base64)
      const cropFront = kind === 'bi' ? res.crop?.front : res.crop
      const cropBack = kind === 'bi' ? res.crop?.back : null
      setCroppedFront(cropFront?.image_base64 ? `data:image/jpeg;base64,${cropFront.image_base64}` : null)
      setCroppedBack(cropBack?.image_base64 ? `data:image/jpeg;base64,${cropBack.image_base64}` : null)
      setText(res.transcript ?? res.transcript_front ?? '')
      addLog?.(`ocr_${kind}`, `OCR (${kind}) via ${res.engine ?? '?'}.`, { fileName: image?.name || '' })
    } catch (err) {
      setError(`Falha no OCR: ${err.message || err}`)
    } finally {
      window.clearInterval(tick)
      setProcessingStep(4)
      setProcessing(false)
    }
  }

  const runOcr = () => {
    setError('')
    setValidation(null)
    if (processing) return

    if (mode === 'bi') return processFromBackend('bi')

    // Modo assento: imagem → backend; texto → parser local (offline).
    if (image) return processFromBackend('assento')

    if (!text.trim()) {
      setError('Carregue uma imagem ou cole o texto do assento.')
      return
    }
    const result = parseLooseText(text)
    setDraft(result.member)
    setConfidence(result.confidence)
    addLog?.('ocr_text', 'Pre-preenchimento por OCR (texto).', { hasImage: false })
  }

  const onConfirmCreate = async () => {
    setError('')
    if (mode === 'bi') {
      // Revalida no backend antes de gravar (check de confirmação)
      const check = await confirmBi(normalizeMember(draft), session?.accessToken)
      setValidation(check.validation ?? null)
      if (!check.ok) {
        setError('Os dados ainda têm erros. Reveja antes de gravar.')
        return
      }
    }
    const res = await addMember(normalizeMember(draft))
    if (!res?.ok) return
    addLog?.('ocr_save', 'Membro criado a partir de OCR.', { duplicate: Boolean(possibleDuplicate), mode })
    resetAll()
  }

  const onConfirmUpdate = () => {
    const normalized = normalizeMember(draft)
    if (!possibleDuplicate) return
    updateMemberByKey(makeMemberKey(possibleDuplicate), normalized)
    addLog?.('ocr_update', 'Membro atualizado a partir de OCR.', {})
    resetAll()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 page-fade">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm slide-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Digitalizacao (OCR)</div>
            <div className="mt-1 text-sm text-gray-600">
              {mode === 'bi'
                ? 'Carregue uma imagem do Bilhete de Identidade. O OCR é feito no servidor.'
                : 'Carregue uma imagem ou cole texto do assento de baptismo (simulado).'}
            </div>
          </div>
          <Badge tone={mode === 'bi' ? 'green' : 'blue'}>{mode === 'bi' ? 'BI (real)' : 'Assento (simulado)'}</Badge>
        </div>

        <div className="mt-4 inline-flex rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => { setMode('bi'); resetAll() }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === 'bi' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Bilhete de Identidade
          </button>
          <button
            type="button"
            onClick={() => { setMode('assento'); resetAll() }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === 'assento' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Assento de Baptismo
          </button>
        </div>

        <div className="mt-4">
          {mode === 'bi' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DropZone
                label="Frente do BI"
                hint="Arraste ou clique para carregar"
                file={image}
                onFile={setImage}
                accent="indigo"
              />
              <DropZone
                label="Verso do BI"
                hint="Recomendado (filiação completa)"
                file={imageBack}
                onFile={setImageBack}
                accent="emerald"
              />
            </div>
          ) : (
            <DropZone
              label="Assento de baptismo"
              hint="Foto nítida do livro paroquial"
              file={image}
              onFile={setImage}
              accent="indigo"
            />
          )}

          <div className="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoCrop}
                  onChange={(e) => setAutoCrop(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <span>Auto-recortar documento (BI / A4)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useAi}
                  onChange={(e) => setUseAi(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <span>Refinar com IA (Moçambique · Sta. Teresinha)</span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={resetAll} disabled={processing && !draft}>Limpar</Button>
              <Button variant="primary" onClick={runOcr} disabled={processing} loading={processing}>
                {processing ? 'A processar' : 'Gerar rascunho'}
              </Button>
            </div>
          </div>
        </div>

        {processing ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5 slide-up">
            <div className="flex items-center gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md pulse-ring">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 3H5a2 2 0 00-2 2v2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 3h2a2 2 0 012 2v2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 17v2a2 2 0 01-2 2h-2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 17v2a2 2 0 002 2h2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h10" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">Processamento OCR</div>
                <div className="mt-0.5 text-sm text-gray-600">
                  {steps[Math.min(processingStep, steps.length - 1)].label}
                </div>
              </div>
              <span className="dot-bounce text-indigo-600">
                <span/><span/><span/><span/><span/>
              </span>
            </div>
            <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {steps.map((s, i) => {
                const done = i < processingStep
                const active = i === processingStep
                return (
                  <li
                    key={i}
                    className={[
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-xs ring-1 ring-inset transition-all',
                      done ? 'bg-green-50 text-green-800 ring-green-200' :
                      active ? 'bg-indigo-600 text-white ring-indigo-600 shadow-sm scale-[1.02]' :
                      'bg-white text-gray-500 ring-gray-200',
                    ].join(' ')}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      {done ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                      ) : (
                        s.svg
                      )}
                    </svg>
                    <span className="truncate font-medium">{s.label}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        ) : null}

        {(image || imageBack) ? (
          <div className={[
            'mt-5 grid gap-4',
            mode === 'bi' && imageBack ? 'lg:grid-cols-2' : 'grid-cols-1',
          ].join(' ')}>
            {image ? (
              <div className={[
                'space-y-2',
                mode === 'assento' ? 'mx-auto w-full max-w-3xl text-center' : '',
              ].join(' ')}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-600">{mode === 'bi' ? 'Frente — campos detectados' : 'Imagem — campos detectados'}</div>
                  {croppedFront ? <Badge tone="green">recortado</Badge> : null}
                </div>
                <ImagePreview
                  src={croppedFront || image}
                  page={pageMeta}
                  regions={regions}
                  highlight={highlight}
                  onSelect={(k) => setHighlight(k)}
                  scanning={processing}
                />
              </div>
            ) : null}
            {mode === 'bi' && imageBack ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-600">Verso</div>
                  {croppedBack ? <Badge tone="green">recortado</Badge> : null}
                </div>
                <ImagePreview src={croppedBack || imageBack} page={null} regions={{}} scanning={processing} />
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === 'assento' ? (
          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Texto para leitura (opcional)</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={`Exemplo:\nNome Completo: Maria Joao\nComunidade: Liqueleva\nData de Nascimento: 2001-05-07\nData de Baptismo: 2010-06-12\nNumero do Assento: 12/2010`}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
        ) : null}

        {validation && (validation.errors?.length || validation.warnings?.length) ? (
          <div className="mt-3 space-y-2">
            {validation.errors?.length ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <div className="font-semibold">Erros</div>
                <ul className="mt-1 list-disc pl-5">
                  {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            ) : null}
            {validation.warnings?.length ? (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                <div className="font-semibold">Avisos</div>
                <ul className="mt-1 list-disc pl-5">
                  {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      </div>

      {draft && confidence ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2 slide-up">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-gray-900">Campos extraídos</div>
              <div className="flex flex-wrap gap-1">
                {aiInfo ? <Badge tone="purple">refinado com IA</Badge> : null}
                <Badge tone={possibleDuplicate ? 'yellow' : 'green'}>{possibleDuplicate ? 'possível duplicado' : 'novo'}</Badge>
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Clique num campo para destacar a sua localização na imagem.
              {aiInfo?.notes ? <span className="ml-1 italic">IA: {aiInfo.notes}</span> : null}
            </div>
            {(() => {
              const filledCount = orderedFields.filter((f) => String(draft[f] ?? '').trim()).length
              const renderField = (f) => {
                const hasRegion = Boolean(regions?.[f]?.polygon)
                const value = draft[f] ?? ''
                const isRequired = REQUIRED_HIGHLIGHT.includes(f)
                const isMissing = isRequired && !String(value).trim()
                const conf = confidence?.[f] ?? 0
                return (
                  <label key={f} className="block" onClick={() => hasRegion && setHighlight(f)}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-600">
                        {getFieldLabel(f)}
                        {isRequired ? <span className="ml-0.5 text-red-500">*</span> : null}
                        {hasRegion ? <span className="ml-1 text-indigo-500">●</span> : null}
                      </span>
                      <span className={`text-[10px] font-semibold ${conf >= 0.7 ? 'text-green-600' : conf >= 0.4 ? 'text-yellow-600' : 'text-gray-400'}`}>
                        {Math.round(conf * 100)}%
                      </span>
                    </div>
                    <input
                      value={value}
                      onFocus={() => hasRegion && setHighlight(f)}
                      onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                      placeholder={isRequired ? 'obrigatório' : ''}
                      className={[
                        'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2',
                        isMissing
                          ? 'border-red-400 bg-red-50/50 focus:ring-red-400/30 pulse-red'
                          : highlight === f
                            ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                            : 'border-gray-300 focus:border-indigo-600 focus:ring-indigo-600/20',
                      ].join(' ')}
                    />
                  </label>
                )
              }
              const filled = orderedFields.slice(0, filledCount)
              const empty = orderedFields.slice(filledCount)
              return (
                <>
                  {filled.length ? (
                    <>
                      <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-green-700">
                        <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                        Detectados ({filled.length})
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {filled.map(renderField)}
                      </div>
                    </>
                  ) : null}
                  {empty.length ? (
                    <>
                      <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
                        Em falta ({empty.length})
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {empty.map(renderField)}
                      </div>
                    </>
                  ) : null}
                </>
              )
            })()}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:sticky xl:top-20 xl:self-start slide-up">
            <div className="text-sm font-semibold text-gray-900">Revisão</div>
            <div className="mt-2 text-xs text-gray-500">Criar ou actualizar com base no duplicado detectado.</div>

            <div className={`mt-4 rounded-xl p-4 ring-1 ring-inset transition ${possibleDuplicate ? 'bg-yellow-50 ring-yellow-200' : 'bg-gray-50 ring-gray-200'}`}>
              <div className="text-sm font-medium text-gray-900">
                {possibleDuplicate ? 'Possível duplicado' : 'Sem duplicados'}
              </div>
              <div className="mt-1 text-sm text-gray-700">
                {possibleDuplicate ? possibleDuplicate['Nome Completo'] : 'Nenhum membro com a mesma chave foi encontrado.'}
              </div>
            </div>

            {!normalizeValue(draft?.['Nome Completo']) ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                Preencha pelo menos o <strong>Nome Completo</strong> para gravar.
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-2">
              <Button variant={possibleDuplicate ? 'default' : 'primary'} onClick={onConfirmCreate} disabled={!normalizeValue(draft?.['Nome Completo'])} className="w-full justify-center">
                Criar membro
              </Button>
              <Button variant={possibleDuplicate ? 'primary' : 'default'} onClick={onConfirmUpdate} disabled={!possibleDuplicate} className="w-full justify-center">
                Actualizar existente
              </Button>
              <Button onClick={resetAll} className="w-full justify-center">Limpar</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
