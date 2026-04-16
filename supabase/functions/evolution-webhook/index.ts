import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Trata a requisição OPTIONS (CORS pré-requisição)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log("📥 [Webhook Recebido da Evolution API]:", JSON.stringify(payload))

    // Capturando variáveis de ambiente injetadas no Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Loga o evento bruto
    const event = payload.event
    const instanceName = payload.instance || payload.instanceName || "desconhecida"
    
    await supabase.from('evolution_webhook_logs').insert({
      event_type: event,
      payload: payload
    })

    // 2. Se for uma mensagem nova (MESSAGES_UPSERT)
    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
      const messages = payload.data?.messages || []
      
      for (const msg of messages) {
        // Ignora status de sistema, transmissões, etc.
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const isFromMe = msg.key.fromMe || false;
        const messageId = msg.key.id;
        const remoteJid = msg.key.remoteJid;
        const pushName = msg.pushName || "Desconhecido";
        
        // Pega o texto da mensagem com segurança (texto simples, estendido ou legenda de mídia)
        const textContent = msg.message?.conversation 
          || msg.message?.extendedTextMessage?.text 
          || msg.message?.imageMessage?.caption
          || "[Mídia/Outro Formato]";
          
        const messageType = Object.keys(msg.message || {})[0] || "unknown";

        console.log(`💬 Salvando mensagem de ${remoteJid}: ${textContent}`)

        // Salva na tabela wa_messages
        await supabase.from('wa_messages').insert({
          instance_name: instanceName,
          remote_jid: remoteJid,
          message_id: messageId,
          push_name: pushName,
          is_from_me: isFromMe,
          content: textContent,
          message_type: messageType
        })

        // ====== AQUI VOCÊ PODE INJETAR A CHAMADA DA SUA IA (GROQ) PARAA RESPONDER ======
        // Se isFromMe for false, a IA pode avaliar o textContent, gerar uma resposta
        // usando a API da Groq e em seguida mandar responder o cliente usando a Evolution API!
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Webhook processado" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("❌ [Erro Webhook]:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
