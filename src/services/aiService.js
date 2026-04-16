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
        messages: [
          ...history.slice(-5).map(m => ({ 
            role: m.out ? "assistant" : "user", 
            content: m.message 
          })),
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await response.json();
    console.log("📥 [Claude Response] Bruto:", data);

    if (data.error) {
       console.error("❌ [Claude API Error]:", data.error);
       return null;
    }
    
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error("Erro na geração de resposta AI:", error);
    return null;
  }
};
