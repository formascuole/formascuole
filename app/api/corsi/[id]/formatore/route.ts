import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { formatore_id } = await request.json()

  const updateData = formatore_id
    ? {
        formatore_id,
        stato_assegnazione: 'in_attesa',
        accettazione_richiesta_at: new Date().toISOString(),
        accettazione_risposta_at: null,
        rifiuto_motivazione: null,
      }
    : {
        formatore_id: null,
        stato_assegnazione: 'non_assegnato',
        accettazione_richiesta_at: null,
        accettazione_risposta_at: null,
        rifiuto_motivazione: null,
      }

  // Use admin client to bypass RLS — the auth check above already verified the caller is admin
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('corsi')
    .update(updateData)
    .eq('id', id)
    .select('*, formatore:profiles!formatore_id(id,nome,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger assignment email if a formatore was assigned
  if (formatore_id) {
    try {
      const { data: corso } = await adminClient
        .from('corsi')
        .select('*, project:progetti(school_name,address,ref_name,ref_email), formatore:profiles!formatore_id(nome,email)')
        .eq('id', id)
        .single()

      if (corso && corso.formatore && corso.project) {
        let ref_name = corso.project.ref_name
        let ref_email = corso.project.ref_email

        if (corso.referente_id) {
          const { data: referente } = await adminClient
            .from('referenti_progetto')
            .select('nome,email')
            .eq('id', corso.referente_id)
            .single()
          if (referente) { ref_name = referente.nome; ref_email = referente.email }
        }

        fetch(`${APP_URL}/api/email/assegnazione`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            corso_id: id,
            formatore_id,
            formatore_nome: corso.formatore.nome,
            formatore_email: corso.formatore.email,
            corso_title: corso.title,
            school_name: corso.project.school_name,
            ref_name,
            ref_email,
            ore_totali: corso.ore_totali,
            tipo: corso.tipo,
          }),
        }).catch(() => {})
      }
    } catch { /* ignore email errors */ }
  }

  return NextResponse.json(data)
}
