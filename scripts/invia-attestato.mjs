#!/usr/bin/env node
// Uso: WEBHOOK_SECRET=<secret> node scripts/invia-attestato.mjs
// oppure: node scripts/invia-attestato.mjs (se WEBHOOK_SECRET è già in env)

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
if (!WEBHOOK_SECRET) {
  console.error('❌  WEBHOOK_SECRET non impostato. Esegui:')
  console.error('    WEBHOOK_SECRET=<secret> node scripts/invia-attestato.mjs')
  process.exit(1)
}

const payload = {
  corso_id: '008fa30e-949e-4793-819a-577889260314',
  attestato_nome: 'Denise',
  attestato_cognome: 'Cassarino',
  attestato_email: 'denise.cassarino@gmail.com',
}

console.log('→ Invio richiesta a /api/attestati/genera')
console.log('  payload:', JSON.stringify(payload, null, 2))
console.log()

const res = await fetch('https://formascuole.vercel.app/api/attestati/genera', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-secret': WEBHOOK_SECRET,
  },
  body: JSON.stringify(payload),
})

const text = await res.text()
let json
try { json = JSON.parse(text) } catch { json = text }

if (res.ok) {
  console.log('✅  Successo:', res.status)
  console.log(JSON.stringify(json, null, 2))
} else {
  console.error('❌  Errore:', res.status, res.statusText)
  console.error(JSON.stringify(json, null, 2))
  process.exit(1)
}
