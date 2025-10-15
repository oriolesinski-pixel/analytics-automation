import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/app-layout'
import { Profile, Workspace } from '@/lib/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Profile error:', profileError)
  }

  if (!profile) {
    console.error('No profile found for user:', user.id)
    redirect('/login')
  }

  // Get user's workspace
  const { data: workspaceMember, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (memberError) {
    console.error('Workspace member error:', memberError)
  }

  if (!workspaceMember) {
    console.error('No workspace member found for user:', user.id)
    redirect('/login')
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceMember.workspace_id)
    .single()

  if (workspaceError) {
    console.error('Workspace error:', workspaceError)
  }

  if (!workspace) {
    console.error('No workspace found for id:', workspaceMember.workspace_id)
    redirect('/login')
  }

  console.log('✅ Dashboard layout loaded successfully for:', user.email)

  return (
    <AppLayout user={profile as Profile} workspace={workspace as Workspace}>
      {children}
    </AppLayout>
  )
}

