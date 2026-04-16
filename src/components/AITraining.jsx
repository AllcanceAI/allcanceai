import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export const AITraining = ({ userId }) => {
  const [channel, setChannel] = useState('whatsapp');
  const [currentPrompt, setCurrentPrompt] = useState('Você é um assistente atencioso e prestativo.');
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
      setChatHistory([]); // reset chat history on channel change
    };
    fetchPrompt();
  }, [userId, channel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = async () => {
    if (!instruction.trim() || !userId) return;

    const userText = instruction;
    setInstruction('');
    setChatHistory(prev => [...prev, { role: 'user', content: userText }]);
    setIsLoading(true);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: import.meta.env.VITE_GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [
            { 
              role: "system", 
              content: `Você é um assistente especializado em escrever system prompts para IAs de atendimento. 
Quando o usuário enviar uma instrução, atualize o system prompt atual incorporando a mudança solicitada. 
Retorne APENAS um JSON estrito no formato (responda em português):
{
  "system_prompt": "<system prompt completo atualizado>",
  "message": "<mensagem amigável confirmando a atualização, podendo incluir dicas ou perguntas>"
}`
            },
            { 
              role: "user", 
              content: `System prompt atual:
${currentPrompt}

Instrução do usuário:
${userText}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.5,
          max_tokens: 1500
        })
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (content) {
        let jsonResponse;
        try {
          jsonResponse = JSON.parse(content);
        } catch (e) {
          throw new Error("Groq não retornou JSON válido.");
        }

        const newPrompt = jsonResponse.system_prompt;
        const aiMessage = jsonResponse.message;

        // Upsert Database
        const { error: dbError } = await supabase.from('ai_training').upsert(
          { user_id: userId, channel, system_prompt: newPrompt },
          { onConflict: 'user_id, channel' }
        );

        if (!dbError) {
          setCurrentPrompt(newPrompt);
        } else {
          console.error("Erro ao salvar no Supabase:", dbError);
        }

        setChatHistory(prev => [...prev, { role: 'assistant', content: aiMessage }]);
      }
    } catch (error) {
      console.error("Erro ao treinar IA:", error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Ocorreu um erro ao processar seu treinamento. Verifique as chaves de API e tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tab-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '0 0 1rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h2>Treinamento IA</h2>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button 
            onClick={() => setChannel('whatsapp')}
            style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', border: 'none', background: channel === 'whatsapp' ? '#25D366' : '#333', color: '#fff', fontWeight: 'bold' }}
          >WhatsApp</button>
          <button 
            onClick={() => setChannel('telegram')}
            style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', border: 'none', background: channel === 'telegram' ? '#0088cc' : '#333', color: '#fff', fontWeight: 'bold' }}
          >Telegram</button>
        </div>
      </div>

      <div style={{ margin: '1rem 0' }}>
        <div 
          onClick={() => setIsPromptVisible(!isPromptVisible)} 
          style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ fontWeight: 'bold', color: '#aaa' }}>System Prompt Atual</span>
          <span>{isPromptVisible ? '▲' : '▼'}</span>
        </div>
        {isPromptVisible && (
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', marginTop: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', color: '#ccc', whiteSpace: 'pre-wrap' }}>
            {currentPrompt}
          </div>
        )}
      </div>

      <div className="messages-list" style={{ flex: 1, overflowY: 'auto', padding: '1rem 0' }}>
        {chatHistory.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
            <p>Diga para a IA como ela deve agir, o que deve vender, quais objeções contornar e etc.</p>
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div key={i} className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
              <div className="message-content"><p>{msg.content}</p></div>
            </div>
          ))
        )}
        {isLoading && <div style={{ color: '#888', fontStyle: 'italic', padding: '10px' }}>IA processando diretrizes...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
        <div className="prompt-wrapper" style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            placeholder="Ex: A partir de agora, tente sempre oferecer o Plano X no final..." 
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', outline: 'none' }}
          />
          <button 
            onClick={handleSend} 
            disabled={isLoading || !instruction.trim()}
            style={{ padding: '0 20px', borderRadius: '12px', background: '#0088cc', color: '#fff', border: 'none', cursor: 'pointer', opacity: (isLoading || !instruction.trim()) ? 0.5 : 1 }}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
};
