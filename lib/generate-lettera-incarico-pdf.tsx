import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer'
import * as fs from 'fs'
import * as path from 'path'

export interface LetteraIncaricoFormatore {
  data: string               // "gg/mm/aaaa"
  formatore_nome: string
  formatore_indirizzo?: string | null
  formatore_cap?: string | null
  formatore_citta?: string | null
  formatore_provincia?: string | null
  formatore_codice_fiscale?: string | null
  corso_title: string
  corso_tipo: string
  school_name: string
  ore_totali: number
  tariffa: number | null
  compenso_stimato: number | null
  firma_admin_nome?: string | null
  // Firma
  firmata?: boolean
  firmata_at?: string | null
  firmata_ip?: string | null
}

export interface LetteraIncaricoTutor {
  data: string
  tutor_nome: string
  tutor_indirizzo?: string | null
  tutor_cap?: string | null
  tutor_citta?: string | null
  tutor_provincia?: string | null
  tutor_codice_fiscale?: string | null
  corso_title: string
  school_name: string
  ore_tutoraggio: number
  tariffa_tutor: number | null
  compenso_stimato: number | null
  firma_admin_nome?: string | null
  // Firma
  firmata?: boolean
  firmata_at?: string | null
  firmata_ip?: string | null
}

function getCartaIntestataDataUrl(): string {
  const imgPath = path.join(process.cwd(), 'public/images/carta-intestata-svc.png')
  const imgBuffer = fs.readFileSync(imgPath)
  return `data:image/png;base64,${imgBuffer.toString('base64')}`
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 0, paddingVertical: 0, fontSize: 10, fontFamily: 'Helvetica', color: '#111' },
  body: { paddingHorizontal: 50, paddingBottom: 48, paddingTop: 20 },
  headerImg: { width: '100%', marginBottom: 0 },
  dateRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 },
  dateText: { fontSize: 9.5, color: '#444' },
  destBlock: { marginBottom: 20 },
  destLabel: { fontSize: 8, color: '#888', marginBottom: 3, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  destName: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 2 },
  destLine: { fontSize: 9.5, color: '#444' },
  oggetto: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 4 },
  oggettoLabel: { fontFamily: 'Helvetica-Bold', color: '#333' },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#ccc', marginBottom: 14 },
  sectionTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#555', textTransform: 'uppercase', marginBottom: 6 },
  bodyText: { fontSize: 9.5, lineHeight: 1.55, color: '#222', marginBottom: 10 },
  tableHeader: { backgroundColor: '#f3f4f6', flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 4 },
  tableHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#444' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  tableCell: { fontSize: 9 },
  bold: { fontFamily: 'Helvetica-Bold' },
  signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 36 },
  signatureBlock: { width: '45%' },
  signatureLine: { borderBottomWidth: 0.5, borderBottomColor: '#aaa', marginBottom: 4 },
  signatureLabel: { fontSize: 8, color: '#888', textAlign: 'center' },
  firmataBox: { backgroundColor: '#f0fdf4', borderWidth: 0.5, borderColor: '#86efac', padding: 8, marginTop: 14, borderRadius: 4 },
  firmataTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#166534', marginBottom: 3 },
  firmataText: { fontSize: 8, color: '#166534' },
})

const col = {
  scuola: '28%',
  corso: '28%',
  tipo: '12%',
  ore: '10%',
  tariffa: '12%',
  compenso: '10%',
}

function LetteraFormatorePDF({ data }: { data: LetteraIncaricoFormatore }) {
  const cartaIntestata = getCartaIntestataDataUrl()
  const addrParts = [
    data.formatore_indirizzo,
    data.formatore_cap && data.formatore_citta
      ? `${data.formatore_cap} ${data.formatore_citta}${data.formatore_provincia ? ` (${data.formatore_provincia})` : ''}`
      : null,
    data.formatore_codice_fiscale ? `C.F. ${data.formatore_codice_fiscale}` : null,
  ].filter(Boolean)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Image src={cartaIntestata} style={s.headerImg} />

        <View style={s.body}>
          {/* Date */}
          <View style={s.dateRow}>
            <Text style={s.dateText}>Roma, {data.data}</Text>
          </View>

          {/* Destinatario */}
          <View style={s.destBlock}>
            <Text style={s.destLabel}>Spett.le</Text>
            <Text style={s.destName}>{data.formatore_nome}</Text>
            {addrParts.map((p, i) => <Text key={i} style={s.destLine}>{p}</Text>)}
          </View>

          {/* Oggetto */}
          <Text style={s.oggetto}>
            <Text style={s.oggettoLabel}>OGGETTO: </Text>
            Lettera di incarico — {data.corso_title} — {data.school_name}
          </Text>

          <View style={s.divider} />

          {/* Corpo */}
          <Text style={s.bodyText}>
            Con la presente, SVC Consulting Srl Le conferisce un incarico di formazione professionale come di seguito specificato:
          </Text>

          {/* Tabella */}
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Dettaglio incarico</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, { width: col.scuola }]}>Scuola</Text>
            <Text style={[s.tableHeaderText, { width: col.corso }]}>Corso</Text>
            <Text style={[s.tableHeaderText, { width: col.tipo }]}>Tipo</Text>
            <Text style={[s.tableHeaderText, { width: col.ore, textAlign: 'center' }]}>Ore</Text>
            <Text style={[s.tableHeaderText, { width: col.tariffa, textAlign: 'right' }]}>Tariffa</Text>
            <Text style={[s.tableHeaderText, { width: col.compenso, textAlign: 'right' }]}>Compenso</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { width: col.scuola, paddingRight: 4 }]}>{data.school_name}</Text>
            <Text style={[s.tableCell, { width: col.corso, paddingRight: 4 }]}>{data.corso_title}</Text>
            <Text style={[s.tableCell, { width: col.tipo }]}>{data.corso_tipo}</Text>
            <Text style={[s.tableCell, { width: col.ore, textAlign: 'center' }]}>{data.ore_totali}h</Text>
            <Text style={[s.tableCell, { width: col.tariffa, textAlign: 'right' }]}>
              {data.tariffa != null ? `€ ${data.tariffa.toFixed(2)}/h` : '—'}
            </Text>
            <Text style={[s.tableCell, s.bold, { width: col.compenso, textAlign: 'right' }]}>
              {data.compenso_stimato != null ? `€ ${data.compenso_stimato.toFixed(2)}` : '—'}
            </Text>
          </View>

          {/* Condizioni */}
          <Text style={[s.bodyText, { marginTop: 14 }]}>
            Il compenso sopra indicato è da intendersi come stima basata sulle ore totali del corso e sulla tariffa oraria concordata. Il compenso effettivo sarà calcolato sulle ore effettivamente erogate al termine del corso.
          </Text>
          <Text style={s.bodyText}>
            Il presente incarico è regolato dalle disposizioni vigenti in materia di prestazioni occasionali / partita IVA secondo il regime fiscale applicabile al prestatore.
          </Text>
          <Text style={s.bodyText}>
            La preghiamo di confermare accettazione dell&apos;incarico tramite firma del presente documento.
          </Text>

          <Text style={[s.bodyText, { marginTop: 4 }]}>
            Cordiali saluti,{'\n'}
            <Text style={s.bold}>SVC Consulting Srl</Text>
          </Text>

          {/* Firma sezione */}
          <View style={s.signaturesRow}>
            <View style={s.signatureBlock}>
              <Text style={[s.sectionTitle, { marginBottom: 30 }]}>Per SVC Consulting Srl</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>{data.firma_admin_nome || 'Amministratore'}</Text>
            </View>
            <View style={s.signatureBlock}>
              <Text style={[s.sectionTitle, { marginBottom: 30 }]}>Per accettazione — Il Formatore</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>{data.formatore_nome}</Text>
            </View>
          </View>

          {/* Firma stamp (se firmata digitalmente) */}
          {data.firmata && data.firmata_at && (
            <View style={s.firmataBox}>
              <Text style={s.firmataTitle}>FIRMATA DIGITALMENTE</Text>
              <Text style={s.firmataText}>
                Data: {new Date(data.firmata_at).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })}
              </Text>
              {data.firmata_ip && (
                <Text style={s.firmataText}>IP: {data.firmata_ip}</Text>
              )}
              <Text style={s.firmataText}>Firmato da: {data.formatore_nome}</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}

function LetteraTutorPDF({ data }: { data: LetteraIncaricoTutor }) {
  const cartaIntestata = getCartaIntestataDataUrl()
  const addrParts = [
    data.tutor_indirizzo,
    data.tutor_cap && data.tutor_citta
      ? `${data.tutor_cap} ${data.tutor_citta}${data.tutor_provincia ? ` (${data.tutor_provincia})` : ''}`
      : null,
    data.tutor_codice_fiscale ? `C.F. ${data.tutor_codice_fiscale}` : null,
  ].filter(Boolean)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Image src={cartaIntestata} style={s.headerImg} />

        <View style={s.body}>
          {/* Date */}
          <View style={s.dateRow}>
            <Text style={s.dateText}>Roma, {data.data}</Text>
          </View>

          {/* Destinatario */}
          <View style={s.destBlock}>
            <Text style={s.destLabel}>Spett.le</Text>
            <Text style={s.destName}>{data.tutor_nome}</Text>
            {addrParts.map((p, i) => <Text key={i} style={s.destLine}>{p}</Text>)}
          </View>

          {/* Oggetto */}
          <Text style={s.oggetto}>
            <Text style={s.oggettoLabel}>OGGETTO: </Text>
            Lettera di incarico tutoraggio — {data.corso_title} — {data.school_name}
          </Text>

          <View style={s.divider} />

          <Text style={s.bodyText}>
            Con la presente, SVC Consulting Srl Le conferisce un incarico di tutoraggio come di seguito specificato:
          </Text>

          {/* Tabella */}
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Dettaglio incarico</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, { width: '35%' }]}>Scuola</Text>
            <Text style={[s.tableHeaderText, { width: '30%' }]}>Corso</Text>
            <Text style={[s.tableHeaderText, { width: '12%', textAlign: 'center' }]}>Ore</Text>
            <Text style={[s.tableHeaderText, { width: '12%', textAlign: 'right' }]}>Tariffa</Text>
            <Text style={[s.tableHeaderText, { width: '11%', textAlign: 'right' }]}>Compenso</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { width: '35%', paddingRight: 4 }]}>{data.school_name}</Text>
            <Text style={[s.tableCell, { width: '30%', paddingRight: 4 }]}>{data.corso_title}</Text>
            <Text style={[s.tableCell, { width: '12%', textAlign: 'center' }]}>{data.ore_tutoraggio}h</Text>
            <Text style={[s.tableCell, { width: '12%', textAlign: 'right' }]}>
              {data.tariffa_tutor != null ? `€ ${data.tariffa_tutor.toFixed(2)}/h` : '—'}
            </Text>
            <Text style={[s.tableCell, s.bold, { width: '11%', textAlign: 'right' }]}>
              {data.compenso_stimato != null ? `€ ${data.compenso_stimato.toFixed(2)}` : '—'}
            </Text>
          </View>

          <Text style={[s.bodyText, { marginTop: 14 }]}>
            Il compenso sopra indicato è una stima basata sulle ore totali di tutoraggio e sulla tariffa oraria concordata. Il compenso effettivo sarà calcolato sulle ore effettivamente erogate.
          </Text>
          <Text style={s.bodyText}>
            La preghiamo di confermare accettazione dell&apos;incarico tramite firma del presente documento.
          </Text>

          <Text style={[s.bodyText, { marginTop: 4 }]}>
            Cordiali saluti,{'\n'}
            <Text style={s.bold}>SVC Consulting Srl</Text>
          </Text>

          {/* Firma sezione */}
          <View style={s.signaturesRow}>
            <View style={s.signatureBlock}>
              <Text style={[s.sectionTitle, { marginBottom: 30 }]}>Per SVC Consulting Srl</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>{data.firma_admin_nome || 'Amministratore'}</Text>
            </View>
            <View style={s.signatureBlock}>
              <Text style={[s.sectionTitle, { marginBottom: 30 }]}>Per accettazione — Il Tutor</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>{data.tutor_nome}</Text>
            </View>
          </View>

          {data.firmata && data.firmata_at && (
            <View style={s.firmataBox}>
              <Text style={s.firmataTitle}>FIRMATA DIGITALMENTE</Text>
              <Text style={s.firmataText}>
                Data: {new Date(data.firmata_at).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })}
              </Text>
              {data.firmata_ip && (
                <Text style={s.firmataText}>IP: {data.firmata_ip}</Text>
              )}
              <Text style={s.firmataText}>Firmato da: {data.tutor_nome}</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}

export async function generateLetteraIncaricoFormatorePdf(data: LetteraIncaricoFormatore): Promise<Buffer> {
  const buf = await renderToBuffer(<LetteraFormatorePDF data={data} />)
  return Buffer.from(buf)
}

export async function generateLetteraIncaricoTutorPdf(data: LetteraIncaricoTutor): Promise<Buffer> {
  const buf = await renderToBuffer(<LetteraTutorPDF data={data} />)
  return Buffer.from(buf)
}
