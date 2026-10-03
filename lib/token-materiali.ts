export function generateTokenMateriali(titoloCorso: string, schoolName: string): string {
  const slug = (titoloCorso + '-' + schoolName)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40)
  const rand = Math.random().toString(36).substring(2, 6)
  return `${slug}-${rand}`
}
