/**
 * whatsappService.js
 * Interface de integração com a Evolution API.
 * Preparada para replicar a estrutura do Telegram CRM.
 */

// Mock de dados para visualização inicial (Estrutura idêntica ao Telegram)
const mockDialogs = [
  {
    id: "wa_1",
    name: "João Evolution",
    message: { message: "Olá, como funciona a API?", date: Math.floor(Date.now()/1000) },
    unreadCount: 2,
    entity: { id: "wa_1" }
  },
  {
    id: "wa_2",
    name: "Suporte Evolution",
    message: { message: "Sua instância está ativa!", date: Math.floor(Date.now()/1000) - 3600 },
    unreadCount: 0,
    entity: { id: "wa_2" }
  }
];

export const getWaDialogs = async () => {
  // Simula delay de rede
  return new Promise((res) => setTimeout(() => res(mockDialogs), 800));
};

export const getWaMessages = async (contactId) => {
  return [
    { out: false, message: "Olá, gostaria de saber mais sobre a Evolution API", date: Math.floor(Date.now()/1000) - 100 },
    { out: true, message: "Com certeza! Em que posso ajudar?", date: Math.floor(Date.now()/1000) - 50 }
  ];
};

export const sendWaMessage = async (contactId, text) => {
  console.log(`[Evolution API] Enviando para ${contactId}: ${text}`);
  return true;
};

// Placeholder para conexão Evolution
export const connectEvolution = async (apiKey, instanceName) => {
  console.log("Conectando à Evolution API...");
  return { status: "connected" };
};
