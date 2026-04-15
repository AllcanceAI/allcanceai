/**
 * whatsappService.js
 * Interface de integração com a Evolution API.
 * Preparada para replicar a estrutura do Telegram CRM.
 */

const BASE_URL = import.meta.env.VITE_EVOLUTION_URL;
const GLOBAL_KEY = import.meta.env.VITE_EVOLUTION_GLOBAL_KEY;

// Headers padrão para a Evolution API
const getHeaders = (instanceKey) => ({
  'Content-Type': 'application/json',
  'apikey': instanceKey || GLOBAL_KEY
});

/**
 * Lista todas as instâncias da Evolution API
 */
export const fetchWaInstances = async () => {
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
 * Cria uma nova instância na Evolution API para o usuário
 */
export const createWaInstance = async (instanceName) => {
  try {
    const response = await fetch(`${BASE_URL}/instance/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        instanceName,
        qrcode: true
      })
    });
    return await response.json();
  } catch (error) {
    console.error("Erro ao criar instância:", error);
    return null;
  }
};

/**
 * Busca o QR Code de uma instância específica
 */
export const getWaQrCode = async (instanceName) => {
  try {
    const response = await fetch(`${BASE_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await response.json();
    // A Evolution retorna o base64 ou o link do QR
    return data.base64 || data.code; 
  } catch (error) {
    console.error("Erro ao buscar QR Code:", error);
    return null;
  }
};

/**
 * Busca as conversas (Chats) da instância
 */
export const getWaDialogs = async (instanceName) => {
  try {
    const response = await fetch(`${BASE_URL}/chat/findChats/${instanceName}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await response.json();
    // Mapeia o formato da Evolution para o formato do nosso CRM
    return (data || []).map(chat => ({
      id: chat.id,
      name: chat.name || chat.id.split('@')[0],
      unreadCount: chat.unreadCount || 0,
      message: {
        message: chat.lastMessage?.message?.conversation || "Mídia/Outro",
        date: chat.lastMessage?.messageTimestamp
      }
    }));
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
