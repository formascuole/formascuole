export const RUOLI_REFERENTE = [
  'Dirigente Scolastico',
  'Referente Progetto',
  'Animatore Digitale',
  'Team Innovazione',
  'Altro',
] as const

export type RuoloReferente = (typeof RUOLI_REFERENTE)[number]

export const RUOLO_BADGE: Record<string, { bg: string; text: string }> = {
  'Dirigente Scolastico': { bg: 'bg-blue-900', text: 'text-white' },
  'Referente Progetto':   { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Animatore Digitale':   { bg: 'bg-green-100', text: 'text-green-700' },
  'Team Innovazione':     { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Altro':                { bg: 'bg-gray-100', text: 'text-gray-600' },
}
