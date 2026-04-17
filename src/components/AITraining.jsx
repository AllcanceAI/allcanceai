import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import './AITraining.css'; // Vamos criar um arquivo de estilo limpo para ele

export const AITraining = ({ userId }) => {
  const [channel, setChannel] = useState('whatsapp');
  const [currentPrompt, setCurrentPrompt] = useState('Você é um assistente atencioso e prestativo.');
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Efeito 1: Busca o System Prompt no Supabase
  useEffect(() => {
    if (!userId) return;
    const fetchPrompt = async () => {
      const { data, error } = await supabase
        .from('ai_training')
        .select('system_prompt')
        .eq('user_id', userId)
        .eq('channel', channel)
        .single();
      
      if (data && data.system_prompt) {
        setCurrentPrompt(data.system_prompt);
      } else {
        setCurrentPrompt('Você é um assistente de atendimento inteligente e cordial. Responda de forma natural, curta e eficiente em português do Brasil.');
      }
    };
    fetchPrompt();
  }, [userId, channel]);

  // Efeito 2: Carrega e Salva o Histórico de Chat do LocalStorage (Preserva na troca de abas / F5)
  useEffect(() => {
    if (!userId) return;
    const storageKey = `ai_training_chat_${userId}_${channel}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setChatHistory(JSON.parse(saved));
      } catch(e) {
        setChatHistory([]);
      }
    } else {
      setChatHistory([]);
    }
  }, [userId, channel]);

  useEffect(() => {
    if (!userId || chatHistory.length === 0) return;
    const storageKey = `ai_training_chat_${userId}_${channel}`;
    localStorage.setItem(storageKey, JSON.stringify(chatHistory));
  }, [chatHistory, userId, channel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleClearHistory = () => {
    if (window.confirm("Limpar o histórico de dicas desta tela? Isso não apaga seu prompt atual salvo no banco.")) {
      setChatHistory([]);
      const storageKey = `ai_training_chat_${userId}_${channel}`;
      localStorage.removeItem(storageKey);
    }
  };

  const handleSend = async () => {
    if (!instruction.trim() || !userId) return;

    const userText = instruction;
    setInstruction('');
    setChatHistory(prev => [...prev, { role: 'user', content: userText }]);
    setIsLoading(true);

    try {
      // Prepara o histórico da conversa (descartando mensagens vazias/erros locais)
      const historicalMessages = chatHistory
        .filter(m => m.content && !m.content.includes("🚨"))
        .map(msg => ({ role: msg.role, content: msg.content }));

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { 
              role: "system", 
              content: `IDENTIDADE: Você é o ENGENHEIRO DE PROMPTS SÊNIOR. 
MISSÃO: Você ajuda o dono da empresa a configurar o "cérebro" (System Prompt) do robô dele.

REGRAS CRÍTICAS:
1. NÃO se comporte como o robô de atendimento. Não tente vender nada para o usuário desta tela. Você é o CONSULTOR dele.
2. Analise o "Prompt Atual" abaixo e ajude o usuário a refiná-lo.
3. Se o usuário quiser mudar algo, sugira a regra em "message" e mantenha "update_prompt": false.
4. Se ele confirmar, junte a melhoria ao prompt original e envie em "system_prompt" com "update_prompt": true.

DADOS PARA EDIÇÃO:
--- PROMPT ATUAL DO ROBÔ (NÃO USE ESTES DADOS PARA FALAR, APENAS EDITE) ---
${currentPrompt}
--------------------------------------------------------------------------

SAÍDA OBRIGATÓRIA (JSON):
{ "update_prompt": boolean, "system_prompt": "string", "message": "string" }`
            },

            ...historicalMessages.slice(-4),
            { role: "user", content: userText }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 3000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Groq Error Body:", errorData);
        throw new Error(`Groq API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      
      if (content) {
        let jsonResponse;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          jsonResponse = JSON.parse(jsonMatch ? jsonMatch[0] : content);
        } catch (e) {
          console.warn("⚠️ Fallback para texto plano.");
          jsonResponse = { update_prompt: false, message: content };
        }

        const shouldUpdate = jsonResponse.update_prompt === true;
        const newPrompt = jsonResponse.system_prompt;
        const aiMessage = jsonResponse.message;

        if (shouldUpdate && newPrompt) {
          // Salva no banco de dados
          const { error: dbError } = await supabase.from('ai_training').upsert(
            { user_id: userId, channel, system_prompt: newPrompt },
            { onConflict: 'user_id, channel' }
          );

          if (!dbError) {
            setCurrentPrompt(newPrompt);
            console.log("✅ [Treinador] Prompt Atualizado com Sucesso no Supabase.");
          } else {
            console.error("Erro ao salvar no Supabase:", dbError);
          }
        }

        setChatHistory(prev => [...prev, { role: 'assistant', content: aiMessage }]);
      }
    } catch (error) {
      console.error("Erro ao treinar IA:", error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: "🚨 Ocorreu um erro ao processar sua requisição." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-training-container">
      
      {/* Header Premium com Gradiente Suave */}
      <div className="ai-training-header">
        <div className="ai-training-title-area">
           <div className="ai-training-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
           </div>
           <div>
              <h2 className="ai-training-title">Estúdio de Treinamento</h2>
              <p className="ai-training-subtitle">Molde a inteligência do seu agente em tempo real</p>
           </div>
        </div>

        <div className="ai-channel-toggle">
          <button 
            className={`channel-btn ${channel === 'whatsapp' ? 'active-wa' : ''}`}
            onClick={() => setChannel('whatsapp')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
          <button 
            className={`channel-btn ${channel === 'telegram' ? 'active-tg' : ''}`}
            onClick={() => setChannel('telegram')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            Telegram
          </button>
        </div>
      </div>

      <div className="ai-training-body">
        
        {/* Em vez de Acordion Inline, usar botão nativo simples que aciona o Modal */}
        <div className="ai-prompt-visor-wrapper" onClick={() => setIsPromptVisible(true)}>
          <div className="ai-prompt-visor-header">
            <div className="visor-header-left">
              <span className="visor-pulse"></span>
              <strong>Visualizar Diretrizes em Execução</strong>
            </div>
            <button className="expand-btn">
              Acessar
            </button>
          </div>
        </div>

        {/* Modal Sobreposto do System Prompt */}
        {isPromptVisible && (
          <div className="prompt-modal-overlay" onClick={() => setIsPromptVisible(false)}>
            <div className="prompt-modal-content" onClick={e => e.stopPropagation()}>
              <div className="prompt-modal-header">
                <h3>System Prompt Base</h3>
                <button className="prompt-modal-close" onClick={() => setIsPromptVisible(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="prompt-modal-body">
                {currentPrompt}
              </div>
            </div>
          </div>
        )}

        {/* Área de Bate-Papo do Treinador */}
        <div className="ai-trainer-chat">
          <div className="ai-trainer-messages">
            {chatHistory.length === 0 ? (
              <div className="ai-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: '1rem', color: '#0072FF' }}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <h3>Como deve ser seu atendente hoje?</h3>
                <p>Use linguagem natural. Ex: <i>"Agora seja mais amigável e ofereça descontos."</i></p>
              </div>
            ) : (
              <>
                 <div className="chat-actions-top">
                    <button className="clear-chat-btn" onClick={handleClearHistory}>
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                       Limpar Chat
                    </button>
                 </div>
                 {chatHistory.map((msg, i) => (
                    <div key={i} className={`ai-message-row ${msg.role === 'user' ? 'user-row' : 'bot-row'}`}>
                      {msg.role === 'assistant' && (
                        <div className="ai-message-avatar">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                      )}
                      <div className={`ai-bubble ${msg.role}`}>
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  ))}
              </>
            )}
            
            {isLoading && (
              <div className="ai-message-row bot-row isLoading">
                <div className="ai-message-avatar pulse-anim"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                <div className="ai-bubble bot typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-trainer-input-area">
            <div className="ai-input-glass">
              <input 
                type="text" 
                placeholder="Dê um novo comando, ajuste a forma como ela vende ou impessa que ela fale sobre X..." 
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={isLoading}
              />
              <button 
                className="ai-send-btn"
                onClick={handleSend} 
                disabled={isLoading || !instruction.trim()}
              >
                {!isLoading ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                ) : (
                  <div className="spinner-mini"></div>
                )}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};
