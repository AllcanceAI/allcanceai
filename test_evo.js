const url = 'http://2.24.203.75:8080/chat/findMessages/allcance_2c95f3bd';
const options = {
  method: 'POST',
  headers: {
    'apikey': 'badarosk1',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "where": { "remoteJid": "5515998175561@s.whatsapp.net" },
    "take": 5
  })
};

fetch(url, options)
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => console.error(err));
