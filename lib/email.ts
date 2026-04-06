import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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
    from: 'FormaScuola <noreply@formascuola.it>',
    to,
    subject,
    text: body,
    html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: bold; color: #d64b55;">FormaScuola</span>
      </div>
      <div style="white-space: pre-wrap; color: #1a1a1a; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
        <p>FormaScuola — Piattaforma gestione progetti formativi</p>
        <p><a href="${APP_URL}" style="color: #d64b55;">${APP_URL}</a></p>
      </div>
    </div>`,
  })
}
