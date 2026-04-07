import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

interface BenvenutoEmailParams {
  nome: string
  email: string
  password: string
}

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

Benvenuto/a nel team Formascuole!

Cordiali saluti,
Il team Formascuole`
}

interface AssegnazioneEmailParams {
  formatore_nome: string
  formatore_email: string
  corso_title: string
  school_name: string
  ref_name: string
  ref_email: string
}

interface SollecitoEmailParams extends AssegnazioneEmailParams {
  numero_sollecito: 1 | 2 | 3
  giorni_passati: number
}

export async function generateAssegnazioneEmail(params: AssegnazioneEmailParams): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `Genera un'email professionale e cordiale in italiano per un formatore appena assegnato a un corso.

Dati:
- Nome formatore: ${params.formatore_nome}
- Titolo corso: ${params.corso_title}
- Nome scuola: ${params.school_name}
- Nome referente scolastico: ${params.ref_name}
- Email referente: ${params.ref_email}
- Link piattaforma: ${APP_URL}/formatore

L'email deve:
1. Salutare il formatore per nome
2. Comunicare l'assegnazione al corso specificato presso la scuola
3. Fornire i contatti del referente scolastico (nome ed email)
4. Chiedere di contattare il referente per concordare le date delle sessioni
5. Invitare ad inserire il calendario nella piattaforma (link)
6. Chiudere con un saluto professionale

Rispondi SOLO con il corpo dell'email in testo semplice (no HTML, no oggetto email). Tono: professionale ma caldo.`,
      },
    ],
  })

  return (message.content[0] as { type: string; text: string }).text
}

export async function generateSollecitoEmail(params: SollecitoEmailParams): Promise<string> {
  const toni = {
    1: 'cordiale e di promemoria',
    2: 'più urgente e diretto',
    3: 'molto urgente, chiedendo conferma immediata',
  }

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

export async function generateReminderSessioneEmail(params: ReminderSessioneEmailParams): Promise<string> {
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
}

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}) {
  await resend.emails.send({
    from: 'Formascuole <noreply@formascuola.it>',
    to,
    subject,
    text: body,
    html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: bold; color: #d64b55;">Formascuole</span>
      </div>
      <div style="white-space: pre-wrap; color: #1a1a1a; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
        <p>Formascuole — Piattaforma gestione progetti formativi</p>
        <p><a href="${APP_URL}" style="color: #d64b55;">${APP_URL}</a></p>
      </div>
    </div>`,
  })
}
