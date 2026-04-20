import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lkgfsraodakpdwweldip.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrZ2ZzcmFvZGFrcGR3d2VsZGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTcwNjMsImV4cCI6MjA5MTQzMzA2M30.TQIBEW9JPWk150ACMPPhj7EMxihQ_fzD1nR5uTpki7M'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log("Checando tabela evolution_webhook_logs...")
  const { data: logs, error: err1 } = await supabase.from('evolution_webhook_logs').select('*').limit(1)
  console.log("Logs exist?", logs && logs.length > 0, "Erro:", err1)

  console.log("Checando tabela wa_messages...")
  const { data: msgs, error: err2 } = await supabase.from('wa_messages').select('*').limit(1)
  console.log("Msgs exist?", msgs && msgs.length > 0, "Erro:", err2)
}

test()
