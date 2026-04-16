/**
 * whatsappService.js
 * Interface de integração com a Evolution API.
 * Preparada para replicar a estrutura do Telegram CRM.
 */

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

    // Mapeia o formato da Evolution para o formato do nosso CRM
    return chatList.map(chat => {
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
 * Envia uma mensagem de texto
 */
export const sendWaMessage = async (instanceName, remoteJid, text) => {
  try {
    await fetch(`${BASE_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        number: remoteJid,
        options: { delay: 1200, presence: "composing" },
        textMessage: { text }
      })
    });
    return true;
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
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
        take: 50
      })
    });
    const data = await response.json();
    return (data.messages || []).map(m => ({
      message: m.message?.conversation || "",
      out: m.key.fromMe,
      date: m.messageTimestamp
    })).reverse();
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    return [];
  }
};
