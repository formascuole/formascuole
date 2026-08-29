import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tipo = req.nextUrl.searchParams.get('tipo') as 'cv' | 'ci' | 'cf' | null
  const targetUserId = req.nextUrl.searchParams.get('utente_id')
  if (!tipo || !['cv', 'ci', 'cf'].includes(tipo)) {
    return NextResponse.json({ error: 'tipo non valido' }, { status: 400 })
  }

  const admin = createAdminClient()
  let resolvedUserId = user.id

  if (targetUserId && targetUserId !== user.id) {
    // Admins can view documents of any user
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!['admin', 'super_admin'].includes(callerProfile?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    resolvedUserId = targetUserId
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('cv_url, ci_url, cf_url')
    .eq('id', resolvedUserId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const path = tipo === 'cv' ? profile.cv_url : tipo === 'ci' ? profile.ci_url : profile.cf_url
  if (!path) return NextResponse.json({ error: 'Documento non caricato' }, { status: 404 })

  const { data, error } = await admin.storage
    .from('documenti-formatori')
    .createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Impossibile generare URL firmato' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
