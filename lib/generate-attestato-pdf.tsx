import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'

export interface AttestatoData {
  nome_cognome: string
  titolo_corso: string
  ore_totali: string | number
  data: string  // gg/mm/aaaa
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 72, paddingTop: 48, paddingBottom: 56, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  bar: { borderTopWidth: 3, borderTopColor: '#d64b55', marginBottom: 32 },
  titleWrap: { alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#d64b55', textTransform: 'uppercase', letterSpacing: 2 },
  subtitle: { fontSize: 11, color: '#999', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' },
  body: { alignItems: 'center' },
  label: { fontSize: 12, color: '#555', textAlign: 'center', marginBottom: 4 },
  name: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#111', textAlign: 'center', marginVertical: 10 },
  courseTitleWrap: { borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#e5e5e5', paddingVertical: 10, marginVertical: 12, width: '100%', alignItems: 'center' },
  courseTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#222', textAlign: 'center' },
  detail: { fontSize: 12, color: '#555', textAlign: 'center', marginTop: 6 },
  detailBold: { fontFamily: 'Helvetica-Bold', color: '#333' },
  signatureRow: { marginTop: 56, flexDirection: 'row', justifyContent: 'flex-end' },
  signatureBox: { alignItems: 'center', width: 160 },
  signatureLine: { borderTopWidth: 1, borderTopColor: '#666', width: 140, marginBottom: 6 },
  signatureLabel: { fontSize: 9, color: '#666' },
  signatureOrg: { fontSize: 9, color: '#999', marginTop: 2 },
  footer: { position: 'absolute', bottom: 28, left: 72, right: 72, borderTopWidth: 0.5, borderTopColor: '#e5e5e5', paddingTop: 8 },
  footerText: { fontSize: 8, color: '#bbb', textAlign: 'center' },
})

function AttestatoPDF({ nome_cognome, titolo_corso, ore_totali, data }: AttestatoData) {
  let logoSrc: string | undefined
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'images', 'carta-intestata-svc.png'))
    logoSrc = `data:image/png;base64,${buf.toString('base64')}`
  } catch { /* logo not critical */ }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {logoSrc
          ? <Image src={logoSrc} style={{ width: 200, alignSelf: 'center', marginBottom: 24 }} />
          : <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#d64b55', textAlign: 'center', marginBottom: 24 }}>Formascuole</Text>
        }

        <View style={s.bar} />

        <View style={s.titleWrap}>
          <Text style={s.title}>Attestato di Partecipazione</Text>
          <Text style={s.subtitle}>Certificate of Participation</Text>
        </View>

        <View style={s.body}>
          <Text style={s.label}>Si certifica che</Text>
          <Text style={s.name}>{nome_cognome}</Text>
          <Text style={s.label}>ha partecipato al corso di formazione</Text>
          <View style={s.courseTitleWrap}>
            <Text style={s.courseTitle}>{titolo_corso}</Text>
          </View>
          <Text style={s.detail}>
            della durata di <Text style={s.detailBold}>{ore_totali} ore</Text>
          </Text>
          <Text style={s.detail}>
            concluso in data <Text style={s.detailBold}>{data}</Text>
          </Text>
        </View>

        <View style={s.signatureRow}>
          <View style={s.signatureBox}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Firma e timbro</Text>
            <Text style={s.signatureOrg}>SVC Consulting S.r.l.</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>
            Formascuole · SVC Consulting S.r.l. · Via A. Vallisneri 7, 00197 Roma · P.IVA 07142321004
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateAttestatoPdf(data: AttestatoData): Promise<Buffer> {
  return renderToBuffer(<AttestatoPDF {...data} />)
}
