import { generateAvatarColor } from '@/lib/utils'

interface AvatarProps {
  nome: string
  id: string
  initials?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ nome, id, initials, size = 'md' }: AvatarProps) {
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'md' ? 'w-9 h-9 text-sm' : 'w-12 h-12 text-base'
  const letters = initials || nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const color = generateAvatarColor(id)

  return (
    <div
      className={`${sizeClass} ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
      title={nome}
    >
      {letters}
    </div>
  )
}
