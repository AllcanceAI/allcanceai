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
    const DEBUG_AI = true;

    const maskSensitive = (text: string) => {
      if (!text) return "";
      return text
        .replace(/\b\d{10,13}\b/g, (m) => m.slice(0, 4) + "****" + m.slice(-4))
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "email@mascarado.com");
    };
    
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

      const messageId = msg.key?.id;
      if (messageId) {
        try {
          const { data: existing } = await supabase
            .from('wa_messages')
            .select('id')
            .eq('message_id', messageId)
            .maybeSingle();
          
          if (existing) {
            console.log(`🚫 [Deduplicação] Mensagem ${messageId} já processada. Ignorando.`);
            return new Response("OK", { status: 200 });
          }
        } catch (dbErr) {
          console.warn("⚠️ Falha ao verificar deduplicação (tabela wa_messages pode estar mudando):", dbErr.message);
        }
      }

      const pushName = msg.pushName || "Contato";
      let remoteJid = msg.key?.remoteJid;
      const isFromMe = msg.key?.fromMe || false;

      // Se for sincronia do celular (@lid), tenta descobrir quem é o destinatário real lá dentro
      if (isFromMe && remoteJid?.includes('@lid')) {
         const innerMsg = msg.message?.deviceSentMessage?.message;
         if (innerMsg?.key?.remoteJid) remoteJid = innerMsg.key.remoteJid;
      }
      
      // Converte @lid para @s.whatsapp.net se necessário
      if (remoteJid && remoteJid.includes('@lid')) {
        remoteJid = remoteJid.replace('@lid', '@s.whatsapp.net');
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

      // Salva no banco wa_messages (Para o front-end pegar via Realtime)
      try {
        await supabase.from('wa_messages').insert({
          instance_name: instanceName,
          remote_jid: remoteJid,
          message_id: msg.key?.id,
          push_name: pushName,
          is_from_me: isFromMe,
          content: finalContent,
          message_type: "text"
        });
      } catch (dbErr) {
        console.error("❌ Erro ao salvar em wa_messages (Realtime):", dbErr.message);
      }

      // --- DISPARO DA IA ---
      if (!isFromMe && finalContent.trim()) {
        console.log("🦾 [IA] Iniciando processamento...")

        // Busca treinamento no banco
        const { data: trainingData } = await supabase
          .from('ai_training')
          .select('system_prompt, is_active')
          .eq('channel', 'whatsapp')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log(`🤖 [IA Config] Global Active: ${trainingData?.is_active}`);

        // Se a IA foi desligada explicitamente, respeita (trata null como true)
        if (trainingData?.is_active === false) {
          console.log("⏸️ [IA] Desativada Globalmente.");
          return new Response("OK", { status: 200 });
        }

        // Verifica se este chat específico está desativado
        try {
          const { data: isDisabled } = await supabase
            .from('ai_disabled_chats')
            .select('id')
            .eq('chat_id', remoteJid)
            .eq('channel', 'whatsapp')
            .maybeSingle();
          
          if (isDisabled) {
             console.log(`⏸️ [IA] Desativada para o chat: ${remoteJid}`);
             return new Response("OK", { status: 200 });
          }
        } catch (e) {
          console.warn("⚠️ Tabela ai_disabled_chats não encontrada ou erro na busca. Continuando...");
        }
        console.log("🔥 [IA] Passou nas travas. Chamando Claude...");

        // --- 1. CARREGA MEMÓRIA DO CONTATO ---
        let contactMemory = {};
        try {
          const { data: memory } = await supabase
            .from('ai_contact_memory')
            .select('*')
            .eq('phone', remoteJid)
            .maybeSingle();
          
          if (memory) {
            contactMemory = memory;
          } else {
            // Cria entrada inicial se não existir
            await supabase.from('ai_contact_memory').insert({ phone: remoteJid, name: pushName });
          }
        } catch (e) {
          console.warn("⚠️ Erro ao acessar ai_contact_memory:", e.message);
        }

        // --- MONTAGEM DO PROMPT EM 3 CAMADAS ---
        const FinalSystemPrompt = `
<PRIORIDADES_DE_EXECUCAO>
1. NUNCA inventar informações não contidas no treinamento.
2. Seguir rigorosamente os dados reais da loja.
3. Manter o fluxo comercial em todas as interações.
4. Responder de forma natural, curta e humana.
</PRIORIDADES_DE_EXECUCAO>

<REGRAS_DE_QUALIDADE_E_ELEGANCIA>
- Máximo de 2 blocos curtos por resposta.
- Apenas 1 pergunta principal por vez (foco total).
- CONTRADIÇÃO: Se o cliente mudar de ideia (ex: mudar tamanho ou qtd), priorize a MENSAGEM dele e atualize a memória. NUNCA tente convencê-lo do dado antigo.
- SAUDAÇÃO: Se o histórico já tem mensagens, NUNCA use "Olá", "Tudo bem" ou saudações iniciais. Vá direto ao ponto.
- Se o cliente já confirmou (etapa: fechamento), não volte para descobertas, mas responda dúvidas técnicas sem perder o foco do pedido.
- Se a memória diz que o catálogo ou formulário já foi enviado, não envie novamente a menos que explicitamente solicitado ("manda de novo").
</REGRAS_DE_QUALIDADE_E_ELEGANCIA>

<SYSTEM_FIXO>
${trainingData?.system_prompt || "Você é o atendente da Fabricante Primme..."}
</SYSTEM_FIXO>

<CONTEXTO_DINAMICO_DO_CONTATO>
- Nome: ${contactMemory.name || 'Não identificado'}
- Etapa Atual: ${contactMemory.etapa || 'Interesse Inicial'}
- Produto de Interesse: ${contactMemory.produto_interesse || 'Indefinido'}
- Tamanho/Grade: ${contactMemory.tamanho || 'Não informado'}
- Quantidade/Preço: ${contactMemory.quantidade || 'Abaixo do mínimo'} | Total: ${contactMemory.total || '0'}
- Frete/Logística: ${contactMemory.frete || 'Não calculado'}
- Objeções Identificadas: ${contactMemory.objecoes || 'Nenhuma'}
- Catálogo/Formulário: Catálogo (${contactMemory.catalogo_enviado ? 'SIM' : 'NÃO'}) | Form (${contactMemory.formulario_enviado ? 'SIM' : 'NÃO'})
- RESUMO E PROMESSAS: ${contactMemory.resumo || 'Nova conversa iniciada.'}
</CONTEXTO_DINAMICO_DO_CONTATO>

REGRA DE ATUALIZAÇÃO (OBRIGATÓRIO):
Ao final da resposta, use a tag <update_memory> com um JSON. 
REGRAS DE CONFIANÇA:
- Só atualize um campo se tiver ABSOLUTA CERTEZA. 
- Se o dado for ambíguo, omita o campo do JSON para preservar o valor anterior.
- Se a etapa mudou (ex: de 'negociacao' para 'fechamento'), atualize o campo 'etapa'.
Campos e Atalhos: {name, idioma, pais, etapa, produto, tamanho, quantidade, frete, total, objecoes, resumo, catalogo_enviado, formulario_enviado, formulario_preenchido}
        `.trim();

        // Busca Contexto focado (40 mensagens são ideais para manter foco e evitar ruído)
        const { data: historyData } = await supabase
          .from('wa_messages')
          .select('content, is_from_me, created_at, message_id')
          .eq('remote_jid', remoteJid)
          .order('created_at', { ascending: false })
          .limit(40);

        const rawHistory = (historyData || []).reverse();
        const seenIds = new Set(rawHistory.map(m => m.message_id).filter(Boolean));

        const formattedMessages: { role: "user" | "assistant", content: string }[] = [];
        
        // Se o primeiro do histórico for Assistant, garantimos um contexto para a Claude não falhar
        if (rawHistory.length > 0 && rawHistory[0].is_from_me) {
           formattedMessages.push({ role: "user", content: "Olá!" }); // Placeholder inicial natural
        }

        // Montagem do histórico com agrupamento de bolhas
        for (const h of rawHistory) {
          const role = h.is_from_me ? "assistant" : "user";
          if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === role) {
            formattedMessages[formattedMessages.length - 1].content += "\n" + h.content;
          } else {
            formattedMessages.push({ role, content: h.content });
          }
        }

        // Adiciona a mensagem atual (se já não estiver lá)
        if (!seenIds.has(messageId)) {
          if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === "user") {
            formattedMessages[formattedMessages.length - 1].content += "\n" + finalContent;
          } else {
            formattedMessages.push({ role: "user", content: finalContent });
          }
        }

        // Certifica que o último é o usuário e remove vazios
        if (formattedMessages.length === 0 || formattedMessages[formattedMessages.length - 1].role !== "user") {
           formattedMessages.push({ role: "user", content: finalContent });
        }

        const messages = formattedMessages;

        if (DEBUG_AI) {
           console.log(`\n--- 🛡️ AI AUDIT TRACE [${remoteJid}] ---`);
           console.log(`📍 Etapa: ${contactMemory.etapa}`);
           console.log(`📚 Histórico Enviado: ${messages.length} mensagens reduzidas`);
           console.log(`🧠 Memória Dinâmica:\n${maskSensitive(JSON.stringify(contactMemory, null, 2))}`);
           console.log(`📝 Payload Final (Preview):\n${maskSensitive(FinalSystemPrompt.slice(0, 300))}...`);
           console.log("------------------------------------------\n");
        }

        let aiResult = "";

        if (messages.length > 0) {
          console.log(`🧠 [Claude] Chamando modelo claude-sonnet-4-5...`)
          
          try {
            const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKey!,
                "anthropic-version": "2023-06-01"
              },
              body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
                system: FinalSystemPrompt,
                messages: messages,
                max_tokens: 1024,
                temperature: 0.3
              })
            });

            if (!claudeRes.ok) {
              const errBody = await claudeRes.text();
              console.error(`❌ Erro Claude API (${claudeRes.status}):`, errBody);
            } else {
              const cData = await claudeRes.json();
              aiResult = cData.content[0].text;

            // --- 4. VALIDAÇÃO DE QUALIDADE (GUARD) ---
            if (!aiResult || aiResult.length < 2) return new Response("OK", { status: 200 });

            // Truncamento Inteligente (Melhoria de Elegância)
            const truncateSmart = (text: string, limit: number = 1000) => {
               if (text.length <= limit) return text;
               const sub = text.slice(0, limit);
               const lastNewline = sub.lastIndexOf('\n');
               const lastPeriod = sub.lastIndexOf('.');
               let cutIdx = (lastNewline > limit * 0.7) ? lastNewline : lastPeriod;
               if (cutIdx <= 0) cutIdx = limit;
               // Proteção básica para não cortar links ao meio
               const remaining = text.slice(cutIdx);
               if (remaining.startsWith("http") || remaining.startsWith("www")) {
                  const firstSpace = remaining.indexOf(" ");
                  if (firstSpace !== -1) cutIdx += firstSpace;
               }
               return text.slice(0, cutIdx).trim() + "...";
            };

            if (aiResult.length > 1200) {
               console.warn("⚠️ Resposta muito longa detectada. Truncando inteligentemente...");
               aiResult = truncateSmart(aiResult, 1000);
            }

            // Impede reenvio de formulário desnecessário
            if (contactMemory.formulario_enviado && (aiResult.includes("formulário") || aiResult.includes("forms.gle"))) {
               const lowerMsg = aiResult.toLowerCase();
               if (!lowerMsg.includes("pediu") && !lowerMsg.includes("manda de novo")) {
                  console.warn("⚠️ IA tentou reenviar formulário já enviado. Limpando menção redundante.");
                  aiResult = aiResult.replace(/.*(Link do formulário|preencha aqui|https:\/\/forms).*/gi, "Já te mandei o link ali em cima, qualquer dúvida me avisa!");
               }
            }

            // --- 5. ATUALIZA MEMÓRIA E LIMPA RESPOSTA ---
            const allMemoryMatches = [...aiResult.matchAll(/<update_memory>([\s\S]*?)<\/update_memory>/g)];
            if (allMemoryMatches.length > 0) {
              const lastMatch = allMemoryMatches[allMemoryMatches.length - 1];
              try {
                const updates = JSON.parse(lastMatch[1].trim());
                
                // --- HARDENING: Proteção de Sobrescrita e Regressão ---
                const dbUpdates: any = { last_interaction_at: new Date().toISOString() };
                
                // --- VALIDAÇÃO E COERÇÃO DE TIPOS ---
                const toNum = (val: any) => {
                   if (val === undefined || val === null || val === "") return null;
                   const n = Number(String(val).replace(/[^\d.-]/g, ''));
                   return isNaN(n) ? null : String(n); // Mantemos como String no DB mas validamos número
                };

                const toBool = (val: any) => {
                   if (typeof val === 'boolean') return val;
                   if (val === 'true' || val === 1 || val === "1") return true;
                   if (val === 'false' || val === 0 || val === "0") return false;
                   return null;
                };

                if (updates.name) safeUpdate('name', String(updates.name).slice(0, 100));
                if (updates.idioma) safeUpdate('idioma', String(updates.idioma).slice(0, 20));
                if (updates.pais) safeUpdate('pais', String(updates.pais).slice(0, 30));
                
                // Proteção de Etapa: Transição Linear (1 por 1)
                if (updates.etapa) {
                   const stages = ['interesse_inicial', 'descoberta', 'negociacao', 'fechamento', 'finalizado'];
                   const currentIdx = stages.indexOf(contactMemory.etapa || 'interesse_inicial');
                   const newIdx = stages.indexOf(updates.etapa);
                   
                   if (newIdx === currentIdx + 1 || newIdx === currentIdx) {
                      safeUpdate('etapa', updates.etapa);
                   } else if (newIdx > currentIdx + 1) {
                      console.warn(`🛡️ Hardening: Bloqueado SALTO de etapa de ${contactMemory.etapa} para ${updates.etapa}`);
                   } else if (newIdx < currentIdx) {
                      safeUpdate('etapa', updates.etapa);
                   }
                }

                if (updates.produto) safeUpdate('produto_interesse', String(updates.produto));
                if (updates.tamanho) safeUpdate('tamanho', String(updates.tamanho).toUpperCase());
                if (updates.quantidade) safeUpdate('quantidade', toNum(updates.quantidade));
                if (updates.frete) safeUpdate('frete', toNum(updates.frete));
                if (updates.total) safeUpdate('total', toNum(updates.total));
                if (updates.objecoes) safeUpdate('objecoes', String(updates.objecoes));
                if (updates.resumo) safeUpdate('resumo', String(updates.resumo));
                
                if (updates.catalogo_enviado !== undefined) safeUpdate('catalogo_enviado', toBool(updates.catalogo_enviado));
                if (updates.formulario_enviado !== undefined) safeUpdate('formulario_enviado', toBool(updates.formulario_enviado));
                if (updates.formulario_preenchido !== undefined) safeUpdate('formulario_preenchido', toBool(updates.formulario_preenchido));
                
                if (Object.keys(dbUpdates).length > 1) { // Só faz update se houver algo além do last_interaction
                   await supabase.from('ai_contact_memory').update(dbUpdates).eq('phone', remoteJid);
                }
                if (DEBUG_AI) {
                   console.log("✅ Memória do contato atualizada.");
                   console.log(`📦 Payload de Memória Atualizado: ${JSON.stringify(updates)}`);
                }
              } catch (e) {
                console.error("❌ Erro ao processar <update_memory>:", e.message);
              }
              // Remove a tag da resposta que vai para o WhatsApp
              aiResult = aiResult.replace(/<update_memory>[\s\S]*?<\/update_memory>/g, "").trim();
            }
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
