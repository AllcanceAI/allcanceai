/**
 * aiService.js
 * Centraliza as chamadas ao Groq para o piloto automático do Telegram.
 */

import { supabase } from '../supabaseClient';

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const MODEL = "claude-3-5-sonnet-20241022"; // Modelo topo de linha oficial

/**
 * Gera uma resposta para uma mensagem recebida usando Claude (Anthropic).
 * @param {string} prompt - Mensagem do usuário.
 * @param {Array} history - Breve histórico da conversa para contexto.
 * @param {string} userId - ID do dono da conta.
 * @param {string} channel - Canal (whatsapp | telegram).
 */
export const generateAiResponse = async (prompt, history = [], userId = null, channel = 'whatsapp') => {
  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY não configurada no .env");
    return null;
  }

  let systemPrompt = "Você é um assistente de atendimento inteligente e cordial. Responda de forma natural, curta e eficiente em português do Brasil.";

  if (userId) {
    try {
      const { data } = await supabase
        .from('ai_training')
        .select('system_prompt')
        .eq('user_id', userId)
        .eq('channel', channel)
        .single();
      
      if (data && data.system_prompt) {
        systemPrompt = data.system_prompt;
      }
    } catch (e) {
      console.warn("Falha ao buscar system prompt personalizado, usando fallback.");
    }
  }

  try {
    console.log("🚀 [Claude Request] Enviando para Anthropic...", { 
      system: systemPrompt?.slice(0, 50) + "...", 
      model: MODEL,
      historyLength: history.length 
    });

    // --- CONSTRUÇÃO DE MENSAGENS (STRICT ALTERNATING ROLES) ---
    // Anthropic exige que as mensagens alternem estritamente entre 'user' e 'assistant'.
    
    let filteredHistory = [...history];
    
    // Removemos a última mensagem do histórico se ela for idêntica ao prompt atual (evita duplicidade do tempo real)
    if (filteredHistory.length > 0) {
      const lastMsg = filteredHistory[filteredHistory.length - 1];
      if (lastMsg.message === prompt && !lastMsg.out) {
        filteredHistory.pop();
      }
    }

    const messages = [];
    filteredHistory.slice(-10).forEach(m => {
      const role = m.out ? "assistant" : "user";
      // Só adiciona se o role for diferente do último adicionado ou se for a primeira mensagem
      if (messages.length === 0 || messages[messages.length - 1].role !== role) {
        messages.push({ role, content: m.message });
      } else {
        // Se for o mesmo role (ex: duas msgs seguidas do user), concatena o texto
        messages[messages.length - 1].content += "\n" + m.message;
      }
    });

    // Adiciona a mensagem atual (prompt)
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      messages.push({ role: "user", content: prompt });
    } else {
      messages[messages.length - 1].content += "\n" + prompt;
    }

    // Anthropic exige que a primeira mensagem seja 'user'
    if (messages.length > 0 && messages[0].role !== "user") {
      messages.shift();
    }

    console.log("🚀 [Claude Request] Enviando messages:", messages);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: MODEL,
        system: systemPrompt,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await response.json();
    console.log("📥 [Claude Response] Bruto:", data);

    if (data.error) {
       console.error("❌ [Claude API Error]:", data.error);
       // SE FALHAR CLAUDE (Ex: Sem crédito), tenta o FALLBACK no GROQ
       return await fallbackToGroq(prompt, messages, systemPrompt);
    }
    
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error("🚨 Erro Crítico Claude, tentando Fallback Groq...", error);
    return await fallbackToGroq(prompt, history, systemPrompt);
  }
};

/**
 * Fallback para o Groq caso a Anthropic falhe (Contingência)
 */
async function fallbackToGroq(prompt, history, systemPrompt) {
  const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;
  if (!GROQ_KEY) return null;

  console.log("🔄 [Fallback] Acionando Groq para não deixar usuário no vácuo...");
  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          // Formata histórico para o padrão OpenAI usado no Groq
          ...history.slice(-10).map(m => ({ 
             role: m.role || (m.out ? "assistant" : "user"), 
             content: m.content || m.message 
          })),
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });
    const groqData = await groqResponse.json();
    console.log("📥 [Groq Fallback] Sucesso:", groqData.choices?.[0]?.message?.content?.slice(0, 30));
    return groqData.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("❌ [Fallback] Groq também falhou:", err);
    return null;
  }
}

