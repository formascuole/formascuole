// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit')

export interface NotulaData {
  numero: string
  data: string               // "gg/mm/aaaa"
  // Prestatore (formatore)
  formatore_nome: string
  luogo_nascita: string | null
  data_nascita: string | null  // ISO date
  codice_fiscale: string | null
  indirizzo_via: string | null
  indirizzo_cap: string | null
  indirizzo_citta: string | null
  indirizzo_provincia: string | null
  iban: string | null
  banca: string | null
  intestatario_conto: string | null
  // Prestazione
  titolo_corso: string
  school_name: string
  prima_sessione: string | null   // ISO date
  ultima_sessione: string | null  // ISO date
  ore_erogate: number
  tariffa: number
  // Finanziario
  regime: 'notula' | 'forfettario' | 'ordinario'
  rivalsa_iva: boolean
  imponibile: number
  ritenuteIva: number    // negative = ritenuta; positive = IVA
  netto: number
}

export async function generateNotulaPdf(data: NotulaData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 }) // ~2cm margins
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595 - 112  // usable width

    // — HEADER row —
    const titoloDoc = data.regime === 'notula' ? 'RICEVUTA PER PRESTAZIONE OCCASIONALE' : 'DOCUMENTO DI FATTURAZIONE'
    doc.fontSize(9).fillColor('#888').text(titoloDoc, { align: 'center' })
    doc.moveDown(0.3)

    // Ricevuta n. + Data on same row
    const yHeader = doc.y
    doc.fontSize(10).fillColor('#000').font('Helvetica-Bold').text(`Ricevuta n. ${data.numero}`, 56, yHeader)
    doc.font('Helvetica').text(`Data: ${data.data}`, 56, yHeader, { align: 'right', width: W })
    doc.moveDown(1.2)

    // — TWO COLUMN BLOCK: Prestatore | Committente —
    const col1X = 56, col2X = 56 + W / 2 + 10
    const yBlock = doc.y

    // Left: Prestatore
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('PRESTATORE', col1X, yBlock)
    doc.font('Helvetica').fontSize(10).fillColor('#000')
    doc.text(data.formatore_nome, col1X, doc.y + 4)
    if (data.luogo_nascita && data.data_nascita) {
      const dnFormatted = new Date(data.data_nascita).toLocaleDateString('it-IT')
      doc.text(`Nato/a a ${data.luogo_nascita} il ${dnFormatted}`)
    }
    if (data.codice_fiscale) doc.text(`CF: ${data.codice_fiscale}`)
    const addr = [data.indirizzo_via, data.indirizzo_cap && data.indirizzo_citta ? `${data.indirizzo_cap} ${data.indirizzo_citta}` : null, data.indirizzo_provincia ? `(${data.indirizzo_provincia})` : null].filter(Boolean).join(', ')
    if (addr) doc.text(addr)

    // Right: Committente
    const yRight = yBlock
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('COMMITTENTE', col2X, yRight, { width: W / 2 - 10 })
    doc.font('Helvetica').fontSize(10).fillColor('#000')
    doc.text('SVC Consulting Srl', col2X, doc.y + 4, { width: W / 2 - 10 })
    doc.text('Via Antonio Vallisneri 7', col2X, doc.y, { width: W / 2 - 10 })
    doc.text('00197 Roma', col2X, doc.y, { width: W / 2 - 10 })
    doc.text('CF/PI 07142321004', col2X, doc.y, { width: W / 2 - 10 })

    doc.moveDown(2)

    // — DIVIDER —
    doc.moveTo(56, doc.y).lineTo(56 + W, doc.y).strokeColor('#ccc').stroke()
    doc.moveDown(0.8)

    // — TABELLA PRESTAZIONE —
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('DESCRIZIONE PRESTAZIONE', 56, doc.y)
    const yTable = doc.y + 14
    // Header row
    doc.fillColor('#f0f0f0').rect(56, yTable, W, 18).fill()
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#333')
    doc.text('Descrizione', 62, yTable + 4, { width: W - 80 })
    doc.text('Importo', 62 + W - 76, yTable + 4, { width: 70, align: 'right' })

    // Content row
    const periodoStart = data.prima_sessione ? new Date(data.prima_sessione).toLocaleDateString('it-IT') : '—'
    const periodoEnd = data.ultima_sessione ? new Date(data.ultima_sessione).toLocaleDateString('it-IT') : '—'
    const descr = `Prestazione di formazione — ${data.titolo_corso} presso ${data.school_name}\nPeriodo: ${periodoStart} — ${periodoEnd}\nOre erogate: ${data.ore_erogate}h @ € ${data.tariffa.toFixed(2)}/h`
    const yContent = yTable + 22
    doc.font('Helvetica').fontSize(10).fillColor('#000').text(descr, 62, yContent, { width: W - 80 })
    doc.font('Helvetica-Bold').fontSize(10).text(`€ ${data.imponibile.toFixed(2)}`, 62 + W - 76, yContent, { width: 70, align: 'right' })
    doc.moveDown(0.5)
    const yAfterTable = Math.max(doc.y, yContent + 50)
    doc.moveTo(56, yAfterTable).lineTo(56 + W, yAfterTable).strokeColor('#ccc').stroke()

    doc.y = yAfterTable + 14

    // — CALCOLO ECONOMICO —
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('CALCOLO ECONOMICO')
    doc.moveDown(0.5)

    const rightX = 56 + W - 140
    const amtX = 56 + W - 70
    function econRow(label: string, value: string, bold = false) {
      const y = doc.y
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#000')
      doc.text(label, rightX, y, { width: 130 })
      doc.text(value, amtX, y, { width: 70, align: 'right' })
      doc.y = y + 16
    }

    econRow('Imponibile:', `€ ${data.imponibile.toFixed(2)}`)
    if (data.regime === 'notula') {
      const ritenuta = Math.abs(data.ritenuteIva)
      econRow(`Ritenuta d'acconto (20%):`, `- € ${ritenuta.toFixed(2)}`)
      doc.moveTo(amtX, doc.y).lineTo(amtX + 70, doc.y).strokeColor('#999').stroke()
      doc.y += 4
      econRow('Netto a pagare:', `€ ${data.netto.toFixed(2)}`, true)
    } else if (data.regime === 'ordinario' && data.rivalsa_iva) {
      econRow('IVA (22%):', `+ € ${data.ritenuteIva.toFixed(2)}`)
      doc.moveTo(amtX, doc.y).lineTo(amtX + 70, doc.y).strokeColor('#999').stroke()
      doc.y += 4
      econRow('Totale fattura:', `€ ${data.netto.toFixed(2)}`, true)
    } else {
      econRow('Importo da fatturare:', `€ ${data.imponibile.toFixed(2)}`, true)
    }
    doc.moveDown(1.2)

    // — DICHIARAZIONI (solo notula) —
    if (data.regime === 'notula') {
      doc.moveTo(56, doc.y).lineTo(56 + W, doc.y).strokeColor('#ccc').stroke()
      doc.moveDown(0.8)
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('DICHIARAZIONI DEL PRESTATORE')
      doc.moveDown(0.4)
      doc.font('Helvetica').fontSize(8).fillColor('#444')
      doc.text(
        'Il sottoscritto dichiara che la prestazione è stata svolta in via del tutto occasionale, senza vincolo di subordinazione e senza carattere di abitualità e continuità.\n' +
        'Il sottoscritto dichiara di non essere iscritto ad Albi Professionali e di non essere titolare di Partita IVA.\n' +
        'Il sottoscritto dichiara di non aver superato nell\'anno solare in corso il limite complessivo di € 5.000,00 per prestazioni occasionali, godendo pertanto dell\'esenzione dal versamento dei contributi previdenziali alla Gestione Separata INPS (ex art. 44 D.L. 269/2003).\n' +
        'Il compenso è soggetto a ritenuta d\'acconto del 20% ai sensi dell\'art. 25 D.P.R. 600/1973.',
        56, doc.y, { width: W, lineGap: 2 }
      )
      doc.moveDown(1)
    }

    // — MODALITÀ PAGAMENTO —
    if (data.iban) {
      doc.moveTo(56, doc.y).lineTo(56 + W, doc.y).strokeColor('#ccc').stroke()
      doc.moveDown(0.8)
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('MODALITÀ DI PAGAMENTO')
      doc.moveDown(0.4)
      doc.font('Helvetica').fontSize(9).fillColor('#444')
      doc.text('Il pagamento dovrà essere effettuato tramite bonifico bancario entro 30 gg f.m. alle seguenti coordinate:')
      doc.moveDown(0.3)
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text(`IBAN: ${data.iban}`)
      if (data.banca) doc.text(`Banca: ${data.banca}`)
      if (data.intestatario_conto) doc.text(`Intestatario: ${data.intestatario_conto}`)
      doc.moveDown(1)
    }

    // — MARCA DA BOLLO (notula + imponibile > 77.47) —
    if (data.regime === 'notula' && data.imponibile > 77.47) {
      doc.fillColor('#fffbeb').rect(56, doc.y, W, 50).fill()
      doc.fillColor('#000')
      doc.font('Helvetica-Bold').fontSize(9).text('ATTENZIONE — MARCA DA BOLLO', 62, doc.y + 8)
      doc.font('Helvetica').fontSize(8).text(
        'La presente ricevuta è soggetta all\'applicazione di una marca da bollo da € 2,00 sull\'originale cartaceo da annullare con data e firma.',
        62, doc.y + 2, { width: W - 20 }
      )
      doc.moveDown(2)
    }

    // — FIRMA —
    doc.moveTo(56, doc.y).lineTo(56 + W, doc.y).strokeColor('#ccc').stroke()
    doc.moveDown(1)
    const sigX = 56 + W - 200
    doc.moveTo(sigX, doc.y + 30).lineTo(sigX + 180, doc.y + 30).strokeColor('#999').stroke()
    doc.font('Helvetica').fontSize(9).fillColor('#888').text('Firma', sigX, doc.y + 34, { width: 180, align: 'center' })
    doc.fontSize(8).text(data.formatore_nome, sigX, doc.y + 46, { width: 180, align: 'center' })

    doc.end()
  })
}
