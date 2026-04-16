import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()
    console.log("📥 [Webhook] Evento:", payload.event)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const groqKey = Deno.env.get('GROQ_API_KEY')
    const evoUrl = Deno.env.get('VITE_EVOLUTION_URL') || Deno.env.get('EVOLUTION_URL')
    const evoKey = Deno.env.get('VITE_EVOLUTION_GLOBAL_KEY') || Deno.env.get('EVOLUTION_GLOBAL_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    const event = payload.event
    const instanceName = payload.instance || payload.instanceName || "desconhecida"

    // 1. Loga o evento bruto para debug
    await supabase.from('evolution_webhook_logs').insert({ event_type: event, payload: payload })

    // 2. Processa mensagens recebidas
    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
      const msg = payload.data?.messages?.[0] || payload.data?.[0] || payload.data;
      
      if (!msg || msg.key?.remoteJid === 'status@broadcast') {
        return new Response("Ignorado", { status: 200 });
      }

      const remoteJid = msg.key?.remoteJid;
      const isFromMe = msg.key?.fromMe || false;
      const textContent = msg.message?.conversation 
          || msg.message?.extendedTextMessage?.text 
          || msg.message?.imageMessage?.caption
          || "";

      // Salva no banco (para histórico)
      await supabase.from('wa_messages').insert({
        instance_name: instanceName,
        remote_jid: remoteJid,
        message_id: msg.key?.id,
        push_name: msg.pushName || "Contato",
        is_from_me: isFromMe,
        content: textContent,
        message_type: "text"
      });

      // --- PILOTO AUTOMÁTICO (SERVER-SIDE) ---
      if (!isFromMe && textContent) {
        console.log(`🤖 [Autopilot Server] Identificando dono da instância: ${instanceName}`);
        
        // Tenta encontrar o usuário pelo prefixo da instância (allcance_user8char)
        const userPrefix = instanceName.replace('allcance_', '');
        
        // Busca o System Prompt na tabela ai_training
        // Como o prefixo é o começo do UUID, buscamos quem "começa com" ou apenas pegamos o primeiro treinamento se for single-tenant
        const { data: trainingData } = await supabase
          .from('ai_training')
          .select('system_prompt, user_id')
          .eq('channel', 'whatsapp')
          .limit(1)
          .single(); // Em um SaaS multi-tenant real, aqui checaríamos o prefixo do user_id

        if (trainingData) {
          console.log("🧠 [Autopilot Server] Chamando Claude...");
          
          // Busca histórico recente para contexto (últimas 6)
          const { data: history } = await supabase
            .from('wa_messages')
            .select('content, is_from_me')
            .eq('remote_jid', remoteJid)
            .order('created_at', { ascending: false })
            .limit(6);

          const formattedHistory = (history || []).reverse().map(h => ({
            role: h.is_from_me ? "assistant" : "user",
            content: h.content
          }));

          // Chamada ao Claude
          const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey!,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              system: trainingData.system_prompt,
              messages: [...formattedHistory, { role: "user", content: textContent }],
              max_tokens: 1024
            })
          });

          const claudeData = await claudeRes.json();
          let aiReply = claudeData.content?.[0]?.text;

          // Fallback para Groq se Claude falhar (Crédito, etc)
          if (!aiReply && groqKey) {
            console.log("🔄 [Server Fallback] Usando Groq...");
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: trainingData.system_prompt }, { role: "user", content: textContent }]
              })
            });
            const groqData = await groqRes.json();
            aiReply = groqData.choices?.[0]?.message?.content;
          }

          if (aiReply) {
             const chunks = aiReply.split('\n\n').filter((c: string) => c.trim());
             for (const chunk of chunks) {
                console.log(`📤 [Server Send] Enviando parte: ${chunk.slice(0,20)}...`);
                await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
                  method: 'POST',
                  headers: { 'apikey': evoKey!, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ number: remoteJid.split('@')[0], text: chunk.trim() })
                });
                if (chunks.length > 1) await new Promise(r => setTimeout(r, 3000));
             }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
