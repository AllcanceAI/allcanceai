const url = 'http://2.24.203.75:8080/chat/findChats/allcance_2c95f3bd';
const options = {
  method: 'POST',
  headers: {
    'apikey': 'badarosk1',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
};

fetch(url, options)
  .then(res => res.json())
  .then(data => {
    let chatList = Array.isArray(data) ? data : (data.records || data.chats || []);
    const realChats = chatList.filter(chat => {
      const jid = chat.remoteJid || chat.id || "";
      return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us');
    });
    console.log(JSON.stringify(realChats.slice(0, 5), null, 2));
  })
  .catch(err => console.error(err));
