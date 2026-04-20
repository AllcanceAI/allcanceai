import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// FUNÇÕES AUXILIARES (definidas antes de qualquer uso)
// ============================================================

/** Protege contra sobrescrita com dados vazios */
function safeUpdate(target: Record<string, any>, field: string, value: any) {
  if (value === null || value === undefined) return;
  if (value === '' && field !== 'objecoes') return;
  if (Array.isArray(value) && value.length === 0) return;
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) return;
  target[field] = value;
}

/** Converte para número limpo, retorna null se inválido */
function toNum(val: any): string | null {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : String(n);
}

/** Converte para booleano, retorna null se ambíguo */
function toBool(val: any): boolean | null {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === 1 || val === "1") return true;
  if (val === 'false' || val === 0 || val === "0") return false;
  return null;
}

/** Trunca texto de forma inteligente, sem cortar links ou frases */
function truncateSmart(text: string, limit: number = 1000): string {
  if (text.length <= limit) return text;
  const sub = text.slice(0, limit);
  const lastNewline = sub.lastIndexOf('\n');
  const lastPeriod = sub.lastIndexOf('.');
  let cutIdx = (lastNewline > limit * 0.7) ? lastNewline : lastPeriod;
  if (cutIdx <= 0) cutIdx = limit;
  const remaining = text.slice(cutIdx);
  if (remaining.startsWith("http") || remaining.startsWith("www")) {
    const firstSpace = remaining.indexOf(" ");
    if (firstSpace !== -1) cutIdx += firstSpace;
  }
  return text.slice(0, cutIdx).trim();
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()
    const event = payload.event
    const instanceName = payload.instance || payload.instanceName || "desconhecida"

    // --- Variáveis de ambiente ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const groqKey = Deno.env.get('GROQ_API_KEY')
    const evoUrl = Deno.env.get('EVOLUTION_URL')
    const evoKey = Deno.env.get('EVOLUTION_GLOBAL_KEY')
    const fullEvoUrl = evoUrl?.includes('http') ? evoUrl : `http://2.24.203.75:8080`

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Salva log bruto do webhook
    await supabase.from('evolution_webhook_logs').insert({ event_type: event, payload })

    // ============================================================
    // 2. PROCESSA MENSAGENS
    // ============================================================
    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {

      // --- Extrai mensagem (compatível com Evolution v1 e v2) ---
      let msg = null
      if (payload.data?.messages?.[0]) msg = payload.data.messages[0]
      else if (payload.data?.key) msg = payload.data
      else if (Array.isArray(payload.data)) msg = payload.data[0]

      if (!msg || msg.key?.remoteJid === 'status@broadcast') {
        return new Response("OK", { status: 200 })
      }

      // --- Deduplicação por message_id ---
      const messageId = msg.key?.id
      if (messageId) {
        try {
          const { data: existing } = await supabase
            .from('wa_messages')
            .select('id')
            .eq('message_id', messageId)
            .maybeSingle()
          if (existing) {
            return new Response("OK", { status: 200 })
          }
        } catch (_) { /* tabela pode estar em transição */ }
      }

      // --- Identifica remetente ---
      const pushName = msg.pushName || "Contato"
      let remoteJid = msg.key?.remoteJid
      const isFromMe = msg.key?.fromMe || false

      // Sincronia do celular (@lid) → converte para JID real
      if (isFromMe && remoteJid?.includes('@lid')) {
        const innerMsg = msg.message?.deviceSentMessage?.message
        if (innerMsg?.key?.remoteJid) remoteJid = innerMsg.key.remoteJid
      }
      if (remoteJid?.includes('@lid')) {
        remoteJid = remoteJid.replace('@lid', '@s.whatsapp.net')
      }

      // --- Extrai conteúdo da mensagem ---
      const realMsg = msg.message?.deviceSentMessage?.message
                   || msg.message?.documentWithCaptionMessage?.message
                   || msg.message
      const textContent = realMsg?.conversation
          || realMsg?.extendedTextMessage?.text
          || realMsg?.imageMessage?.caption
          || realMsg?.videoMessage?.caption
          || realMsg?.documentMessage?.caption
          || ""

      let finalContent = textContent

      // ============================================================
      // 3. TRANSCRIÇÃO DE ÁUDIO (Groq Whisper)
      // ============================================================
      const hasAudio = !!(realMsg?.audioMessage)
      if (!isFromMe && !finalContent.trim() && hasAudio && groqKey) {
        try {
          const b64res = await fetch(`${fullEvoUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evoKey!, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
          })

          if (b64res.ok) {
            const contentType = b64res.headers.get("content-type")
            if (contentType?.includes("application/json")) {
              const b64data = await b64res.json()
              if (b64data?.base64) {
                const rawB64 = b64data.base64.replace(/^data:audio\/\w+;base64,/, '')
                const byteCharacters = atob(rawB64)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const audioBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/ogg' })

                const formData = new FormData()
                formData.append('file', audioBlob, 'audio.ogg')
                formData.append('model', 'whisper-large-v3')
                formData.append('language', 'pt')

                const txRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${groqKey}` },
                  body: formData
                })

                if (txRes.ok) {
                  const txData = await txRes.json()
                  if (txData.text) {
                    finalContent = `[MENSAGEM DE ÁUDIO TRANSCRITA]: "${txData.text}"`
                  }
                }
              }
            }
          }
        } catch (audioErr) {
          console.error("❌ Erro na transcrição de áudio:", audioErr.message)
        }
      }

      // ============================================================
      // 4. SALVA MENSAGEM NO BANCO (Realtime para o SaaS)
      // ============================================================
      try {
        await supabase.from('wa_messages').insert({
          instance_name: instanceName,
          remote_jid: remoteJid,
          message_id: messageId,
          push_name: pushName,
          is_from_me: isFromMe,
          content: finalContent,
          message_type: "text"
        })
      } catch (dbErr) {
        console.error("❌ Erro ao salvar wa_messages:", dbErr.message)
      }

      // ============================================================
      // 5. DISPARO DA IA (só para mensagens recebidas com conteúdo)
      // ============================================================
      if (!isFromMe && finalContent.trim()) {

        // --- Verifica se a IA está ativa ---
        const { data: trainingData } = await supabase
          .from('ai_training')
          .select('system_prompt, is_active')
          .eq('channel', 'whatsapp')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (trainingData?.is_active === false) {
          return new Response("OK", { status: 200 })
        }

        // --- Verifica se o chat está desativado ---
        try {
          const { data: isDisabled } = await supabase
            .from('ai_disabled_chats')
            .select('id')
            .eq('chat_id', remoteJid)
            .eq('channel', 'whatsapp')
            .maybeSingle()
          if (isDisabled) {
            return new Response("OK", { status: 200 })
          }
        } catch (_) { /* tabela pode não existir */ }

        // ============================================================
        // 5a. CARREGA MEMÓRIA DO CONTATO
        // ============================================================
        let contactMemory: any = {}
        try {
          const { data: memory } = await supabase
            .from('ai_contact_memory')
            .select('*')
            .eq('phone', remoteJid)
            .maybeSingle()

          if (memory) {
            contactMemory = memory
          } else {
            await supabase.from('ai_contact_memory').insert({ phone: remoteJid, name: pushName })
          }
        } catch (e) {
          console.warn("⚠️ ai_contact_memory inacessível:", e.message)
        }

        // ============================================================
        // 5b. MONTA PROMPT EM 3 CAMADAS
        // ============================================================
        const systemPrompt = `
<PRIORIDADES_DE_EXECUCAO>
1. NUNCA inventar informações não contidas no treinamento.
2. Seguir rigorosamente os dados reais da loja.
3. Manter o fluxo comercial em todas as interações.
4. Responder de forma natural, curta e humana.
</PRIORIDADES_DE_EXECUCAO>

<REGRAS_DE_QUALIDADE>
- Máximo de 2 blocos curtos por resposta.
- Apenas 1 pergunta por vez.
- PRIORIDADE DE CONTEXTO: O Histórico de Mensagens é a fonte de verdade. Se o dado já foi dito no papo, NÃO pergunte de novo. Apenas processe e atualize a memória.
- Se o cliente mudar de ideia, priorize a MENSAGEM dele e atualize a memória.
- Se o histórico já tem mensagens, NUNCA use saudações iniciais ("Olá", "Tudo bem"). Vá direto ao ponto.
- Se a etapa é fechamento, não volte para descobertas. Responda dúvidas técnicas sem perder o foco.
- Se catálogo ou formulário já foi enviado, não envie novamente a menos que o cliente peça ("manda de novo").
</REGRAS_DE_QUALIDADE>

<SYSTEM_FIXO>
${trainingData?.system_prompt || "Você é o atendente da Fabricante Primme..."}
</SYSTEM_FIXO>

<CONTEXTO_DO_CONTATO>
- Nome: ${contactMemory.name || 'Não identificado'}
- Etapa: ${contactMemory.etapa || 'interesse_inicial'}
- Produto: ${contactMemory.produto_interesse || 'Indefinido'}
- Tamanho: ${contactMemory.tamanho || 'Não informado'}
- Quantidade: ${contactMemory.quantidade || 'Não definida'} | Total: ${contactMemory.total || '0'}
- Frete: ${contactMemory.frete || 'Não calculado'}
- Objeções: ${contactMemory.objecoes || 'Nenhuma'}
- Catálogo: ${contactMemory.catalogo_enviado ? 'Enviado' : 'Não enviado'} | Formulário: ${contactMemory.formulario_enviado ? 'Enviado' : 'Não enviado'}
- Resumo: ${contactMemory.resumo || 'Nova conversa.'}
</CONTEXTO_DO_CONTATO>

REGRA DE ATUALIZAÇÃO (OBRIGATÓRIO):
Ao final de cada resposta, inclua a tag <update_memory> com JSON dos campos que mudaram.
Se nenhum campo mudou, inclua ao menos o resumo atualizado.
- Só atualize campos com dados concretos do cliente.
- Se ambíguo, omita o campo.
Campos: {name, idioma, pais, etapa, produto, tamanho, quantidade, frete, total, objecoes, resumo, catalogo_enviado, formulario_enviado, formulario_preenchido}
`.trim()

        // ============================================================
        // 5c. BUSCA HISTÓRICO DE MENSAGENS
        // ============================================================
        const { data: historyData } = await supabase
          .from('wa_messages')
          .select('content, is_from_me, created_at')
          .eq('remote_jid', remoteJid)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(40)

        const rawHistory = (historyData || []).reverse()

        // Formata mensagens com alternância de roles (exigência da Claude)
        const messages: { role: "user" | "assistant", content: string }[] = []

        for (const h of rawHistory) {
          if (!h.content || !h.content.trim()) continue
          const role: "user" | "assistant" = h.is_from_me ? "assistant" : "user"
          if (messages.length > 0 && messages[messages.length - 1].role === role) {
            messages[messages.length - 1].content += "\n" + h.content
          } else {
            messages.push({ role, content: h.content })
          }
        }

        // Garante que o primeiro é "user" (exigência da Claude)
        while (messages.length > 0 && messages[0].role === "assistant") {
          messages.shift()
        }

        // Garante que o último é "user" (exigência da Claude)
        if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
          messages.push({ role: "user", content: finalContent })
        }

        if (messages.length === 0) {
          return new Response("OK", { status: 200 })
        }

        // ============================================================
        // 5d. CHAMA A IA (Claude → Groq fallback)
        // ============================================================
        let aiResult = ""

        // --- Tentativa 1: Claude Sonnet 4.5 ---
        if (anthropicKey) {
          try {
            const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01"
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-5",
                system: systemPrompt,
                messages,
                max_tokens: 1024,
                temperature: 0.3
              })
            })

            if (claudeRes.ok) {
              const cData = await claudeRes.json()
              aiResult = cData.content?.[0]?.text || ""
            } else {
              const errBody = await claudeRes.text()
              console.error(`❌ Claude API (${claudeRes.status}):`, errBody)
            }
          } catch (e) {
            console.error("❌ Erro de rede Claude:", e.message)
          }
        }

        // --- Tentativa 2: Groq Llama (fallback) ---
        if (!aiResult && groqKey) {
          try {
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: systemPrompt }, ...messages],
                max_tokens: 1024,
                temperature: 0.3
              })
            })

            if (groqRes.ok) {
              const gData = await groqRes.json()
              aiResult = gData.choices?.[0]?.message?.content || ""
            } else {
              const errBody = await groqRes.text()
              console.error(`❌ Groq API (${groqRes.status}):`, errBody)
            }
          } catch (e) {
            console.error("❌ Erro de rede Groq:", e.message)
          }
        }

        // ============================================================
        // 5e. PROCESSA RESPOSTA DA IA
        // ============================================================
        if (aiResult) {

          // --- Extrai e processa <update_memory> ---
          try {
            const allMatches = [...aiResult.matchAll(/<update_memory>([\s\S]*?)<\/update_memory>/g)]
            if (allMatches.length > 0) {
              const lastMatch = allMatches[allMatches.length - 1]
              const updates = JSON.parse(lastMatch[1].trim())

              const dbUpdates: any = { last_interaction_at: new Date().toISOString() }

              if (updates.name) safeUpdate(dbUpdates, 'name', String(updates.name).slice(0, 100))
              if (updates.idioma) safeUpdate(dbUpdates, 'idioma', String(updates.idioma).slice(0, 20))
              if (updates.pais) safeUpdate(dbUpdates, 'pais', String(updates.pais).slice(0, 30))

              // Proteção de etapa: transição linear
              if (updates.etapa) {
                const stages = ['interesse_inicial', 'descoberta', 'negociacao', 'fechamento', 'finalizado']
                const currentIdx = stages.indexOf(contactMemory.etapa || 'interesse_inicial')
                const newIdx = stages.indexOf(updates.etapa)
                if (newIdx >= 0 && (newIdx === currentIdx || newIdx === currentIdx + 1 || newIdx < currentIdx)) {
                  safeUpdate(dbUpdates, 'etapa', updates.etapa)
                }
              }

              if (updates.produto) safeUpdate(dbUpdates, 'produto_interesse', String(updates.produto))
              if (updates.tamanho) safeUpdate(dbUpdates, 'tamanho', String(updates.tamanho).toUpperCase())
              if (updates.quantidade) safeUpdate(dbUpdates, 'quantidade', toNum(updates.quantidade))
              if (updates.frete) safeUpdate(dbUpdates, 'frete', toNum(updates.frete))
              if (updates.total) safeUpdate(dbUpdates, 'total', toNum(updates.total))
              if (updates.objecoes) safeUpdate(dbUpdates, 'objecoes', String(updates.objecoes))
              if (updates.resumo) safeUpdate(dbUpdates, 'resumo', String(updates.resumo))

              if (updates.catalogo_enviado !== undefined) safeUpdate(dbUpdates, 'catalogo_enviado', toBool(updates.catalogo_enviado))
              if (updates.formulario_enviado !== undefined) safeUpdate(dbUpdates, 'formulario_enviado', toBool(updates.formulario_enviado))
              if (updates.formulario_preenchido !== undefined) safeUpdate(dbUpdates, 'formulario_preenchido', toBool(updates.formulario_preenchido))

              if (Object.keys(dbUpdates).length > 1) {
                await supabase.from('ai_contact_memory').update(dbUpdates).eq('phone', remoteJid)
              }
            }
          } catch (memErr) {
            console.error("❌ Erro ao processar memória:", memErr.message)
          }

          // --- Remove tags técnicas da resposta ---
          aiResult = aiResult.replace(/<update_memory>[\s\S]*?<\/update_memory>/g, "").trim()

          // --- Trunca se necessário ---
          if (aiResult.length > 1200) {
            aiResult = truncateSmart(aiResult, 1000)
          }

          // --- Fallback se resposta ficou vazia após limpeza ---
          if (!aiResult) {
            aiResult = "Entendido! Como posso te ajudar?"
          }

          // ============================================================
          // 5f. ENVIA RESPOSTA VIA EVOLUTION API
          // ============================================================
          const chunks = aiResult.split('\n\n').filter((c: string) => c.trim().length > 0)
          
          // Evolution API pode exigir número puro ou JID — tentamos com o JID primeiro
          const sendNumber = remoteJid

          for (const chunk of chunks) {
            try {
              // Tenta enviar com o formato JID
              let sendRes = await fetch(`${fullEvoUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'apikey': evoKey!, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: sendNumber, text: chunk.trim() })
              })

              // Se 400, tenta com número puro (sem @s.whatsapp.net)
              if (sendRes.status === 400 && sendNumber.includes('@')) {
                const cleanNumber = sendNumber.replace(/@.*$/, '')
                console.log(`🔄 Retry com número puro: ${cleanNumber}`)
                sendRes = await fetch(`${fullEvoUrl}/message/sendText/${instanceName}`, {
                  method: 'POST',
                  headers: { 'apikey': evoKey!, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ number: cleanNumber, text: chunk.trim() })
                })
              }

              if (sendRes.ok) {
                let sendData: any = {}
                try { sendData = await sendRes.json() } catch (_) {}

                await supabase.from('wa_messages').insert({
                  instance_name: instanceName,
                  remote_jid: remoteJid,
                  message_id: sendData.key?.id || `ai-${Date.now()}`,
                  push_name: "Assistente IA",
                  is_from_me: true,
                  content: chunk.trim(),
                  message_type: "text"
                })
              } else {
                const errTxt = await sendRes.text()
                console.error(`❌ Evolution (${sendRes.status}):`, errTxt)
                // Salva no banco mesmo se Evolution falhar (para o SaaS ver)
                await supabase.from('wa_messages').insert({
                  instance_name: instanceName,
                  remote_jid: remoteJid,
                  message_id: `ai-fail-${Date.now()}`,
                  push_name: "Assistente IA",
                  is_from_me: true,
                  content: chunk.trim(),
                  message_type: "text"
                })
              }
            } catch (sendErr) {
              console.error("❌ Erro ao enviar via Evolution:", sendErr.message)
            }

            // Pausa entre bolhas para parecer natural
            if (chunks.length > 1) await new Promise(r => setTimeout(r, 2000))
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("🚨 Erro fatal:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
