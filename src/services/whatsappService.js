/**
 * whatsappService.js
 * Interface de integração com a Evolution API.
 * Preparada para replicar a estrutura do Telegram CRM.
 */

import { supabase } from '../supabaseClient';

const BASE_URL = import.meta.env.VITE_EVOLUTION_URL;
const GLOBAL_KEY = import.meta.env.VITE_EVOLUTION_GLOBAL_KEY;

console.log("🌐 [Evolution Config] URL Detectada:", BASE_URL || "NÃO CONFIGURADA NO PAINEL DA VERCEL");

// Verificação de segurança para as variáveis de ambiente
if (!BASE_URL || !GLOBAL_KEY) {
  console.warn("⚠️ [Evolution] ATENÇÃO: VITE_EVOLUTION_URL ou VITE_EVOLUTION_GLOBAL_KEY não configurados! Cadastre-os no painel da Vercel.");
}

// Headers padrão para a Evolution API
const getHeaders = (instanceKey) => {
  if (!GLOBAL_KEY) return {};
  return {
    'Content-Type': 'application/json',
    'apikey': instanceKey || GLOBAL_KEY
  };
};

/**
 * Lista todas as instâncias da Evolution API
 */
export const fetchWaInstances = async () => {
  if (!BASE_URL) return [];
  try {
    const response = await fetch(`${BASE_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: getHeaders()
    });
    return await response.json();
  } catch (error) {
    console.error("Erro ao listar instâncias:", error);
    return [];
  }
};

/**
 * Deleta uma instância existente
 */
export const deleteWaInstance = async (instanceName) => {
  if (!BASE_URL) return null;
  try {
    console.log(`🗑️ [Evolution] Deletando instância: ${instanceName}`);
    const response = await fetch(`${BASE_URL}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await response.json();
    console.log("📥 [Evolution] Resposta Delete:", data);
    return data;
  } catch (error) {
    console.error("❌ [Evolution] Erro ao deletar instância:", error);
    return null;
  }
};

/**
 * Cria uma nova instância na Evolution API para o usuário
 */
export const createWaInstance = async (instanceName) => {
  if (!BASE_URL) return null;
  
  // URL do banco de dados (Supabase Edge Function) para receber Webhooks
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/evolution-webhook` : "https://sua-url-de-webhook";

  try {
    console.log(`🚀 [Evolution] Criando instância e atrelando Webhook: ${instanceName}`);
    
    const bodyConfig = {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      webhook_wa_business: false,
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "SEND_MESSAGE",
          "CONNECTION_UPDATE"
        ]
      }
    };

    const response = await fetch(`${BASE_URL}/instance/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(bodyConfig)
    });
    const data = await response.json();
    console.log("📥 [Evolution] Resposta Create:", data);
    return data;
  } catch (error) {
    console.error("❌ [Evolution] Erro ao criar instância:", error);
    return null;
  }
};

/**
 * Busca o QR Code de uma instância específica
 */
export const getWaQrCode = async (instanceName) => {
  if (!BASE_URL) return null;
  try {
    console.log(`🔍 [Evolution] Buscando QR para: ${instanceName}`);
    const response = await fetch(`${BASE_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await response.json();
    console.log("📥 [Evolution] Resposta Connect (QR):", data);

    // Tenta extrair o base64 de múltiplos lugares possíveis na resposta da API
    const qrSource = data.qrcode || data;
    return qrSource.base64 || qrSource.code || null;
  } catch (error) {
    console.error("❌ [Evolution] Erro ao buscar QR Code:", error);
    return null;
  }
};

/**
 * Busca as conversas (Chats) da instância
 */
export const getWaDialogs = async (instanceName) => {
  try {
    const response = await fetch(`${BASE_URL}/chat/findChats/${instanceName}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({})
    });
    const data = await response.json();
    
    // Tratamento para lista encapsulada { records: [] } ou { chats: [] } se existir
    const chatList = Array.isArray(data) ? data : (data.records || data.chats || []);

    // Filtra exclusivamente contatos com números de telefone reais (removendo @g.us, @lid, transmissões, etc)
    const realChats = chatList.filter(chat => {
      const jid = chat.remoteJid || chat.id || "";
      return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us');
    });

    // Mapeia o formato da Evolution para o formato do nosso CRM
    return realChats.map(chat => {
      // Evolvtion API v2 usa remoteJid no lugar de id
      const chatId = chat.remoteJid || chat.id || "";
      const chatName = chat.pushName || chat.name || (chatId ? chatId.split('@')[0] : "Desconhecido");

      return {
        id: chatId,
        name: chatName,
        unreadCount: chat.unreadCount || 0,
        message: {
          message: chat.lastMessage?.message?.conversation || "Mídia/Localização",
          date: chat.lastMessage?.messageTimestamp || Date.now()
        }
      };
    });
  } catch (error) {
    console.error("Erro ao buscar chats:", error);
    return [];
  }
};

/**
 * Envia uma mensagem de texto (Evolution API - Versão Simplificada)
 */
export const sendText = async (instanceName, remoteJid, text) => {
  try {
    // 1. Limpeza do Número (Exige 5511999999999)
    const cleanNumber = remoteJid.split('@')[0].replace(/\D/g, '');
    
    // 2. URL e Payload Exatos solicitados
    const url = `${BASE_URL}/message/sendText/${instanceName}`;
    const payload = {
      number: cleanNumber,
      text: text
    };

    console.log("📤 [Evolution Debug] URL Final:", url);
    console.log("📤 [Evolution Debug] Body Completo:", JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
       const errorData = await response.json().catch(() => ({}));
       console.error("❌ [Evolution API Error] 400:", errorData);
       return false;
    }

    return true;
  } catch (error) {
    console.error("❌ [Evolution Network Error] Falha:", error);
    return false;
  }
};

/**
 * Busca histórico de mensagens de um chat
 */
export const getWaMessages = async (instanceName, remoteJid) => {
  try {
    const response = await fetch(`${BASE_URL}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        where: { remoteJid },
        take: 350
      })
    });
    const data = await response.json();
    
    // Suporte robusto a múltiplas versões da Evolution (extrai a array real e evita que 'msgList' seja objeto)
    let msgList = [];
    if (Array.isArray(data)) msgList = data;
    else if (data.messages && Array.isArray(data.messages.records)) msgList = data.messages.records;
    else if (data.messages && Array.isArray(data.messages)) msgList = data.messages;
    else if (data.records && Array.isArray(data.records)) msgList = data.records;
    
    // -- Buscando transcrições no Supabase para não sumirem no Refresh --
    let transcriptions = {};
    try {
      const { data: supaMsgs } = await supabase
        .from('wa_messages')
        .select('message_id, content')
        .eq('instance_name', instanceName)
        .eq('remote_jid', remoteJid)
        .like('content', '%TRANSCRITA%');
        
      if (supaMsgs) {
        supaMsgs.forEach(s => transcriptions[s.message_id] = s.content);
      }
    } catch(e) {}

    // O Backend do Evolution já filtra as conversas adequadamente na query 'where'.
    
    return msgList.map(m => {
      // Extrai a mensagem real, desempacotando caso venha de um celular sincronizado (WhatsApp Web / Outro celular)
      const realMsg = m.message?.deviceSentMessage?.message 
                   || m.message?.documentWithCaptionMessage?.message 
                   || m.message;

      // Pega o texto da mensagem com segurança (texto simples, estendido ou legenda de mídia)
      let textContent = realMsg?.conversation 
        || realMsg?.extendedTextMessage?.text 
        || realMsg?.imageMessage?.caption
        || realMsg?.videoMessage?.caption
        || realMsg?.documentMessage?.caption
        || "";
        
      if (transcriptions[m.key?.id]) {
         textContent = transcriptions[m.key?.id];
      }

      return {
        message: textContent,
        out: m.key?.fromMe,
        date: m.messageTimestamp,
        hasMedia: !!(realMsg?.audioMessage || realMsg?.imageMessage || realMsg?.videoMessage || realMsg?.documentMessage || realMsg?.stickerMessage),
        mediaType: realMsg?.audioMessage ? 'audio' : realMsg?.imageMessage ? 'image' : realMsg?.videoMessage ? 'video' : realMsg?.documentMessage ? 'document' : realMsg?.stickerMessage ? 'sticker' : null,
        rawMessage: m
      };
    }).reverse();
  } catch (error) {
    console.error("Erro ao buscar mensagens do histórico:", error);
    return [];
  }
};

/**
 * Busca e decodifica a mídia de uma mensagem convertendo para Base64 (Fotos/Áudios)
 */
export const fetchWaMediaBase64 = async (instanceName, rawMessage) => {
  if (!BASE_URL || !rawMessage) return null;
  try {
    const response = await fetch(`${BASE_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message: rawMessage })
    });
    if (!response.ok) return null;
    const data = await response.json();
    let b64 = data.base64 || null;
    
    if (b64 && !b64.startsWith('data:')) {
      const rm = rawMessage.message?.deviceSentMessage?.message || rawMessage.message?.documentWithCaptionMessage?.message || rawMessage.message;
      let prefix = 'data:application/octet-stream;base64,';
      if (rm?.audioMessage) prefix = 'data:audio/ogg;base64,';
      else if (rm?.imageMessage) prefix = 'data:image/jpeg;base64,';
      else if (rm?.videoMessage) prefix = 'data:video/mp4;base64,';
      else if (rm?.stickerMessage) prefix = 'data:image/webp;base64,';
      b64 = prefix + b64;
    }
    return b64;
  } catch (error) {
    console.error("Erro ao buscar Base64 da mídia:", error);
    return null;
  }
};

/**
 * Busca a foto de perfil do contato (Evolution v2)
 */
export const getWaProfilePic = async (instanceName, remoteJid) => {
  try {
    const response = await fetch(`${BASE_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ number: remoteJid }) // 'number' is the payload format expected
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data?.profilePictureUrl || data?.picture || null;
  } catch (error) {
    return null; // Ocultar silenciosamente, pois muitos contatos não tem foto pública
  }
};

