const fetch = require('node-fetch'); // we'll rely on node fetch or native

const url = 'http://2.24.203.75:8080/chat/fetchProfilePictureUrl/allcance_2c95f3bd';
const options = {
  method: 'POST',
  headers: {
    'apikey': 'badarosk1',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "number": "5515998175561@s.whatsapp.net"
  })
};

fetch(url, options)
  .then(res => res.text())
  .then(data => {
    console.log("Teste ProfilePic:", data);
  })
  .catch(err => console.error(err));
