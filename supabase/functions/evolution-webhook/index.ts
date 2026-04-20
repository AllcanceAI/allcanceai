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
    const fullEvoUrl = evoUrl?.includes('http') ? evoUrl : `http://2.24.203.75:8080`;
    
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

        // Busca treinamento no banco (Garante pegar a regra mais recente)
        const { data: trainingData } = await supabase
          .from('ai_training')
          .select('system_prompt, is_active')
          .eq('channel', 'whatsapp')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Se a IA foi desligada explicitamente, respeita
        if (trainingData?.is_active === false) {
          console.log("⏸️ [IA] Desativada.");
          return new Response("OK", { status: 200 });
        }

        const FinalSystemPrompt = trainingData?.system_prompt || "Você é o AllcanceAI, um assistente virtual inteligente. Responda de forma curta e amigável em português.";

        // Busca Contexto (10 últimas para mais inteligência)
        const { data: history } = await supabase
          .from('wa_messages')
          .select('content, is_from_me, created_at')
          .eq('remote_jid', remoteJid)
          .order('created_at', { ascending: false })
          .limit(10);

        const rawHistory = (history || [])
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const formattedMessages: { role: "user" | "assistant", content: string }[] = [];
        
        // Normaliza o histórico: Garante alternância e remove duplicatas
        for (const h of rawHistory) {
          const role = h.is_from_me ? "assistant" : "user";
          if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === role) {
            // Se o papel for o mesmo, anexa o conteúdo (evita erro da Claude/OpenAI)
            formattedMessages[formattedMessages.length - 1].content += "\n" + h.content;
          } else {
            formattedMessages.push({ role, content: h.content });
          }
        }

        // Adiciona a mensagem atual (se ainda não estiver no topo)
        if (formattedMessages.length === 0 || formattedMessages[formattedMessages.length - 1].content !== finalContent) {
          if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === "user") {
            formattedMessages[formattedMessages.length - 1].content += "\n" + finalContent;
          } else {
            formattedMessages.push({ role: "user", content: finalContent });
          }
        }

        // REGRA DE OURO: Claude exige começar com 'user'
        while (formattedMessages.length > 0 && formattedMessages[0].role !== "user") {
          formattedMessages.shift();
        }

        const messages = formattedMessages;

        let aiResult = "";

        if (messages.length > 0) {
          console.log(`🧠 [Claude] Chamando modelo claude-haiku-4-5-20251001...`)
          
          try {
            const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKey!,
                "anthropic-version": "2023-06-01"
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                system: FinalSystemPrompt,
                messages: messages,
                max_tokens: 1024
              })
            });

            if (!claudeRes.ok) {
              const errBody = await claudeRes.text();
              console.error(`❌ Erro Claude API (${claudeRes.status}):`, errBody);
            } else {
              const cData = await claudeRes.json();
              aiResult = cData.content?.[0]?.text || "";
            }
          } catch (e) {
            console.error("🚨 Erro de Rede Claude:", e.message);
          }
        } else {
          console.warn("⚠️ [IA] Histórico de mensagens vazio. Pulando Claude.");
        }

        // FALLBACK GROQ (Se Claude falhou ou não retornou texto)
        if (!aiResult && groqKey && messages.length > 0) {
           console.log("🔄 [Fallback] Usando Groq Llama 3...")
           try {
             const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
               method: "POST",
               headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
               body: JSON.stringify({
                 model: "llama-3.3-70b-versatile",
                 messages: [{ role: "system", content: FinalSystemPrompt }, ...messages]
               })
             });

             if (!groqRes.ok) {
               const errBody = await groqRes.text();
               console.error(`❌ Erro Groq API (${groqRes.status}):`, errBody);
             } else {
               const gData = await groqRes.json();
               aiResult = gData.choices?.[0]?.message?.content || "";
             }
           } catch (e) {
             console.error("🚨 Erro de Rede Groq:", e.message);
           }
        }

        if (aiResult) {
          const chunks = aiResult.split('\n\n').filter((c: string) => c.trim().length > 0);
          
          for (const chunk of chunks) {
            console.log(`📤 [Evolution] Enviando bolha...`)
            const sendRes = await fetch(`${fullEvoUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: { 'apikey': evoKey!, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: remoteJid, text: chunk.trim() })
            });

            const sendStatus = sendRes.status;
            const sendData = await sendRes.json();
            console.log(`📡 [Evolution Response] Status: ${sendStatus}`, sendData);

            if (sendRes.ok) {
              await supabase.from('wa_messages').insert({
                instance_name: instanceName,
                remote_jid: remoteJid,
                message_id: sendData.key?.id || `ai-${Date.now()}`,
                push_name: "Assistente IA",
                is_from_me: true,
                content: chunk.trim(),
                message_type: "text"
              });
            } else {
              console.error(`🚨 [Evolution Falhou] Erro ao enviar para ${remoteJid}:`, sendData);
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
