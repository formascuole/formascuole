'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ProgettoConStats, Profile, Finanziamento } from '@/lib/types'

// Fix Leaflet default icon URLs broken by webpack
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

const PIN_COLORS = {
  active: '#22c55e',
  pending: '#eab308',
  completed: '#6b7280',
  formatore: '#f97316',
}

function makePin(color: string, size = 28): L.DivIcon {
  const h = Math.round(size * 1.3)
  return L.divIcon({
    className: '',
    html: `<svg width="${size}" height="${h}" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
        fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="6" fill="white" fill-opacity="0.9"/>
    </svg>`,
    iconSize: [size, h],
    iconAnchor: [size / 2, h],
    popupAnchor: [0, -h],
  })
}

const ICONS = {
  active: makePin(PIN_COLORS.active),
  pending: makePin(PIN_COLORS.pending),
  completed: makePin(PIN_COLORS.completed),
  formatore: makePin(PIN_COLORS.formatore),
}

function statusLabel(s: string) {
  if (s === 'active') return 'Attivo'
  if (s === 'pending') return 'In attesa'
  return 'Concluso'
}
function statusColor(s: string) {
  if (s === 'active') return '#22c55e'
  if (s === 'pending') return '#eab308'
  return '#9ca3af'
}

// Invisible sub-component that flies the map to Italy on first render
function FlyToItaly() {
  const map = useMap()
  useEffect(() => {
    map.setView([41.9, 12.5], 6)
  }, [map])
  return null
}

export interface LeafletMapProps {
  progetti: ProgettoConStats[]
  formatori: Profile[]
  finanziamenti: Finanziamento[]
  corsiPerFormatore: Record<string, number>
  showScuole: boolean
  showFormatori: boolean
  finanziamentoFilter: string
  statusFilter: string
}

export function LeafletMap({
  progetti,
  formatori,
  finanziamenti,
  corsiPerFormatore,
  showScuole,
  showFormatori,
  finanziamentoFilter,
  statusFilter,
}: LeafletMapProps) {
  useEffect(() => { fixLeafletIcons() }, [])

  const finMap = new Map(finanziamenti.map(f => [f.id, f.nome]))

  const filteredProgetti = showScuole
    ? progetti.filter(p => {
        if (!p.lat || !p.lng) return false
        if (finanziamentoFilter && p.finanziamento_id !== finanziamentoFilter) return false
        if (statusFilter && p.status !== statusFilter) return false
        return true
      })
    : []

  const filteredFormatori = showFormatori
    ? formatori.filter(f => f.lat && f.lng)
    : []

  return (
    <MapContainer
      center={[41.9, 12.5]}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToItaly />

      {filteredProgetti.map(p => (
        <Marker
          key={p.id}
          position={[Number(p.lat), Number(p.lng)]}
          icon={ICONS[p.status as keyof typeof ICONS] ?? ICONS.completed}
        >
          <Popup maxWidth={240}>
            <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.school_name}</div>
              <div style={{ marginBottom: 6 }}>
                <span style={{
                  display: 'inline-block',
                  background: statusColor(p.status) + '22',
                  color: statusColor(p.status),
                  borderRadius: 6,
                  padding: '1px 8px',
                  fontWeight: 600,
                  fontSize: 12,
                }}>
                  {statusLabel(p.status)}
                </span>
              </div>
              <div style={{ color: '#555', marginBottom: 2 }}>
                <strong>Corsi:</strong> {p.n_corsi}
              </div>
              {p.finanziamento_id && finMap.get(p.finanziamento_id) && (
                <div style={{ color: '#555', marginBottom: 2 }}>
                  <strong>Finanziamento:</strong> {finMap.get(p.finanziamento_id)}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <a
                  href={`/progetti/${p.id}`}
                  style={{ color: '#d64b55', fontWeight: 600, textDecoration: 'none' }}
                >
                  Vai al progetto →
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {filteredFormatori.map(f => (
        <Marker
          key={f.id}
          position={[Number(f.lat), Number(f.lng)]}
          icon={ICONS.formatore}
        >
          <Popup maxWidth={220}>
            <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{f.nome}</div>
              {f.regione && (
                <div style={{ color: '#555', marginBottom: 2 }}>
                  <strong>Regione:</strong> {f.regione}
                </div>
              )}
              <div style={{ color: '#555', marginBottom: 2 }}>
                <strong>Corsi assegnati:</strong> {corsiPerFormatore[f.id] ?? 0}
              </div>
              <div style={{ marginTop: 8 }}>
                <a
                  href={`/formatori/${f.id}`}
                  style={{ color: '#f97316', fontWeight: 600, textDecoration: 'none' }}
                >
                  Vai al profilo →
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
