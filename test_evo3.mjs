const url = 'http://2.24.203.75:8080/chat/findMessages/allcance_2c95f3bd';
const options = {
  method: 'POST',
  headers: {
    'apikey': 'badarosk1',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "remoteJid": "5515998175561@s.whatsapp.net",
    "take": 5
  })
};

fetch(url, options)
  .then(res => res.json())
  .then(data => {
    let msgList = [];
    if (Array.isArray(data)) msgList = data;
    else if (data.messages && Array.isArray(data.messages.records)) msgList = data.messages.records;
    
    // Print showing who the messages belong to
    msgList.forEach(m => console.log(m.key.remoteJid));
  })
  .catch(err => console.error(err));
