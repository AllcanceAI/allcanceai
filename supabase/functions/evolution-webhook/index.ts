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
    const event = payload.event
    const instanceName = payload.instance || payload.instanceName || "desconhecida"
    
    console.log(`📥 [Webhook] Evento: ${event} na instância: ${instanceName}`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const groqKey = Deno.env.get('GROQ_API_KEY')
    const evoUrl = Deno.env.get('EVOLUTION_URL')
    const evoKey = Deno.env.get('EVOLUTION_GLOBAL_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Salva LOG Bruto
    await supabase.from('evolution_webhook_logs').insert({ event_type: event, payload: payload })

    // 2. Processa Mensagens
    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
      // Tenta extrair a mensagem de várias formas possíveis (v1 e v2)
      let msg = null;
      if (payload.data?.messages?.[0]) msg = payload.data.messages[0];
      else if (payload.data?.key) msg = payload.data;
      else if (Array.isArray(payload.data)) msg = payload.data[0];

      if (!msg || msg.key?.remoteJid === 'status@broadcast') {
        console.log("⏭️ [Filtro] Mensagem ignorada ou vazia.")
        return new Response("OK", { status: 200 });
      }

      let remoteJid = msg.key?.remoteJid;
      const isFromMe = msg.key?.fromMe || false;

      // Se for sincronia do celular (@lid), tenta descobrir quem é o destinatário real lá dentro (protegido contra null)
      if (isFromMe && remoteJid?.includes('@lid')) {
         const innerMsg = msg.message?.deviceSentMessage?.message;
         if (innerMsg?.key?.remoteJid) remoteJid = innerMsg.key.remoteJid;
      }

      // Extrai a mensagem real (desempacota deviceSentMessage)
      const realMsg = msg.message?.deviceSentMessage?.message 
                   || msg.message?.documentWithCaptionMessage?.message 
                   || msg.message;

      const textContent = realMsg?.conversation 
          || realMsg?.extendedTextMessage?.text 
          || realMsg?.imageMessage?.caption
          || realMsg?.videoMessage?.caption
          || realMsg?.documentMessage?.caption
          || "";

      console.log(`💬 Conteúdo Extraído: "${textContent}" | isFromMe: ${isFromMe} | Tem Groq: ${!!groqKey}`)

      let finalContent = textContent;

      // --- TRANSCRIÇÃO DE ÁUDIO (WHISPER) ---
      const hasAudio = !!(realMsg?.audioMessage);
      if (!isFromMe && !finalContent.trim() && hasAudio && groqKey) {
        const fullEvoUrl = evoUrl?.includes('http') ? evoUrl : `http://2.24.203.75:8080`;
        console.log(`🎙️ [Áudio Detectado] Baixando de: ${fullEvoUrl}/chat/getBase64FromMediaMessage/${instanceName}`);
        
        try {
          const b64res = await fetch(`${fullEvoUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evoKey!, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
          });
          
          if (!b64res.ok) {
            const errTxt = await b64res.text();
            console.error(`❌ Erro Evolution (${b64res.status}): ${errTxt}`);
            return new Response("OK", { status: 200 });
          }
          
          const contentType = b64res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
             const rawRes = await b64res.text();
             console.error(`❌ Resposta da Evolution não é JSON! Recebido: ${rawRes.substring(0,100)}`);
             return new Response("OK", { status: 200 });
          }

          const b64data = await b64res.json();
          if (b64data && b64data.base64) {
             console.log("📦 [Download OK] Tamanho Base64:", b64data.base64.length);
             const rawB64 = b64data.base64.replace(/^data:audio\/\w+;base64,/, '');
             const byteCharacters = atob(rawB64);
             const byteNumbers = new Array(byteCharacters.length);
             for (let i = 0; i < byteCharacters.length; i++) {
                 byteNumbers[i] = byteCharacters.charCodeAt(i);
             }
             const byteArray = new Uint8Array(byteNumbers);
             const audioBlob = new Blob([byteArray], { type: 'audio/ogg' });
             
             console.log("🪄 [Whisper] Enviando para Groq (whisper-large-v3)...");
             const formData = new FormData();
             formData.append('file', audioBlob, 'audio.ogg');
             formData.append('model', 'whisper-large-v3');
             formData.append('language', 'pt');
             
             const txRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqKey}` },
                body: formData
             });
             
             if (!txRes.ok) {
               const txErr = await txRes.text();
               console.error(`❌ Erro Groq Whisper: Status ${txRes.status} | Resposta: ${txErr}`);
             }
             
             const txData = await txRes.json();
             if (txData.text) {
                finalContent = `[MENSAGEM DE ÁUDIO TRANSCRITA PELO SISTEMA]: "${txData.text}"`;
                console.log("✅ [Transcrição Sucesso]:", txData.text);
             }
          } else {
             console.warn("⚠️ Evolutuion retornou JSON sem o campo 'base64'.");
          }
        } catch(audioErr) {
          console.error("❌ Erro catastrófico na transcrição:", audioErr.message);
        }
      } else if (hasAudio && !groqKey) {
        console.warn("⚠️ Áudio recebido mas GROQ_API_KEY não foi encontrada nos Secrets da Supabase!");
      }

      // Salva no banco wa_messages DEPOIS da transcrição (Para o front-end pegar via Realtime perfeitamente)
      await supabase.from('wa_messages').insert({
        instance_name: instanceName,
        remote_jid: remoteJid,
        message_id: msg.key?.id,
        push_name: msg.pushName || "Contato",
        is_from_me: isFromMe,
        content: finalContent,
        message_type: "text"
      });

      // --- DISPARO DA IA ---
      if (!isFromMe && finalContent.trim()) {
        console.log("🦾 [IA] Iniciando processamento...")

        // Busca treinamento no banco
        const { data: trainingData } = await supabase
          .from('ai_training')
          .select('system_prompt, is_active')
          .eq('channel', 'whatsapp')
          .limit(1)
          .maybeSingle();

        // Se a IA foi desligada no aplicativo, o servidor deve respeitar a trava
        if (trainingData && trainingData.is_active === false) {
          console.log("⏸️ [IA Desativada Globalmente] O botão de IA automática está OFF. Ignorando mensagem.");
          return new Response("OK", { status: 200 });
        }

        const FinalSystemPrompt = trainingData?.system_prompt || "Você é o AllcanceAI, um assistente virtual inteligente. Responda de forma curta e amigável em português.";

        // Busca Contexto (6 últimas)
        const { data: history } = await supabase
          .from('wa_messages')
          .select('content, is_from_me')
          .eq('remote_jid', remoteJid)
          .order('created_at', { ascending: false })
          .limit(6);

        const messages = (history || []).reverse().map(h => ({
          role: h.is_from_me ? "assistant" : "user",
          content: h.content
        }));

        // Se o último do histórico já for o texto atual, não duplica
        if (messages.length > 0 && messages[messages.length - 1].content === finalContent && messages[messages.length - 1].role === "user") {
           // Já está lá
        } else {
           messages.push({ role: "user", content: finalContent });
         }

        console.log(`🧠 [Claude] Chamando modelo Haiku 4.5...`)
        
        let aiResult = "";
        try {
          const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey!,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: "claude-3-5-sonnet-20241022", // Usando Sonnet temporariamente para garantir
              system: FinalSystemPrompt,
              messages: messages,
              max_tokens: 1024
            })
          });
          const cData = await claudeRes.json();
          aiResult = cData.content?.[0]?.text || "";
        } catch (e) {
          console.error("❌ Erro Claude:", e.message)
        }

        // FALLBACK GROQ
        if (!aiResult && groqKey) {
           console.log("🔄 [Fallback] Usando Groq Llama 3...")
           const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
             method: "POST",
             headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
             body: JSON.stringify({
               model: "llama-3.3-70b-versatile",
               messages: [{ role: "system", content: FinalSystemPrompt }, ...messages]
             })
           });
           const gData = await groqRes.json();
           aiResult = gData.choices?.[0]?.message?.content || "";
        }

        if (aiResult) {
          const chunks = aiResult.split('\n\n').filter((c: string) => c.trim().length > 0);
          const fullEvoUrl = evoUrl?.includes('http') ? evoUrl : `http://2.24.203.75:8080`;
          
          for (const chunk of chunks) {
            console.log(`📤 [Evolution] Enviando bolha...`)
            const sendRes = await fetch(`${fullEvoUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: { 'apikey': evoKey!, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: remoteJid.split('@')[0], text: chunk.trim() })
            });

            if (sendRes.ok) {
              const sendData = await sendRes.json();
              await supabase.from('wa_messages').upsert({
                instance_name: instanceName,
                remote_jid: remoteJid,
                message_id: sendData.key?.id || `ai-${Date.now()}`,
                push_name: "Assistente IA",
                is_from_me: true,
                content: chunk.trim(),
                message_type: "text"
              }, { onConflict: 'message_id' });
            }

            if (chunks.length > 1) await new Promise(r => setTimeout(r, 3000));
          }
        } else {
          console.log("⚠️ [IA] Nenhuma resposta gerada.")
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error("🚨 [Erro Fatal]:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
