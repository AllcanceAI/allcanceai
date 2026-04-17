
const WEBHOOK_URL = "https://lkgfsraodakpdwweldip.supabase.co/functions/v1/evolution-webhook";
const INSTANCE_NAME = "allcance_xxxxxxx"; // Substituto genérico

const payload = {
  event: 'messages.upsert',
  instance: INSTANCE_NAME,
  data: {
    messages: [
      {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'TEST_ID_123'
        },
        pushName: 'Teste System',
        message: {
          conversation: 'Oi teste, responde ae'
        }
      }
    ]
  }
};

async function testWebhook() {
  console.log(`🚀 Mandando payload simulado para o webhook: ${WEBHOOK_URL}`);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log(`HTTP Status: ${res.status}`);
    console.log(`Resposta do Servidor: ${text}`);
  } catch (error) {
    console.error('Erro ao conectar no webhook:', error);
  }
}

testWebhook();
