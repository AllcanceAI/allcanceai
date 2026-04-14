import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

const apiId = parseInt(import.meta.env.VITE_TELEGRAM_API_ID);
const apiHash = import.meta.env.VITE_TELEGRAM_API_HASH;
const SESSION_KEY = 'allcance_telegram_session';

let client = null;

export const getSavedSession = () => localStorage.getItem(SESSION_KEY) || '';

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
  client = null;
};

export const getTelegramClient = (sessionString = '') => {
  if (client) return client;

  if (!apiId || !apiHash || isNaN(apiId)) {
    console.error('Telegram API credentials missing in .env');
    return null;
  }

  const session = new StringSession(sessionString);
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  return client;
};

export const startQRLogin = async (onQRGenerated, onLoginSuccess) => {
  const savedSession = getSavedSession();
  const telegramClient = getTelegramClient(savedSession);
  if (!telegramClient) return;

  try {
    await telegramClient.connect();

    // Se já tem sessão salva, verifica se ainda está autorizado
    if (savedSession) {
      const authorized = await telegramClient.isUserAuthorized();
      if (authorized) {
        const me = await telegramClient.getMe();
        onLoginSuccess(savedSession, me);
        return;
      }
    }

    // Inicia o processo de QR Code
    await telegramClient.signInUserWithQrCode(
      { apiId, apiHash },
      {
        onError: (err) => {
          console.error('QR Login Error:', err);
          return true; // Continua tentando
        },
        qrCode: async (qr) => {
          const base64 = qr.token.toString('base64');
          const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          const qrLink = `tg://login?token=${base64url}`;
          onQRGenerated(qrLink);
        },
      }
    );

    // Chegou aqui = login bem-sucedido (sem erro)
    const sessionString = telegramClient.session.save();
    localStorage.setItem(SESSION_KEY, sessionString);
    const me = await telegramClient.getMe();
    onLoginSuccess(sessionString, me);

  } catch (err) {
    console.error('Failed to start Telegram QR Login:', err);
  }
};

// Envia o código de verificação via Telegram (SMS ou app)
export const sendPhoneCode = async (phoneNumber) => {
  const telegramClient = getTelegramClient(getSavedSession());
  if (!telegramClient) throw new Error('Client not initialized');
  await telegramClient.connect();
  const result = await telegramClient.sendCode({ apiId, apiHash }, phoneNumber);
  return result.phoneCodeHash;
};

// Verifica o código e completa o login
export const verifyPhoneCode = async (phoneNumber, phoneCodeHash, code, onSuccess) => {
  const telegramClient = getTelegramClient();
  if (!telegramClient) throw new Error('Client not initialized');
  const user = await telegramClient.signIn(
    { apiId, apiHash },
    { phoneNumber, phoneCodeHash, phoneCode: code }
  );
  const sessionString = telegramClient.session.save();
  localStorage.setItem(SESSION_KEY, sessionString);
  onSuccess(sessionString, user);
};

// Busca lista de conversas (dialogs)
export const getDialogs = async (limit = 30) => {
  const telegramClient = getTelegramClient();
  if (!telegramClient) return [];
  const dialogs = await telegramClient.getDialogs({ limit });
  return dialogs;
};

// Busca mensagens de um chat
export const getChatMessages = async (entity, limit = 50) => {
  const telegramClient = getTelegramClient();
  if (!telegramClient) return [];
  const messages = await telegramClient.getMessages(entity, { limit });
  return messages.reverse(); // Mais antigas primeiro
};

// Envia uma mensagem
export const sendTelegramMessage = async (entity, text) => {
  const telegramClient = getTelegramClient();
  if (!telegramClient) throw new Error('Client not initialized');
  await telegramClient.sendMessage(entity, { message: text });
};
