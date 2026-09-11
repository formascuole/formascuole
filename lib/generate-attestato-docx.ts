import fs from 'fs'
import path from 'path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

export interface AttestatoData {
  nome_cognome: string
  titolo_corso: string
  ore_totali: string | number
  data: string  // gg/mm/aaaa
}

export function generateAttestatoDocx(data: AttestatoData): Buffer {
  const templatePath = path.join(process.cwd(), 'public', 'ATTESTATO DI PARTECIPAZIONE.docx')
  const content = fs.readFileSync(templatePath)
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  })
  doc.render({
    nome_cognome: data.nome_cognome,
    titolo_corso: data.titolo_corso,
    ore_totali: String(data.ore_totali),
    data: data.data,
  })
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}
