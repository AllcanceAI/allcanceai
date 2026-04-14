import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

const apiId = parseInt(import.meta.env.VITE_TELEGRAM_API_ID);
const apiHash = import.meta.env.VITE_TELEGRAM_API_HASH;

// Instância singleton do cliente para evitar múltiplas conexões
let client = null;

export const getTelegramClient = (sessionString = "") => {
  if (client) return client;
  
  if (!apiId || !apiHash || isNaN(apiId)) {
    console.error("Telegram API credentials missing in .env");
    return null;
  }

  const session = new StringSession(sessionString);
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  return client;
};

export const startQRLogin = async (onQRGenerated, onLoginSuccess) => {
  const telegramClient = getTelegramClient();
  if (!telegramClient) return;

  try {
    await telegramClient.connect();
    
    // Inicia o processo de QR Code com o callback correto
    const res = await telegramClient.signInUserWithQrCode(
      { apiId, apiHash },
      {
        onError: (err) => {
          console.error("QR Login Error:", err);
          return true; // Continua tentando
        },
        qrCode: async (qr) => {
           // Conversão manual para base64url para garantir compatibilidade com todos os browsers
           const base64 = qr.token.toString('base64');
           const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
           const qrLink = `tg://login?token=${base64url}`;
           onQRGenerated(qrLink);
        },
      }
    );

    // Se o código acima finalizar sem erro, o login foi um sucesso
    if (res) {
      const sessionString = telegramClient.session.save();
      onLoginSuccess(sessionString, res);
    }
  } catch (err) {
    console.error("Failed to start Telegram QR Login:", err);
  }
};
