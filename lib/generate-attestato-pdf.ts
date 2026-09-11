import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

export interface AttestatoData {
  nome_cognome: string
  titolo_corso: string
  ore_totali: string | number
  data: string  // gg/mm/aaaa
}

export async function generateAttestatoPdf({
  nome_cognome,
  titolo_corso,
  ore_totali,
  data,
}: AttestatoData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'public', 'attestato_template.pdf')
  const templateBytes = fs.readFileSync(templatePath)
  const pdfDoc = await PDFDocument.load(templateBytes)
  const form = pdfDoc.getForm()

  form.getTextField('nome_cognome').setText(nome_cognome)
  form.getTextField('titolo_corso').setText(titolo_corso)
  form.getTextField('ore_totali').setText(String(ore_totali) + ' ore')
  form.getTextField('data').setText(data)

  form.flatten()

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
