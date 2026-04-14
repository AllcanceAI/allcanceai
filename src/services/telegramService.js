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
    
    // Inicia o processo de QR Code
    const res = await telegramClient.signInUserWithQrCode(
      { apiId, apiHash },
      {
        onError: (err) => console.error("QR Login Error:", err),
        onQrCode: (qr) => {
           // O 'qr' retornado é o token que deve ser transformado em QR Code
           const qrLink = `tg://login?token=${qr.token.toString('base64url')}`;
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
