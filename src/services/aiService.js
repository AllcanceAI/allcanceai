/**
 * aiService.js
 * Centraliza as chamadas ao Groq para o piloto automático do Telegram.
 */

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const MODEL = "llama-3.3-70b-versatile"; // Modelo premium e balanceado

/**
 * Gera uma resposta para uma mensagem recebida.
 * @param {string} prompt - Mensagem do usuário.
 * @param {Array} history - Breve histórico da conversa para contexto.
 */
export const generateAiResponse = async (prompt, history = []) => {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY não configurada no .env");
    return null;
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
            content: "Você é um assistente de atendimento inteligente e cordial no Telegram. Responda de forma natural, curta e eficiente em português do Brasil. Não use emojis em excesso." 
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
