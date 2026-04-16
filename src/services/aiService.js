/**
 * aiService.js
 * Centraliza as chamadas ao Groq para o piloto automático do Telegram.
 */

import { supabase } from '../supabaseClient';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const MODEL = "llama-3.3-70b-versatile"; // Modelo premium e balanceado

/**
 * Gera uma resposta para uma mensagem recebida.
 * @param {string} prompt - Mensagem do usuário.
 * @param {Array} history - Breve histórico da conversa para contexto.
 * @param {string} userId - ID do dono da conta.
 * @param {string} channel - Canal (whatsapp | telegram).
 */
export const generateAiResponse = async (prompt, history = [], userId = null, channel = 'telegram') => {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY não configurada no .env");
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
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { 
            role: "system", 
            content: systemPrompt 
          },
          ...history.slice(-5).map(m => ({ 
            role: m.out ? "assistant" : "user", 
            content: m.message 
          })),
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 512
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("Erro na geração de resposta AI:", error);
    return null;
  }
};
