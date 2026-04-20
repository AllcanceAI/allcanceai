import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log("Checando tabela evolution_webhook_logs...")
  const { data: logs, error: err1 } = await supabase.from('evolution_webhook_logs').select('*').limit(5)
  console.log("Logs:", logs, "Erro:", err1)

  console.log("Checando tabela wa_messages...")
  const { data: msgs, error: err2 } = await supabase.from('wa_messages').select('*').limit(5)
  console.log("Msgs:", msgs, "Erro:", err2)
}

test()
