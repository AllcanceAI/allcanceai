/**
 * aiService.js
 * Centraliza as chamadas ao Anthropic Claude com Fallback automático para Groq.
 */

import { supabase } from '../supabaseClient';

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
// MODELO ATUALIZADO (Versão 2026 solicitada pelo usuário)
const MODEL = "claude-3-5-sonnet-latest"; 

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

  // --- CONTROLE DE FLUXO PARA EVITAR DUPLO DISPARO ---
  let successfullyResponded = false;

  try {
    console.log("🚀 [Claude Request] Enviando para Anthropic...", { 
      system: systemPrompt?.slice(0, 50) + "...", 
      model: MODEL,
      historyLength: history.length 
    });

    // --- CONSTRUÇÃO DE MENSAGENS (STRICT ALTERNATING ROLES) ---
    let filteredHistory = [...history];
    if (filteredHistory.length > 0) {
      const lastMsg = filteredHistory[filteredHistory.length - 1];
      if (lastMsg.message === prompt && !lastMsg.out) {
        filteredHistory.pop();
      }
    }

    const messages = [];
    filteredHistory.slice(-500).forEach(m => {
      const role = m.out ? "assistant" : "user";
      if (messages.length === 0 || messages[messages.length - 1].role !== role) {
        messages.push({ role, content: m.message });
      } else {
        messages[messages.length - 1].content += "\n" + m.message;
      }
    });

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      messages.push({ role: "user", content: prompt });
    } else {
      messages[messages.length - 1].content += "\n" + prompt;
    }

    if (messages.length > 0 && messages[0].role !== "user") {
      messages.shift();
    }

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
    
    if (data.content && data.content[0]?.text) {
       console.log("📥 [Claude Response] Sucesso.");
       successfullyResponded = true;
       return data.content[0].text;
    }

    if (data.error) {
       console.error("❌ [Claude API Error]:", data.error);
       if (!successfullyResponded) {
         return await fallbackToGroq(prompt, messages, systemPrompt);
       }
    }
    
    return null;
  } catch (error) {
    console.error("🚨 Erro Crítico Claude, verificando Fallback...", error);
    if (!successfullyResponded) {
      return await fallbackToGroq(prompt, history, systemPrompt);
    }
    return null;
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
          ...history.slice(-500).map(m => ({ 
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
    return groqData.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("❌ [Fallback] Groq também falhou:", err);
    return null;
  }
}
