import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

export interface NotulaCorsoItem {
  titolo_corso: string
  school_name: string
  prima_sessione: string | null
  ultima_sessione: string | null
  ore_erogate: number
  tariffa: number
  importo: number
}

export interface NotulaData {
  numero: string
  data: string               // "gg/mm/aaaa"
  formatore_nome: string
  luogo_nascita: string | null
  data_nascita: string | null
  codice_fiscale: string | null
  indirizzo_via: string | null
  indirizzo_cap: string | null
  indirizzo_citta: string | null
  indirizzo_provincia: string | null
  iban: string | null
  banca: string | null
  intestatario_conto: string | null
  tipo: 'singola' | 'cumulativa'
  corsi: NotulaCorsoItem[]  // one or more
  regime: 'notula' | 'forfettario' | 'ordinario'
  rivalsa_iva: boolean
  importo_totale: number
  ritenuta: number    // positive = ritenuta amount (20% of imponibile)
  iva: number         // IVA amount (0 if not applicable)
  netto: number
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 56, paddingVertical: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#111' },
  center: { textAlign: 'center' },
  label: { fontSize: 8, color: '#666', marginBottom: 4, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#ccc', marginVertical: 10 },
  bold: { fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 8.5, color: '#444' },
  tableHeader: { backgroundColor: '#f0f0f0', flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 4 },
  tableHeaderText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#333' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5' },
  econRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  econLabel: { width: 170, fontSize: 9.5, textAlign: 'right', paddingRight: 10 },
  econValue: { width: 80, fontSize: 9.5, textAlign: 'right' },
  warningBox: { backgroundColor: '#fffbeb', borderWidth: 0.5, borderColor: '#f59e0b', padding: 8, marginTop: 10 },
  sectionTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#555', textTransform: 'uppercase', marginBottom: 6 },
})

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT')
}

function NotulaPDF({ data }: { data: NotulaData }) {
  const docTitle = data.regime === 'notula'
    ? 'RICEVUTA PER PRESTAZIONE OCCASIONALE'
    : 'DOCUMENTO DI FATTURAZIONE'

  const tipoLabel = data.tipo === 'cumulativa'
    ? `NOTULA CUMULATIVA (${data.corsi.length} corsi)`
    : 'NOTULA SINGOLA'

  const addrParts = [
    data.indirizzo_via,
    (data.indirizzo_cap && data.indirizzo_citta) ? `${data.indirizzo_cap} ${data.indirizzo_citta}` : null,
    data.indirizzo_provincia ? `(${data.indirizzo_provincia})` : null,
  ].filter(Boolean)

  // Column widths for multi-course table
  const col = {
    corso: '28%',
    scuola: '18%',
    periodo: '20%',
    ore: '8%',
    tariffa: '12%',
    importo: '14%',
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <Text style={[s.center, { fontSize: 8.5, color: '#888', marginBottom: 3 }]}>{docTitle}</Text>
        <Text style={[s.center, { fontSize: 8, color: '#aaa', marginBottom: 6 }]}>{tipoLabel}</Text>
        <View style={s.row}>
          <Text style={s.bold}>Ricevuta n. {data.numero}</Text>
          <Text>Data: {data.data}</Text>
        </View>

        <View style={s.divider} />

        {/* Two-column prestatore / committente */}
        <View style={[s.row, { marginBottom: 12 }]}>
          <View style={{ width: '48%' }}>
            <Text style={s.label}>Prestatore</Text>
            <Text style={[s.bold, { marginBottom: 2 }]}>{data.formatore_nome}</Text>
            {data.luogo_nascita && data.data_nascita && (
              <Text style={s.small}>Nato/a a {data.luogo_nascita} il {fmtDate(data.data_nascita)}</Text>
            )}
            {data.codice_fiscale && <Text style={s.small}>CF: {data.codice_fiscale}</Text>}
            {addrParts.map((p, i) => <Text key={i} style={s.small}>{p}</Text>)}
          </View>
          <View style={{ width: '48%' }}>
            <Text style={s.label}>Committente</Text>
            <Text style={[s.bold, { marginBottom: 2 }]}>SVC Consulting Srl</Text>
            <Text style={s.small}>Via Antonio Vallisneri 7</Text>
            <Text style={s.small}>00197 Roma</Text>
            <Text style={s.small}>CF/PI 07142321004</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Multi-course table */}
        <Text style={s.sectionTitle}>Descrizione prestazione</Text>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderText, { width: col.corso }]}>Corso</Text>
          <Text style={[s.tableHeaderText, { width: col.scuola }]}>Scuola</Text>
          <Text style={[s.tableHeaderText, { width: col.periodo }]}>Periodo</Text>
          <Text style={[s.tableHeaderText, { width: col.ore, textAlign: 'center' }]}>Ore</Text>
          <Text style={[s.tableHeaderText, { width: col.tariffa, textAlign: 'right' }]}>Tariffa</Text>
          <Text style={[s.tableHeaderText, { width: col.importo, textAlign: 'right' }]}>Importo</Text>
        </View>

        {data.corsi.map((c, i) => {
          const periodoStart = fmtDate(c.prima_sessione)
          const periodoEnd = fmtDate(c.ultima_sessione)
          const periodo = c.prima_sessione === c.ultima_sessione
            ? periodoStart
            : `${periodoStart} — ${periodoEnd}`
          return (
            <View key={i} style={s.tableRow}>
              <Text style={[s.small, { width: col.corso, paddingRight: 4 }]}>{c.titolo_corso}</Text>
              <Text style={[s.small, { width: col.scuola, paddingRight: 4 }]}>{c.school_name}</Text>
              <Text style={[s.small, { width: col.periodo, paddingRight: 4 }]}>{periodo}</Text>
              <Text style={[s.small, { width: col.ore, textAlign: 'center' }]}>{c.ore_erogate}h</Text>
              <Text style={[s.small, { width: col.tariffa, textAlign: 'right' }]}>€ {c.tariffa.toFixed(2)}/h</Text>
              <Text style={[s.bold, { width: col.importo, textAlign: 'right', fontSize: 9 }]}>€ {c.importo.toFixed(2)}</Text>
            </View>
          )
        })}

        {/* Total row */}
        {data.corsi.length > 1 && (
          <View style={[s.tableRow, { backgroundColor: '#f9f9f9' }]}>
            <Text style={[s.bold, { width: col.corso, fontSize: 9 }]}>Totale</Text>
            <Text style={{ width: col.scuola }} />
            <Text style={{ width: col.periodo }} />
            <Text style={{ width: col.ore }} />
            <Text style={{ width: col.tariffa }} />
            <Text style={[s.bold, { width: col.importo, textAlign: 'right', fontSize: 9 }]}>€ {data.importo_totale.toFixed(2)}</Text>
          </View>
        )}

        {/* Calcolo economico */}
        <View style={{ marginTop: 14 }}>
          <Text style={s.sectionTitle}>Calcolo economico</Text>
          <View style={s.econRow}>
            <Text style={s.econLabel}>Imponibile:</Text>
            <Text style={s.econValue}>€ {data.importo_totale.toFixed(2)}</Text>
          </View>
          {data.regime === 'notula' && (
            <>
              <View style={s.econRow}>
                <Text style={s.econLabel}>Ritenuta d&apos;acconto (20%):</Text>
                <Text style={s.econValue}>- € {data.ritenuta.toFixed(2)}</Text>
              </View>
              <View style={[s.econRow, { borderTopWidth: 0.5, borderTopColor: '#999', paddingTop: 4 }]}>
                <Text style={[s.econLabel, s.bold]}>Netto a pagare:</Text>
                <Text style={[s.econValue, s.bold]}>€ {data.netto.toFixed(2)}</Text>
              </View>
            </>
          )}
          {data.regime === 'ordinario' && data.rivalsa_iva && (
            <>
              <View style={s.econRow}>
                <Text style={s.econLabel}>IVA (22%):</Text>
                <Text style={s.econValue}>+ € {data.iva.toFixed(2)}</Text>
              </View>
              <View style={[s.econRow, { borderTopWidth: 0.5, borderTopColor: '#999', paddingTop: 4 }]}>
                <Text style={[s.econLabel, s.bold]}>Totale fattura:</Text>
                <Text style={[s.econValue, s.bold]}>€ {data.netto.toFixed(2)}</Text>
              </View>
            </>
          )}
          {(data.regime === 'forfettario' || (data.regime === 'ordinario' && !data.rivalsa_iva)) && (
            <View style={[s.econRow, { borderTopWidth: 0.5, borderTopColor: '#999', paddingTop: 4 }]}>
              <Text style={[s.econLabel, s.bold]}>Importo da fatturare:</Text>
              <Text style={[s.econValue, s.bold]}>€ {data.importo_totale.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Dichiarazioni (solo notula) */}
        {data.regime === 'notula' && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Dichiarazioni del prestatore</Text>
            <Text style={[s.small, { lineHeight: 1.5 }]}>
              Il sottoscritto dichiara che la prestazione è stata svolta in via del tutto occasionale, senza vincolo di subordinazione e senza carattere di abitualità e continuità.{'\n'}
              Il sottoscritto dichiara di non essere iscritto ad Albi Professionali e di non essere titolare di Partita IVA.{'\n'}
              Il sottoscritto dichiara di non aver superato nell&apos;anno solare in corso il limite complessivo di € 5.000,00 per prestazioni occasionali, godendo pertanto dell&apos;esenzione dal versamento dei contributi previdenziali alla Gestione Separata INPS (ex art. 44 D.L. 269/2003).{'\n'}
              Il compenso è soggetto a ritenuta d&apos;acconto del 20% ai sensi dell&apos;art. 25 D.P.R. 600/1973.
            </Text>
          </>
        )}

        {/* Modalità di pagamento (solo notula) */}
        {data.regime === 'notula' && data.iban && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Modalità di pagamento</Text>
            <Text style={[s.small, { marginBottom: 6 }]}>Il pagamento dovrà essere effettuato tramite bonifico bancario entro 30 gg f.m. alle seguenti coordinate bancarie:</Text>
            <View style={{ marginLeft: 8 }}>
              <Text style={[s.small, s.bold]}>IBAN: {data.iban}</Text>
              {data.banca && <Text style={s.small}>Banca: {data.banca}</Text>}
              {data.intestatario_conto && <Text style={s.small}>Intestatario: {data.intestatario_conto}</Text>}
            </View>
          </>
        )}

        {/* Marca da bollo */}
        {data.regime === 'notula' && data.importo_totale > 77.47 && (
          <View style={s.warningBox}>
            <Text style={[s.bold, { fontSize: 9, marginBottom: 3 }]}>ATTENZIONE — MARCA DA BOLLO</Text>
            <Text style={s.small}>La presente ricevuta è soggetta all&apos;applicazione di una marca da bollo da € 2,00 sull&apos;originale cartaceo da annullare con data e firma.</Text>
          </View>
        )}

        {/* Firma */}
        {data.regime === 'notula' && (
          <>
            <View style={[s.divider, { marginTop: 24 }]} />
            <View style={{ alignItems: 'flex-end', marginTop: 30 }}>
              <View style={{ width: 180, borderBottomWidth: 0.5, borderBottomColor: '#999', marginBottom: 4 }} />
              <Text style={{ fontSize: 8.5, color: '#888', textAlign: 'center', width: 180 }}>Firma</Text>
              <Text style={{ fontSize: 8, color: '#888', textAlign: 'center', width: 180, marginTop: 2 }}>{data.formatore_nome}</Text>
            </View>
          </>
        )}

      </Page>
    </Document>
  )
}

export async function generateNotulaPdf(data: NotulaData): Promise<Buffer> {
  const buf = await renderToBuffer(<NotulaPDF data={data} />)
  return Buffer.from(buf)
}
