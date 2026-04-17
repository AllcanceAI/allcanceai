const fetch = require('node-fetch');

async function testFetch() {
  const url = "http://2.24.203.75:8080/message/sendText/allcance_2c95f3bd";
  const body = JSON.stringify({ number: "5511999999999", text: "Teste de envio API" });
  
  try {
    console.log("Enviando requisição POST para", url);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': 'badarosk1',
        'Content-Type': 'application/json'
      },
      body
    });
    console.log("Status:", res.status);
    const data = await res.json().catch(()=>({}));
    console.log("Response:", data);
  } catch (e) {
    console.log("Erro fatal:", e.message);
  }
}

testFetch();
