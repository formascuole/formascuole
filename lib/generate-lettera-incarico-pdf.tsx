import React from 'react'
import { Document, Page, Text, View, StyleSheet, Link, renderToBuffer } from '@react-pdf/renderer'

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
  finanziamento_nome?: string | null
  firma_admin_nome?: string | null
  // Firma
  firmata?: boolean
  firmata_at?: string | null
  firmata_ip?: string | null
  firmata_user_id?: string | null
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
  finanziamento_nome?: string | null
  firma_admin_nome?: string | null
  // Firma
  firmata?: boolean
  firmata_at?: string | null
  firmata_ip?: string | null
  firmata_user_id?: string | null
}

const RED = '#C0392B'
const DARK = '#111111'
const GREY = '#666666'
const LIGHT_GREY = '#999999'
const BODY_GREY = '#222222'

const s = StyleSheet.create({
  page: { paddingHorizontal: 0, paddingVertical: 0, fontSize: 10, fontFamily: 'Helvetica', color: DARK },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 16,
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end', minWidth: '40%' },
  headerCompany: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: RED, marginBottom: 4 },
  headerInfo: { fontSize: 9, color: GREY, marginBottom: 2 },
  headerInfoRed: { fontSize: 9, color: RED, marginBottom: 2 },
  headerTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: DARK, textAlign: 'right', marginBottom: 3 },
  headerSubtitle: { fontSize: 9, color: LIGHT_GREY, textAlign: 'right' },

  redLine: { height: 1.5, backgroundColor: RED },

  // ── Body ──
  body: { paddingHorizontal: 40, paddingBottom: 48, paddingTop: 18 },
  dateRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 18 },
  dateText: { fontSize: 9.5, color: GREY },
  destBlock: { marginBottom: 18 },
  destLabel: { fontSize: 8, color: LIGHT_GREY, marginBottom: 3, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  destName: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 2 },
  destLine: { fontSize: 9.5, color: '#444' },
  oggetto: { fontSize: 10.5, marginBottom: 4, lineHeight: 1.4 },
  oggettoLabel: { fontFamily: 'Helvetica-Bold' },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#ccc', marginBottom: 14 },

  bodyText: { fontSize: 9.5, lineHeight: 1.55, color: BODY_GREY, marginBottom: 8 },
  bodyTextItalic: { fontSize: 9.5, lineHeight: 1.55, color: GREY, fontFamily: 'Helvetica-Oblique', marginBottom: 8 },
  bodyTextItalicRed: { fontSize: 9.5, lineHeight: 1.55, color: RED, fontFamily: 'Helvetica-Oblique', marginBottom: 8 },

  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#555', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },

  // ── Table ──
  table: { marginBottom: 6 },
  tableHeader: { backgroundColor: RED, flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 5 },
  tableHeaderText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  tableCell: { fontSize: 9, color: BODY_GREY },
  bold: { fontFamily: 'Helvetica-Bold' },

  // ── Bullets ──
  bulletRow: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 14, fontSize: 9.5, color: BODY_GREY, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 9.5, lineHeight: 1.5, color: BODY_GREY },

  // ── Numbered ──
  numberedRow: { flexDirection: 'row', marginBottom: 8 },
  numberedNum: { width: 16, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: BODY_GREY, flexShrink: 0 },
  numberedContent: { flex: 1 },
  numberedText: { fontSize: 9.5, lineHeight: 1.5, color: BODY_GREY },
  linkText: { fontSize: 9, color: '#2563eb' },

  // ── Signatures ──
  signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  signatureBlock: { width: '45%' },
  signatureLabel: { fontSize: 9.5, color: BODY_GREY, marginBottom: 4 },
  signatureLine: { borderBottomWidth: 0.5, borderBottomColor: '#aaa', marginBottom: 4, marginTop: 24 },
  signatureCaption: { fontSize: 8, color: LIGHT_GREY, textAlign: 'center' },

  // ── Footer stamp ──
  footerStamp: { marginTop: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: '#ddd' },
  footerText: { fontSize: 7.5, color: LIGHT_GREY, textAlign: 'center', lineHeight: 1.5 },
  footerTextBold: { fontSize: 7.5, color: GREY, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
})

const col = {
  scuola: '25%',
  corso: '30%',
  ore: '10%',
  tariffa: '17%',
  compenso: '18%',
}

const colTutor = {
  scuola: '35%',
  corso: '30%',
  ore: '12%',
  tariffa: '12%',
  compenso: '11%',
}

// ── Bullet helper ──────────────────────────────────────────────────────────────

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>–</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  )
}

// ── Formatore PDF ──────────────────────────────────────────────────────────────

function LetteraFormatorePDF({ data }: { data: LetteraIncaricoFormatore }) {
  const addrParts = [
    data.formatore_indirizzo,
    data.formatore_cap && data.formatore_citta
      ? `${data.formatore_cap} ${data.formatore_citta}${data.formatore_provincia ? ` (${data.formatore_provincia})` : ''}`
      : null,
    data.formatore_codice_fiscale ? `C.F. ${data.formatore_codice_fiscale}` : null,
  ].filter(Boolean)

  const firmataDate = data.firmata_at
    ? new Date(data.firmata_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  const firmataTime = data.firmata_at
    ? new Date(data.firmata_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── INTESTAZIONE ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerCompany}>SVC Consulting S.r.l.</Text>
            <Text style={s.headerInfo}>Via A. Vallisneri 7 – 00197 Roma</Text>
            <Text style={s.headerInfo}>P.IVA 07142321004 | Cod. Univ. M5UXCR1</Text>
            <Text style={s.headerInfoRed}>formascuole.it</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>LETTERA DI INCARICO</Text>
            <Text style={s.headerSubtitle}>Docenza per attività di formazione</Text>
          </View>
        </View>
        <View style={s.redLine} />

        <View style={s.body}>

          {/* ── DATA ── */}
          <View style={s.dateRow}>
            <Text style={s.dateText}>Roma, {data.data}</Text>
          </View>

          {/* ── DESTINATARIO ── */}
          <View style={s.destBlock}>
            <Text style={s.destLabel}>Spett.le</Text>
            <Text style={s.destName}>{data.formatore_nome}</Text>
            {addrParts.map((p, i) => <Text key={i} style={s.destLine}>{p}</Text>)}
          </View>

          {/* ── OGGETTO ── */}
          <Text style={s.oggetto}>
            <Text style={s.oggettoLabel}>OGGETTO: </Text>
            {`Incarico di docenza per attività di formazione${data.finanziamento_nome ? ` — ${data.finanziamento_nome}` : ''}`}
          </Text>

          <View style={s.divider} />

          {/* ── INTRO ── */}
          <Text style={s.bodyText}>
            {'Con la presente SVC Consulting S.r.l. Le conferisce incarico di docenza per la seguente attività formativa:'}
          </Text>

          {/* ── TABELLA ── */}
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { width: col.scuola }]}>Scuola / Progetto</Text>
              <Text style={[s.tableHeaderText, { width: col.corso }]}>Corso</Text>
              <Text style={[s.tableHeaderText, { width: col.ore, textAlign: 'center' }]}>Ore</Text>
              <Text style={[s.tableHeaderText, { width: col.tariffa, textAlign: 'right' }]}>Tariffa oraria</Text>
              <Text style={[s.tableHeaderText, { width: col.compenso, textAlign: 'right' }]}>Compenso lordo</Text>
            </View>
            <View style={s.tableRow}>
              <Text style={[s.tableCell, { width: col.scuola, paddingRight: 4 }]}>{data.school_name}</Text>
              <Text style={[s.tableCell, { width: col.corso, paddingRight: 4 }]}>{data.corso_title}</Text>
              <Text style={[s.tableCell, { width: col.ore, textAlign: 'center' }]}>{data.ore_totali}h</Text>
              <Text style={[s.tableCell, { width: col.tariffa, textAlign: 'right' }]}>
                {data.tariffa != null ? `€ ${data.tariffa.toFixed(2)}/h` : '—'}
              </Text>
              <Text style={[s.tableCell, s.bold, { width: col.compenso, textAlign: 'right' }]}>
                {data.compenso_stimato != null ? `€ ${data.compenso_stimato.toFixed(2)}` : '—'}
              </Text>
            </View>
          </View>
          <Text style={s.bodyTextItalic}>
            {'Il compenso è da intendersi al lordo di oneri fiscali e previdenziali.'}
          </Text>

          {/* ── SEZIONE 1 ── */}
          <Text style={s.sectionTitle}>1. Modalità di svolgimento della prestazione</Text>
          <Text style={s.bodyText}>
            {'L\'attività di formazione oggetto del presente incarico dovrà essere realizzata nei giorni e negli orari concordati tra il formatore e la Committenza, secondo le modalità concordate (in presenza / online / ibrido) e in coerenza con il programma didattico definito.\nL\'incaricato è tenuto a svolgere la propria attività con la massima diligenza e professionalità, garantendo la qualità dei contenuti e l\'efficacia metodologica delle azioni formative.\nIn particolare, il formatore si impegna a:'}
          </Text>
          <View style={{ marginLeft: 8, marginBottom: 8 }}>
            <Bullet text={'Collaborare con la Committenza nella definizione del programma didattico e nella calendarizzazione delle attività;'} />
            <Bullet text={'Erogare la docenza nei modi e nei tempi concordati, garantendo la partecipazione attiva dei destinatari;'} />
            <Bullet text={'Compilare e firmare il registro presenze (in formato cartaceo o digitale) unitamente ai partecipanti, laddove previsto;'} />
            <Bullet text={'Somministrare il questionario di gradimento tramite il link dedicato al corso, generato dalla web app Formascuole (https://formascuole.vercel.app), prima del termine dell\'ultima sessione del percorso di formazione/laboratorio sul campo;'} />
            <Bullet text={'Condividere con la Committenza, tramite l\'area riservata del sito https://formascuole.it, il materiale didattico utilizzato durante le attività formative, entro e non oltre la data di conclusione del corso;'} />
            <Bullet text={'Fornire, a conclusione del corso, una breve relazione di sintesi sulle attività svolte e sui risultati formativi conseguiti.'} />
          </View>

          {/* ── SEZIONE 2 ── */}
          <Text style={s.sectionTitle}>2. Documentazione amministrativa</Text>
          <Text style={s.bodyText}>
            {'Ai fini della corretta gestione amministrativa dell\'incarico, il formatore è tenuto a trasmettere alla Committenza la seguente documentazione:'}
          </Text>
          <View style={{ marginBottom: 8 }}>
            <View style={s.numberedRow}>
              <Text style={s.numberedNum}>1.</Text>
              <View style={s.numberedContent}>
                <Text style={s.numberedText}>
                  {'Traccia programmatica del corso, conforme al modello disponibile al seguente link: '}
                </Text>
                <Link src="https://formascuole24-my.sharepoint.com/:b:/g/personal/formazione_formascuole24_onmicrosoft_com/EaMTapEM579NvzBQ7cqywC8BAz9otVlpNdde_244EYuVwg?e=JmrGyS&download=1"
                  style={s.linkText}>
                  {'→ Modulo Traccia Programmatica'}
                </Link>
              </View>
            </View>
            <View style={s.numberedRow}>
              <Text style={s.numberedNum}>2.</Text>
              <View style={s.numberedContent}>
                <Text style={s.numberedText}>
                  {'Dichiarazione di insussistenza di cause di incompatibilità, conforme al modello disponibile al seguente link: '}
                </Text>
                <Link src="https://formascuole24-my.sharepoint.com/:b:/g/personal/formazione_formascuole24_onmicrosoft_com/EWWYGR9Gy4VBuYHi5-d7QxQB3HjRyeRaE2wblQHfAf591w?e=V81DjB&download=1"
                  style={s.linkText}>
                  {'→ Modulo Dichiarazione Insussistenza'}
                </Link>
              </View>
            </View>
            <View style={s.numberedRow}>
              <Text style={s.numberedNum}>3.</Text>
              <View style={s.numberedContent}>
                <Text style={s.numberedText}>
                  {'Curriculum vitae in formato europeo aggiornato e comprensivo di codice fiscale, firmato in calce – template disponibile al seguente link: '}
                </Text>
                <Link src="https://formascuole24-my.sharepoint.com/:w:/g/personal/formazione_formascuole24_onmicrosoft_com/ESvxSxp9bGNMnsFpGMVevVMBxfkEjQI-HqdW2LqNgQNgEw?web=1&action=copy"
                  style={s.linkText}>
                  {'→ Template CV Europeo'}
                </Link>
              </View>
            </View>
          </View>
          <Text style={s.bodyTextItalicRed}>
            {'La mancata consegna della documentazione sopra elencata comporterà la sospensione della liquidazione dei compensi fino all\'avvenuto adempimento.'}
          </Text>

          {/* ── SEZIONE 3 ── */}
          <Text style={s.sectionTitle}>3. Corrispettivo e modalità di pagamento</Text>
          <Text style={s.bodyText}>
            {'Il corrispettivo sopra indicato sarà riconosciuto a fronte delle ore effettivamente erogate e documentate, al lordo di oneri fiscali e previdenziali.\nIl pagamento sarà effettuato da:\nSVC Consulting S.r.l. — Via A. Vallisneri 7 – 00197 Roma — P.IVA 07142321004 – Codice Univoco M5UXCR1\ntramite bonifico bancario sull\'IBAN comunicato dal professionista, entro 60 giorni data fattura fine mese, previa verifica della corretta esecuzione dell\'incarico.'}
          </Text>
          <Text style={s.bodyText}>
            {'La fattura dovrà riportare la seguente dicitura:\n'}
            <Text style={{ fontFamily: 'Helvetica-Oblique' }}>
              {`"Docenza per attività di formazione ${data.corso_title} – ${data.ore_totali} ore – per/presso ${data.school_name}."`}
            </Text>
          </Text>
          <Text style={s.bodyText}>
            {'Ai fini del pagamento, è necessario inviare la bozza della fattura (o notula pro-forma) ai seguenti indirizzi:\npianificazione@formascuole.it\namministrazione@formascuole.it\n\nRicevuto il consenso alla liquidazione, potrà essere emessa la fattura (o notula) definitiva. In caso di fattura elettronica, è richiesta copia di cortesia via e-mail a amministrazione@formascuole.it.'}
          </Text>

          {/* ── SEZIONE 4 ── */}
          <Text style={s.sectionTitle}>4. Risoluzione anticipata</Text>
          <Text style={s.bodyText}>
            {'La collaborazione potrà essere risolta anticipatamente in caso di impossibilità sopravvenuta a proseguire le attività, o di mancato rispetto degli impegni assunti da una delle parti.\nIn tale caso, il compenso sarà riconosciuto solo per le attività effettivamente già svolte e debitamente documentate.'}
          </Text>

          {/* ── SEZIONE 5 ── */}
          <Text style={s.sectionTitle}>5. Trattamento dati e accettazione</Text>
          <Text style={s.bodyText}>
            {'I dati personali saranno trattati nel rispetto del Reg. UE 2016/679 (GDPR Privacy) ai soli fini previsti dalla normativa vigente.\nCon la firma della presente, l\'incaricato dichiara di aver preso visione e di accettare integralmente le condizioni qui indicate.'}
          </Text>

          {/* ── FIRME ── */}
          <View style={s.signaturesRow}>
            <View style={s.signatureBlock}>
              <Text style={s.signatureLabel}>Roma, {data.data}</Text>
              <Text style={[s.signatureLabel, { fontFamily: 'Helvetica-Bold' }]}>SVC Consulting Srl</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureCaption}>Firma autorizzata</Text>
            </View>
            <View style={s.signatureBlock}>
              <Text style={s.signatureLabel}>Per accettazione</Text>
              <Text style={[s.signatureLabel, { fontFamily: 'Helvetica-Bold' }]}>{data.formatore_nome}</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureCaption}>Firma del formatore</Text>
            </View>
          </View>

          {/* ── FOOTER FIRMA DIGITALE ── */}
          {data.firmata && firmataDate && firmataTime && (
            <View style={s.footerStamp}>
              <Text style={s.footerTextBold}>DOCUMENTO FIRMATO DIGITALMENTE</Text>
              <Text style={s.footerText}>
                {`Documento generato digitalmente dalla piattaforma Formascuole il ${firmataDate} alle ${firmataTime}`}
                {` — Accettazione elettronica registrata`}
                {data.firmata_ip ? ` (IP: ${data.firmata_ip}` : ''}
                {data.firmata_user_id ? ` | User ID: ${data.firmata_user_id}` : ''}
                {data.firmata_ip ? `)` : ''}
              </Text>
              <Text style={s.footerText}>{`Firmato da: ${data.formatore_nome}`}</Text>
            </View>
          )}

        </View>
      </Page>
    </Document>
  )
}

// ── Tutor PDF ─────────────────────────────────────────────────────────────────

function LetteraTutorPDF({ data }: { data: LetteraIncaricoTutor }) {
  const addrParts = [
    data.tutor_indirizzo,
    data.tutor_cap && data.tutor_citta
      ? `${data.tutor_cap} ${data.tutor_citta}${data.tutor_provincia ? ` (${data.tutor_provincia})` : ''}`
      : null,
    data.tutor_codice_fiscale ? `C.F. ${data.tutor_codice_fiscale}` : null,
  ].filter(Boolean)

  const firmataDate = data.firmata_at
    ? new Date(data.firmata_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  const firmataTime = data.firmata_at
    ? new Date(data.firmata_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── INTESTAZIONE ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerCompany}>SVC Consulting S.r.l.</Text>
            <Text style={s.headerInfo}>Via A. Vallisneri 7 – 00197 Roma</Text>
            <Text style={s.headerInfo}>P.IVA 07142321004 | Cod. Univ. M5UXCR1</Text>
            <Text style={s.headerInfoRed}>formascuole.it</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>LETTERA DI INCARICO</Text>
            <Text style={s.headerSubtitle}>Attività di tutoraggio</Text>
          </View>
        </View>
        <View style={s.redLine} />

        <View style={s.body}>

          {/* ── DATA ── */}
          <View style={s.dateRow}>
            <Text style={s.dateText}>Roma, {data.data}</Text>
          </View>

          {/* ── DESTINATARIO ── */}
          <View style={s.destBlock}>
            <Text style={s.destLabel}>Spett.le</Text>
            <Text style={s.destName}>{data.tutor_nome}</Text>
            {addrParts.map((p, i) => <Text key={i} style={s.destLine}>{p}</Text>)}
          </View>

          {/* ── OGGETTO ── */}
          <Text style={s.oggetto}>
            <Text style={s.oggettoLabel}>OGGETTO: </Text>
            {`Incarico di tutoraggio per attività di formazione${data.finanziamento_nome ? ` — ${data.finanziamento_nome}` : ''}`}
          </Text>

          <View style={s.divider} />

          {/* ── INTRO ── */}
          <Text style={s.bodyText}>
            {'Con la presente SVC Consulting S.r.l. Le conferisce incarico di tutoraggio per la seguente attività formativa:'}
          </Text>

          {/* ── TABELLA ── */}
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { width: colTutor.scuola }]}>Scuola / Progetto</Text>
              <Text style={[s.tableHeaderText, { width: colTutor.corso }]}>Corso</Text>
              <Text style={[s.tableHeaderText, { width: colTutor.ore, textAlign: 'center' }]}>Ore tutor.</Text>
              <Text style={[s.tableHeaderText, { width: colTutor.tariffa, textAlign: 'right' }]}>Tariffa oraria</Text>
              <Text style={[s.tableHeaderText, { width: colTutor.compenso, textAlign: 'right' }]}>Compenso lordo</Text>
            </View>
            <View style={s.tableRow}>
              <Text style={[s.tableCell, { width: colTutor.scuola, paddingRight: 4 }]}>{data.school_name}</Text>
              <Text style={[s.tableCell, { width: colTutor.corso, paddingRight: 4 }]}>{data.corso_title}</Text>
              <Text style={[s.tableCell, { width: colTutor.ore, textAlign: 'center' }]}>{data.ore_tutoraggio}h</Text>
              <Text style={[s.tableCell, { width: colTutor.tariffa, textAlign: 'right' }]}>
                {data.tariffa_tutor != null ? `€ ${data.tariffa_tutor.toFixed(2)}/h` : '—'}
              </Text>
              <Text style={[s.tableCell, s.bold, { width: colTutor.compenso, textAlign: 'right' }]}>
                {data.compenso_stimato != null ? `€ ${data.compenso_stimato.toFixed(2)}` : '—'}
              </Text>
            </View>
          </View>
          <Text style={s.bodyTextItalic}>
            {'Il compenso è da intendersi al lordo di oneri fiscali e previdenziali.'}
          </Text>

          {/* ── SEZIONE 1 ── */}
          <Text style={s.sectionTitle}>1. Modalità di svolgimento</Text>
          <Text style={s.bodyText}>
            {'L\'attività di tutoraggio dovrà essere realizzata nei giorni concordati con il formatore esperto incaricato da Formascuole e con l\'Istituto scolastico destinatario, in accordo con il referente di progetto dell\'Istituto.\nL\'attività potrà essere svolta in presenza oppure online (in modalità sincrona) o in modalità ibrida, coerentemente con il calendario concordato e con le finalità del percorso formativo assegnato.\nIl tutor d\'aula è tenuto a garantire la propria presenza — fisica o virtuale — durante tutte le attività didattiche, a supportare il formatore e a collaborare con l\'Istituto per la corretta gestione del modulo formativo.\nIn particolare, il tutor si impegna a:'}
          </Text>
          <View style={{ marginLeft: 8, marginBottom: 8 }}>
            <Bullet text={'Garantire l\'assistenza organizzativa e logistica durante lo svolgimento delle attività, sia in presenza che online;'} />
            <Bullet text={'Compilare e firmare il registro presenze (in formato cartaceo o digitale) unitamente ai partecipanti, laddove previsto;'} />
            <Bullet text={'Collaborare con il referente di progetto per la raccolta e la consegna dei registri di presenza e della documentazione richiesta per la rendicontazione;'} />
            <Bullet text={'Somministrare il questionario di gradimento tramite il link dedicato al corso, generato dalla piattaforma Formascuole e comunicato dalla Committenza, prima del termine dell\'ultima sessione del percorso di formazione/laboratorio sul campo;'} />
            <Bullet text={'Segnalare tempestivamente eventuali assenze o variazioni rispetto al calendario previsto;'} />
            <Bullet text={'Fornire, a conclusione delle attività, un breve report riepilogativo delle presenze e dell\'andamento del modulo (sintesi organizzativa).'} />
          </View>

          {/* ── SEZIONE 2 ── */}
          <Text style={s.sectionTitle}>2. Documentazione obbligatoria</Text>
          <Text style={s.bodyText}>
            {'Ai fini dell\'attivazione del presente incarico e della successiva liquidazione dei compensi, il tutor è tenuto a compilare e trasmettere, tramite i modelli predisposti da SVC Consulting S.r.l. (Formascuole), la seguente documentazione:'}
          </Text>
          <View style={{ marginBottom: 8 }}>
            <View style={s.numberedRow}>
              <Text style={s.numberedNum}>1.</Text>
              <View style={s.numberedContent}>
                <Text style={s.numberedText}>
                  {'Dichiarazione di insussistenza di cause di incompatibilità, conforme al modello disponibile al seguente link: '}
                </Text>
                <Link src="https://formascuole24-my.sharepoint.com/:b:/g/personal/formazione_formascuole24_onmicrosoft_com/EWWYGR9Gy4VBuYHi5-d7QxQB3HjRyeRaE2wblQHfAf591w?e=V81DjB&download=1"
                  style={s.linkText}>
                  {'→ Modulo Dichiarazione Insussistenza'}
                </Link>
              </View>
            </View>
            <View style={s.numberedRow}>
              <Text style={s.numberedNum}>2.</Text>
              <View style={s.numberedContent}>
                <Text style={s.numberedText}>
                  {'Curriculum vitae in formato europeo aggiornato e comprensivo di codice fiscale, firmato in calce – template disponibile al seguente link: '}
                </Text>
                <Link src="https://formascuole24-my.sharepoint.com/:w:/g/personal/formazione_formascuole24_onmicrosoft_com/ESvxSxp9bGNMnsFpGMVevVMBxfkEjQI-HqdW2LqNgQNgEw?web=1&action=copy"
                  style={s.linkText}>
                  {'→ Template CV Europeo'}
                </Link>
              </View>
            </View>
          </View>
          <Text style={s.bodyTextItalicRed}>
            {'La mancata compilazione o trasmissione della documentazione sopra elencata comporterà l\'impossibilità di validare la prestazione e, conseguentemente, la sospensione della liquidazione dei compensi fino all\'avvenuto adempimento.'}
          </Text>

          {/* ── SEZIONE 3 ── */}
          <Text style={s.sectionTitle}>3. Corrispettivo e modalità di pagamento</Text>
          <Text style={s.bodyText}>
            {'Il corrispettivo sopra indicato sarà riconosciuto a fronte delle ore effettivamente erogate e documentate, al lordo di oneri fiscali e previdenziali.\nIl pagamento sarà effettuato da:\nSVC Consulting S.r.l. — Via A. Vallisneri 7 – 00197 Roma — P.IVA 07142321004 – Codice Univoco M5UXCR1\ntramite bonifico bancario sull\'IBAN comunicato dal professionista, entro 60 giorni data fattura fine mese, previa verifica della corretta esecuzione dell\'incarico.'}
          </Text>
          <Text style={s.bodyText}>
            {'La fattura dovrà riportare la seguente dicitura:\n'}
            <Text style={{ fontFamily: 'Helvetica-Oblique' }}>
              {`"Attività di tutoraggio per il percorso di formazione ${data.corso_title} – ${data.ore_tutoraggio} ore – per/presso ${data.school_name}."`}
            </Text>
          </Text>
          <Text style={s.bodyText}>
            {'Ai fini del pagamento, è necessario inviare la fattura (o notula pro-forma) ai seguenti indirizzi:\npianificazione@formascuole.it\namministrazione@formascuole.it\n\nRicevuto il consenso alla liquidazione, potrà essere emessa la fattura definitiva. In caso di fattura elettronica, è richiesta copia di cortesia via e-mail a amministrazione@formascuole.it.\nLa liquidazione dei compensi è subordinata alla consegna della documentazione obbligatoria e alla validazione delle attività da parte dell\'Istituto e di SVC Consulting S.r.l.'}
          </Text>

          {/* ── SEZIONE 4 ── */}
          <Text style={s.sectionTitle}>4. Risoluzione anticipata</Text>
          <Text style={s.bodyText}>
            {'La collaborazione potrà essere risolta anticipatamente in caso di interruzione del progetto o di risoluzione del contratto tra la Committenza e SVC Consulting S.r.l., quale che sia la causa da ambo i lati, ovvero in caso di mancato rispetto degli impegni assunti da una delle parti.\nIn tal caso, il compenso sarà riconosciuto esclusivamente per le attività effettivamente già svolte, in proporzione alle ore di tutoraggio prestate e debitamente documentate.'}
          </Text>

          {/* ── SEZIONE 5 ── */}
          <Text style={s.sectionTitle}>5. Trattamento dati e accettazione</Text>
          <Text style={s.bodyText}>
            {'I dati personali saranno trattati nel rispetto del Reg. UE 2016/679 (GDPR Privacy) ai soli fini previsti dalla normativa vigente.\nCon la firma della presente, l\'incaricato dichiara di aver preso visione e di accettare integralmente le condizioni qui indicate.'}
          </Text>

          {/* ── FIRME ── */}
          <View style={s.signaturesRow}>
            <View style={s.signatureBlock}>
              <Text style={s.signatureLabel}>Roma, {data.data}</Text>
              <Text style={[s.signatureLabel, { fontFamily: 'Helvetica-Bold' }]}>SVC Consulting Srl</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureCaption}>Firma autorizzata</Text>
            </View>
            <View style={s.signatureBlock}>
              <Text style={s.signatureLabel}>Per accettazione</Text>
              <Text style={[s.signatureLabel, { fontFamily: 'Helvetica-Bold' }]}>{data.tutor_nome}</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureCaption}>Firma del tutor</Text>
            </View>
          </View>

          {/* ── FOOTER FIRMA DIGITALE ── */}
          {data.firmata && firmataDate && firmataTime && (
            <View style={s.footerStamp}>
              <Text style={s.footerTextBold}>DOCUMENTO FIRMATO DIGITALMENTE</Text>
              <Text style={s.footerText}>
                {`Documento generato digitalmente dalla piattaforma Formascuole il ${firmataDate} alle ${firmataTime}`}
                {` — Accettazione elettronica registrata`}
                {data.firmata_ip ? ` (IP: ${data.firmata_ip}` : ''}
                {data.firmata_user_id ? ` | User ID: ${data.firmata_user_id}` : ''}
                {data.firmata_ip ? `)` : ''}
              </Text>
              <Text style={s.footerText}>{`Firmato da: ${data.tutor_nome}`}</Text>
            </View>
          )}

        </View>
      </Page>
    </Document>
  )
}

// ── Exports ───────────────────────────────────────────────────────────────────

export async function generateLetteraIncaricoFormatorePdf(data: LetteraIncaricoFormatore): Promise<Buffer> {
  const buf = await renderToBuffer(<LetteraFormatorePDF data={data} />)
  return Buffer.from(buf)
}

export async function generateLetteraIncaricoTutorPdf(data: LetteraIncaricoTutor): Promise<Buffer> {
  const buf = await renderToBuffer(<LetteraTutorPDF data={data} />)
  return Buffer.from(buf)
}
