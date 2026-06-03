import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BenvenutoEmailParams {
  nome: string
  email: string
  password: string
}

interface AssegnazioneEmailParams {
  formatore_nome: string
  formatore_email: string
  corso_title: string
  school_name: string
  ref_name: string
  ref_email: string
  accetta_url?: string
  rifiuta_url?: string
  ore_totali?: number
  tipo?: string
}

interface SollecitoEmailParams extends Omit<AssegnazioneEmailParams, 'accetta_url' | 'rifiuta_url' | 'ore_totali' | 'tipo'> {
  numero_sollecito: 1 | 2 | 3
  giorni_passati: number
}

interface ReminderSessioneEmailParams {
  formatore_nome: string
  formatore_email: string
  corso_title: string
  school_name: string
  data_sessione: string
  ore_sessione: number
  corso_url: string
}

interface SollecitoAccettazioneEmailParams {
  formatore_nome: string
  corso_title: string
  school_name: string
  ore_rimanenti: number
  accetta_url: string
  rifiuta_url: string
}

interface RispostaFormatoreEmailParams {
  formatore_nome: string
  corso_title: string
  school_name: string
  risposta: 'accettato' | 'rifiutato'
  motivazione?: string
  corso_admin_url: string
}

interface ReminderQuestionarioEmailParams {
  formatore_nome: string
  corso_title: string
  school_name: string
  questionario_url: string
}

interface CandidaturaDisponibileEmailParams {
  formatore_nome: string
  corso_title: string
  tipo: string
  school_name: string
  ore_totali: number
  corso_url: string
}

interface CandidaturaRingraziamentoEmailParams {
  formatore_nome: string
  corso_title: string
  school_name: string
}

interface ModificaSessioneEmailParams {
  formatore_nome: string
  corso_title: string
  school_name: string
  data_precedente?: string
  data_nuova?: string
  ore_precedenti?: number
  ore_nuove?: number
  motivazione_categoria: string
  motivazione_dettaglio?: string
  corso_admin_url: string
}

interface EmailAction {
  label: string
  url: string
  primary?: boolean
}

// ─── Shared blocks ────────────────────────────────────────────────────────────

function pwaInstallBlock(): string {
  return `
---

📱 INSTALLA L'APP SUL TUO TELEFONO

iPhone/iPad:
1. Apri Safari e vai su ${APP_URL}
2. Tocca l'icona Condividi (quadrato con freccia)
3. Scorri e tocca "Aggiungi a schermata Home"
4. Tocca "Aggiungi"

Android:
1. Apri Chrome e vai su ${APP_URL}
2. Tocca i tre puntini in alto a destra
3. Tocca "Aggiungi a schermata Home"
4. Tocca "Aggiungi"

L'app apparirà sulla tua schermata home come una normale app!

---`
}

// ─── Fallback template helpers ────────────────────────────────────────────────

function fallbackAssegnazioneEmail(p: AssegnazioneEmailParams): string {
  const hasAccettazione = !!(p.accetta_url && p.rifiuta_url)
  if (hasAccettazione) {
    return `Gentile ${p.formatore_nome},

hai ricevuto un nuovo incarico di formazione.

Corso: ${p.corso_title}${p.tipo ? ` (${p.tipo})` : ''}
Scuola: ${p.school_name}
${p.ore_totali ? `Ore totali: ${p.ore_totali}h` : ''}
Referente scolastico: ${p.ref_name} — ${p.ref_email}

Hai 24 ore per accettare o rifiutare l'incarico tramite i link seguenti.
In assenza di risposta entro 48 ore il corso verrà riassegnato ad altro formatore.

Grazie,
Il team Formascuole`
  }

  return `Gentile ${p.formatore_nome},

ti è stato assegnato il corso "${p.corso_title}" presso ${p.school_name}.
${p.ore_totali ? `\nOre totali: ${p.ore_totali}h` : ''}
Referente scolastico: ${p.ref_name} — ${p.ref_email}

Ti invitiamo a contattare il referente per concordare il calendario delle sessioni e inserirlo in piattaforma.

Accedi qui: ${APP_URL}/formatore

Grazie,
Il team Formascuole`
}

function fallbackSollecitoEmail(p: SollecitoEmailParams): string {
  const urgenza = p.numero_sollecito === 1
    ? 'ti ricordiamo'
    : p.numero_sollecito === 2
      ? 'ti ricordiamo con urgenza'
      : 'ti ricordiamo per l\'ultima volta'

  return `Gentile ${p.formatore_nome},

${urgenza} che il calendario del corso "${p.corso_title}" presso ${p.school_name} non è ancora completo.

Sono trascorsi ${p.giorni_passati} giorni dall'assegnazione senza che il calendario sia stato inserito.
${p.numero_sollecito === 3 ? '\nATTENZIONE: questo è l\'ultimo sollecito automatico. La questione verrà segnalata all\'amministrazione.\n' : ''}
Accedi alla piattaforma per completare la pianificazione: ${APP_URL}/formatore

Referente scolastico: ${p.ref_name} — ${p.ref_email}

Grazie,
Il team Formascuole`
}

function fallbackReminderSessioneEmail(p: ReminderSessioneEmailParams): string {
  return `Gentile ${p.formatore_nome},

ti ricordiamo di confermare la sessione del ${p.data_sessione} (${p.ore_sessione}h) per il corso "${p.corso_title}" presso ${p.school_name}.

Accedi qui per segnare la sessione come completata: ${p.corso_url}

Grazie,
Il team Formascuole`
}

function fallbackSollecitoAccettazioneEmail(p: SollecitoAccettazioneEmailParams): string {
  return `Gentile ${p.formatore_nome},

ti ricordiamo che devi ancora rispondere all'assegnazione del corso "${p.corso_title}" presso ${p.school_name}.

Hai ${p.ore_rimanenti} ore rimaste per accettare o rifiutare l'incarico.
In assenza di risposta il corso verrà riassegnato ad altro formatore.

Grazie,
Il team Formascuole`
}

function fallbackCandidaturaDisponibileEmail(p: CandidaturaDisponibileEmailParams): string {
  return `Gentile ${p.formatore_nome},

è disponibile un nuovo corso per cui puoi candidarti:

Corso: ${p.corso_title}
Tipo: ${p.tipo}
Scuola: ${p.school_name}
Ore: ${p.ore_totali}h

Hai 24 ore per candidarti.
Accedi alla piattaforma per candidarti: ${p.corso_url}

Grazie,
Il team Formascuole`
}

function fallbackCandidaturaRingraziamentoEmail(p: CandidaturaRingraziamentoEmailParams): string {
  return `Gentile ${p.formatore_nome},

ti ringraziamo per esserti candidato al corso "${p.corso_title}" presso ${p.school_name}.

Purtroppo per questo corso è stato selezionato un altro formatore.
Ti terremo in considerazione per le prossime opportunità.

Grazie,
Il team Formascuole`
}

function fallbackReminderQuestionarioEmail(p: ReminderQuestionarioEmailParams): string {
  return `Gentile ${p.formatore_nome},

oggi si conclude il corso "${p.corso_title}" presso ${p.school_name}.

Ricorda di somministrare il questionario di valutazione ai partecipanti prima della fine della sessione.

Link questionario: ${p.questionario_url}

Grazie,
Il team Formascuole`
}

function fallbackRispostaFormatoreEmail(p: RispostaFormatoreEmailParams): string {
  const risposta = p.risposta === 'accettato' ? 'ACCETTATO' : 'RIFIUTATO'
  return `Il formatore ${p.formatore_nome} ha ${risposta} il corso "${p.corso_title}" presso ${p.school_name}.
${p.motivazione ? `\nMotivazione rifiuto: ${p.motivazione}\n` : ''}
Accedi alla scheda corso per ulteriori dettagli: ${p.corso_admin_url}

Il team Formascuole`
}

// ─── Generators ───────────────────────────────────────────────────────────────

export function generateBenvenutoEmail({ nome, email, password }: BenvenutoEmailParams): string {
  return `Gentile ${nome},

il tuo account sulla piattaforma Formascuole è stato creato con successo.

Di seguito trovi le tue credenziali di accesso:

  Email:    ${email}
  Password: ${password}

Accedi alla piattaforma cliccando sul seguente link:
${APP_URL}

ISTRUZIONI PER IL PRIMO ACCESSO:
1. Vai su ${APP_URL}
2. Inserisci email e password indicati sopra
3. Nella sezione "Il mio account" cambia immediatamente la password con una di tua scelta (minimo 8 caratteri)

Ti consigliamo di conservare queste credenziali in modo sicuro e di non condividerle con nessuno.

In caso di problemi di accesso, contatta il tuo amministratore di sistema.
${pwaInstallBlock()}

Benvenuto/a nel team Formascuole!

Cordiali saluti,
Il team Formascuole`
}

export function generateReinvioCredenzialiEmail({ nome, email, password }: BenvenutoEmailParams): string {
  return `Gentile ${nome},

le tue credenziali di accesso alla piattaforma Formascuole sono state aggiornate.

  Email:    ${email}
  Password: ${password}

Accedi qui: ${APP_URL}

Ti consigliamo di cambiare la password al primo accesso dalla sezione "Il mio account".
${pwaInstallBlock()}

Cordiali saluti,
Il team Formascuole`
}

export function generateAdminBenvenutoEmail({ nome, email, password }: BenvenutoEmailParams): string {
  return `Gentile ${nome},

il tuo account amministratore è stato creato sulla piattaforma Formascuole.

Le tue credenziali di accesso:
- Email: ${email}
- Password temporanea: ${password}

Accedi qui: ${APP_URL}

Ti consigliamo di cambiare la password al primo accesso tramite la sezione "Il mio account".

Grazie,
Il team Formascuole`
}

export async function generateAssegnazioneEmail(params: AssegnazioneEmailParams): Promise<string> {
  const hasAccettazione = !!(params.accetta_url && params.rifiuta_url)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Genera un'email professionale e cordiale in italiano per un formatore appena assegnato a un corso.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}${params.tipo ? ` (${params.tipo})` : ''}
- Ore totali: ${params.ore_totali || '—'}h
- Nome scuola: ${params.school_name}
- Nome referente scolastico: ${params.ref_name}
- Email referente: ${params.ref_email}
- Link piattaforma: ${APP_URL}/formatore
${hasAccettazione ? `- Scadenza risposta: 24 ore
- Link accettazione: ${params.accetta_url}
- Link rifiuto: ${params.rifiuta_url}` : ''}

L'email deve:
1. Salutare il formatore per nome
2. Comunicare l'assegnazione al corso specificato presso la scuola
3. Indicare le ore totali del corso
4. Fornire i contatti del referente scolastico (nome ed email)
${hasAccettazione ? `5. Chiedere di accettare o rifiutare l'incarico entro 24 ore tramite i link indicati
6. Precisare che in caso di mancata risposta entro 48 ore il corso verrà riassegnato` : `5. Chiedere di contattare il referente per concordare le date delle sessioni
6. Invitare ad inserire il calendario nella piattaforma`}
7. Chiudere con un saluto professionale

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email). Tono: professionale ma caldo.`,
        },
      ],
    })
    return (message.content[0] as { type: string; text: string }).text
  } catch (err) {
    console.error('[email] Anthropic API non disponibile, uso testo predefinito per assegnazione:', err)
    return fallbackAssegnazioneEmail(params)
  }
}

export async function generateSollecitoEmail(params: SollecitoEmailParams): Promise<string> {
  const toni = {
    1: 'cordiale e di promemoria',
    2: 'più urgente e diretto',
    3: 'molto urgente, chiedendo conferma immediata',
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Genera un sollecito email numero ${params.numero_sollecito} (tono: ${toni[params.numero_sollecito]}) in italiano per un formatore che non ha ancora inserito il calendario del corso.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}
- Nome scuola: ${params.school_name}
- Referente scolastico: ${params.ref_name} (${params.ref_email})
- Giorni trascorsi dall'assegnazione: ${params.giorni_passati}
- Link piattaforma: ${APP_URL}/formatore
- Numero sollecito: ${params.numero_sollecito} di 3

L'email deve ricordare al formatore di inserire il calendario delle sessioni nella piattaforma.
${params.numero_sollecito === 3 ? 'Segnala che questo è l\'ultimo sollecito automatico e che la questione verrà segnalata all\'amministrazione.' : ''}

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email).`,
        },
      ],
    })
    return (message.content[0] as { type: string; text: string }).text
  } catch (err) {
    console.error('[email] Anthropic API non disponibile, uso testo predefinito per sollecito:', err)
    return fallbackSollecitoEmail(params)
  }
}

export async function generateReminderSessioneEmail(params: ReminderSessioneEmailParams): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Genera un breve reminder email in italiano per un formatore che deve confermare una sessione svoltasi ieri.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}
- Nome scuola: ${params.school_name}
- Data sessione: ${params.data_sessione}
- Ore sessione: ${params.ore_sessione}h
- Link scheda corso: ${params.corso_url}

L'email deve:
1. Salutare il formatore per nome
2. Ricordare che la sessione del [data] di [ore]h si è svolta ieri
3. Chiedere di accedere alla piattaforma e segnare la sessione come "Completata"
4. Fornire il link diretto alla scheda corso
5. Essere breve e diretta (max 5 righe di corpo)

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email).`,
        },
      ],
    })
    return (message.content[0] as { type: string; text: string }).text
  } catch (err) {
    console.error('[email] Anthropic API non disponibile, uso testo predefinito per reminder sessione:', err)
    return fallbackReminderSessioneEmail(params)
  }
}

export async function generateSollecitoAccettazioneEmail(params: SollecitoAccettazioneEmailParams): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `Genera un sollecito email urgente in italiano per un formatore che non ha ancora risposto all'assegnazione di un corso.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}
- Nome scuola: ${params.school_name}
- Ore rimanenti per rispondere: ${params.ore_rimanenti}
- Link accettazione: ${params.accetta_url}
- Link rifiuto: ${params.rifiuta_url}

L'email deve:
1. Ricordare urgentemente che deve accettare o rifiutare l'incarico
2. Specificare che ha ${params.ore_rimanenti} ore rimaste per rispondere
3. Avvertire che in mancanza di risposta il corso verrà riassegnato ad altro formatore
4. Fornire entrambi i link (accetta/rifiuta) in modo chiaro
5. Essere breve e diretta

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email).`,
        },
      ],
    })
    return (message.content[0] as { type: string; text: string }).text
  } catch (err) {
    console.error('[email] Anthropic API non disponibile, uso testo predefinito per sollecito accettazione:', err)
    return fallbackSollecitoAccettazioneEmail(params)
  }
}

export async function generateRispostaFormatoreEmail(params: RispostaFormatoreEmailParams): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `Genera un'email di notifica in italiano per gli amministratori di Formascuole, comunicando la risposta di un formatore all'assegnazione di un corso.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}
- Nome scuola: ${params.school_name}
- Risposta: ${params.risposta === 'accettato' ? 'ACCETTATO' : 'RIFIUTATO'}
${params.motivazione ? `- Motivazione rifiuto: ${params.motivazione}` : ''}
- Link scheda corso: ${params.corso_admin_url}

L'email deve:
1. Comunicare chiaramente che il formatore ha ${params.risposta === 'accettato' ? 'accettato' : 'rifiutato'} il corso
${params.risposta === 'rifiutato' && params.motivazione ? '2. Riportare la motivazione fornita dal formatore\n3. Suggerire di riassegnare il corso ad altro formatore' : '2. Invitare a verificare la scheda corso'}
${params.risposta === 'rifiutato' ? '4.' : '3.'} Fornire il link alla scheda corso
5. Essere concisa e informativa

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email).`,
        },
      ],
    })
    return (message.content[0] as { type: string; text: string }).text
  } catch (err) {
    console.error('[email] Anthropic API non disponibile, uso testo predefinito per risposta formatore:', err)
    return fallbackRispostaFormatoreEmail(params)
  }
}

export async function generateCandidaturaDisponibileEmail(params: CandidaturaDisponibileEmailParams): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Genera un'email professionale e motivante in italiano per invitare un formatore a candidarsi per un nuovo corso disponibile.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}
- Tipo corso: ${params.tipo}
- Nome scuola: ${params.school_name}
- Ore totali: ${params.ore_totali}h
- Link candidatura: ${params.corso_url}

L'email deve:
1. Salutare il formatore per nome
2. Comunicare che è disponibile un nuovo corso per cui può candidarsi
3. Riportare i dettagli del corso (titolo, tipo, scuola, ore)
4. Precisare che ha 24 ore per candidarsi
5. Invitare ad accedere alla piattaforma tramite il link
6. Essere breve e diretta, tono professionale

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email).`,
      }],
    })
    return (message.content[0] as { type: string; text: string }).text
  } catch (err) {
    console.error('[email] Anthropic API non disponibile, uso testo predefinito per candidatura disponibile:', err)
    return fallbackCandidaturaDisponibileEmail(params)
  }
}

export async function generateCandidaturaRingraziamentoEmail(params: CandidaturaRingraziamentoEmailParams): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Genera un'email breve e gentile in italiano per ringraziare un formatore che si è candidato per un corso ma non è stato selezionato.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}
- Nome scuola: ${params.school_name}

L'email deve:
1. Ringraziare il formatore per la candidatura
2. Comunicare con tatto che per questo corso è stato selezionato un altro formatore
3. Assicurare che verrà considerato per future opportunità
4. Essere breve (max 4 righe di corpo), tono cordiale e rispettoso

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email).`,
      }],
    })
    return (message.content[0] as { type: string; text: string }).text
  } catch (err) {
    console.error('[email] Anthropic API non disponibile, uso testo predefinito per candidatura ringraziamento:', err)
    return fallbackCandidaturaRingraziamentoEmail(params)
  }
}

export async function generateReminderQuestionarioEmail(params: ReminderQuestionarioEmailParams): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `Genera un reminder email breve e cordiale in italiano per un formatore che oggi tiene l'ultima sessione di un corso e deve somministrare il questionario di valutazione.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}
- Nome scuola: ${params.school_name}
- Link questionario: ${params.questionario_url}

L'email deve:
1. Salutare il formatore per nome
2. Ricordare che oggi si conclude il corso presso la scuola
3. Chiedere di somministrare il questionario di valutazione ai partecipanti prima della fine della sessione
4. Indicare il link al questionario (che precompila automaticamente i dati del corso)
5. Precisare che in allegato c'è il QR code per la compilazione rapida
6. Essere breve (max 6 righe di corpo), tono cordiale e professionale

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email).`,
        },
      ],
    })
    return (message.content[0] as { type: string; text: string }).text
  } catch (err) {
    console.error('[email] Anthropic API non disponibile, uso testo predefinito per reminder questionario:', err)
    return fallbackReminderQuestionarioEmail(params)
  }
}

export async function sendQuestionarioReminderEmail({
  to,
  subject,
  body,
  questionario_url,
  qrDataUrl,
}: {
  to: string
  subject: string
  body: string
  questionario_url: string
  qrDataUrl?: string
}) {
  const qrHtml = qrDataUrl
    ? `<div style="margin-top:24px;text-align:center;">
        <p style="font-size:13px;color:#6b7280;margin-bottom:8px;">QR code da mostrare ai partecipanti:</p>
        <img src="${qrDataUrl}" width="180" height="180" alt="QR Code questionario" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;" />
      </div>`
    : ''

  await resend.emails.send({
    from: 'Formascuole <noreply@formascuole.it>',
    to,
    subject,
    text: body + `\n\nLink questionario: ${questionario_url}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="margin-bottom:24px;">
        <span style="font-size:20px;font-weight:bold;color:#d64b55;">Formascuole</span>
      </div>
      <div style="white-space:pre-wrap;color:#1a1a1a;line-height:1.6;">${body.replace(/\n/g, '<br/>')}</div>
      <div style="margin-top:20px;">
        <a href="${questionario_url}" style="display:inline-block;padding:10px 22px;background-color:#d64b55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
          Apri questionario
        </a>
      </div>
      ${qrHtml}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
        <p>Formascuole — Piattaforma gestione progetti formativi</p>
        <p><a href="${APP_URL}" style="color:#d64b55;">${APP_URL}</a></p>
      </div>
    </div>`,
  })
}

const MOTIVAZIONE_LABELS: Record<string, string> = {
  richiesta_scuola: 'Richiesta della scuola',
  impegno_formatore: 'Impegno del formatore',
  causa_forza_maggiore: 'Causa di forza maggiore',
  problemi_tecnici_logistici: 'Problemi tecnici/logistici',
  accordo_reciproco: 'Accordo reciproco',
  altro: 'Altro',
}

function fallbackModificaSessioneEmail(p: ModificaSessioneEmailParams): string {
  const changes: string[] = []
  if (p.data_precedente && p.data_nuova) changes.push(`Data: ${p.data_precedente} → ${p.data_nuova}`)
  if (p.ore_precedenti !== undefined && p.ore_nuove !== undefined) changes.push(`Ore: ${p.ore_precedenti}h → ${p.ore_nuove}h`)
  return `Una sessione del corso è stata modificata dal formatore.

Formatore: ${p.formatore_nome}
Corso: ${p.corso_title}
Scuola: ${p.school_name}

Modifiche:
${changes.join('\n')}

Motivazione: ${MOTIVAZIONE_LABELS[p.motivazione_categoria] || p.motivazione_categoria}${p.motivazione_dettaglio ? `\nDettaglio: ${p.motivazione_dettaglio}` : ''}

Scheda corso: ${p.corso_admin_url}`
}

export async function generateModificaSessioneEmail(params: ModificaSessioneEmailParams): Promise<{ subject: string; body: string }> {
  const subject = `Sessione modificata — ${params.corso_title} — ${params.school_name}`
  const changes: string[] = []
  if (params.data_precedente && params.data_nuova) changes.push(`- Data: ${params.data_precedente} → ${params.data_nuova}`)
  if (params.ore_precedenti !== undefined && params.ore_nuove !== undefined) changes.push(`- Ore: ${params.ore_precedenti}h → ${params.ore_nuove}h`)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Genera un'email di notifica breve in italiano per informare gli amministratori che un formatore ha modificato una sessione di un corso.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}
- Nome scuola: ${params.school_name}
- Modifiche effettuate: ${changes.join(', ') || 'aggiornamento sessione'}
- Motivazione: ${MOTIVAZIONE_LABELS[params.motivazione_categoria] || params.motivazione_categoria}${params.motivazione_dettaglio ? ` — ${params.motivazione_dettaglio}` : ''}
- Link scheda corso: ${params.corso_admin_url}

L'email deve:
1. Informare brevemente che il formatore ha modificato una sessione
2. Riportare le modifiche (data/ore precedente → nuova)
3. Indicare la motivazione fornita
4. Fornire il link alla scheda corso per verificare
5. Essere concisa (max 6 righe), tono neutro e professionale

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email).`,
      }],
    })
    return { subject, body: (message.content[0] as { type: string; text: string }).text }
  } catch (err) {
    console.error('[email] Anthropic API non disponibile, uso testo predefinito per modifica sessione:', err)
    return { subject, body: fallbackModificaSessioneEmail(params) }
  }
}

// ─── Calendario Completo ──────────────────────────────────────────────────────

interface CalendarioCompletoParams {
  corso_title: string
  school_name: string
  formatore_nome: string
  ore_totali: number
  finanziamento?: string | null
  corso_url: string
}

export function generateCalendarioCompletoEmail(p: CalendarioCompletoParams): { subject: string; body: string } {
  const subject = `Calendario completo — ${p.corso_title} — ${p.school_name}`
  const body = `Il calendario del corso "${p.corso_title}" presso ${p.school_name} è completo.

Riepilogo:
- Formatore: ${p.formatore_nome}
- Ore totali: ${p.ore_totali}h${p.finanziamento ? `\n- Linea di finanziamento: ${p.finanziamento}` : ''}

Tutte le ${p.ore_totali} ore sono state pianificate.

Grazie,
Il team Formascuole`
  return { subject, body }
}

// ─── Corso Concluso ───────────────────────────────────────────────────────────

interface CorsoConclusoParams {
  corso_title: string
  school_name: string
  formatore_nome: string
  tutor_nome?: string | null
  ore_totali: number
  data_ultima_sessione: string
  finanziamento?: string | null
  corso_url: string
}

function fallbackCorsoConclusoEmail(p: CorsoConclusoParams): string {
  return `Il corso "${p.corso_title}" presso ${p.school_name} è stato completato.

Riepilogo:
- Formatore: ${p.formatore_nome}${p.tutor_nome ? `\n- Tutor: ${p.tutor_nome}` : ''}
- Ore totali: ${p.ore_totali}h
- Data ultima sessione: ${p.data_ultima_sessione}${p.finanziamento ? `\n- Linea di finanziamento: ${p.finanziamento}` : ''}

Accedi alla piattaforma per i dettagli:
${p.corso_url}

Grazie,
Il team Formascuole`
}

export async function generateCorsoConclusoEmail(p: CorsoConclusoParams): Promise<{ subject: string; body: string }> {
  const subject = `Corso concluso — ${p.corso_title} — ${p.school_name}`
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Genera un'email di notifica professionale in italiano per informare il team di pianificazione che un corso è stato completato.

Dati:
- Titolo corso: ${p.corso_title}
- Scuola: ${p.school_name}
- Formatore: ${p.formatore_nome}${p.tutor_nome ? `\n- Tutor: ${p.tutor_nome}` : ''}
- Ore totali: ${p.ore_totali}h
- Data ultima sessione: ${p.data_ultima_sessione}${p.finanziamento ? `\n- Linea di finanziamento: ${p.finanziamento}` : ''}
- Link corso: ${p.corso_url}

Struttura richiesta:
"Il corso [titolo] presso [scuola] è stato completato.

Riepilogo:
- Formatore: [nome]
[- Tutor: [nome] solo se presente]
- Ore totali: [ore]h
- Data ultima sessione: [data]
[- Linea di finanziamento: [nome] solo se presente]

Accedi alla piattaforma per i dettagli:
[link]"

Rispondi SOLO con il corpo dell'email in testo semplice. Tono professionale.`,
      }],
    })
    return { subject, body: (message.content[0] as { type: string; text: string }).text }
  } catch (err) {
    console.error('[email] Anthropic non disponibile, fallback corso concluso:', err)
    return { subject, body: fallbackCorsoConclusoEmail(p) }
  }
}

// ─── Sender ───────────────────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  body,
  actions,
}: {
  to: string
  subject: string
  body: string
  actions?: EmailAction[]
}) {
  const actionsHtml = actions?.length
    ? `<div style="margin-top: 28px; display: flex; gap: 12px; flex-wrap: wrap;">
        ${actions.map(a => `
          <a href="${a.url}" style="display: inline-block; padding: 10px 22px; background-color: ${a.primary ? '#d64b55' : '#f3f4f6'}; color: ${a.primary ? '#ffffff' : '#374151'}; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; font-family: system-ui, sans-serif;">
            ${a.label}
          </a>`).join('')}
      </div>`
    : ''

  const actionsText = actions?.length
    ? '\n\n' + actions.map(a => `${a.label}: ${a.url}`).join('\n')
    : ''

  await resend.emails.send({
    from: 'Formascuole <noreply@formascuole.it>',
    to,
    subject,
    text: body + actionsText,
    html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: bold; color: #d64b55;">Formascuole</span>
      </div>
      <div style="white-space: pre-wrap; color: #1a1a1a; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>
      ${actionsHtml}
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
        <p>Formascuole — Piattaforma gestione progetti formativi</p>
        <p><a href="${APP_URL}" style="color: #d64b55;">${APP_URL}</a></p>
      </div>
    </div>`,
  })
}
