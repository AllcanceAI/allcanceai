# 20 Cenários de Teste de Stress - AllcanceAI

Este guia serve para validação manual do comportamento do agente após o Hardening.

| # | Cenário | Mensagem Cliente | Memória Inicial | Resposta Esperada | Memória Final | NÃO PODE ACONTECER |
|---|---|---|---|---|---|---|
| 1 | Lead Novo | "Oi, quanto custa?" | Vazia | Saudação + Pergunta interesse (Regra 1) | etapa: descoberta | Mandar preço direto |
| 2 | Pedido de Catálogo | "Manda o catálogo" | Discovery | Envia link do catálogo | catalogo_enviado: true | Mandar o formulário |
| 3 | Mínimo de Peças | "Quero 5 peças" | Discovery | Explica educadamente o mínimo de 10 | quantidade: 5 | Aceitar o pedido |
| 4 | Lead Desconfiado | "É golpe? É original?" | Negociação | Prova social + Localização Brusque | resumo: "Dúvida originalidade" | Perder a calma ou ser genérico |
| 5 | Vídeo Chamada | "Faz vídeo chamada?" | Negociação | Diz que o atendimento é via chat | resumo: "Pediu vídeo" | Dar número pessoal |
| 6 | Frete Caro | "O frete tá caro demais" | Cálculo | Trata a objeção (valor agregado) | objecoes: "frete" | Dar desconto sem autorização |
| 7 | Pedido de Desconto | "Faz um desconto aí" | Negociação | Explica que o preço é de fábrica | resumo: "Pediu desconto" | Ceder no preço fixo |
| 8 | Link Perdido | "Perdi o link do forms" | Fechamento | Reenvia o link (Exceção do Guard) | etapa: fechamento | Ignorar o pedido |
| 9 | Já Preencheu | "Já preenchi tudo" | Fechamento | Agradece e explica próximo passo | formulario_preenchido: true | Mandar o link de novo |
| 10 | Retomada | "Oi, voltamos" | Memória completa | "Oi! Vamos seguir com as [Tamanho X]?" | last_interaction: NOW | Perguntar tudo de novo |
| 11 | Ambíguo "Sim" | "Sim" (após preço) | Cálculo | Manda o formulário (Regra 4) | etapa: fechamento | Perguntar "Sim o quê?" |
| 12 | Ambíguo "Ok" | "Ok" (após catálogo) | Discovery | Pergunta qual modelo gostou | etapa: negociacao | Ficar mudo |
| 13 | Mudança de Planos | "Mudei, quero 20 agora" | Memória: 10 | Refaz cálculo para 20 | quantidade: 20 | Ficar preso nas 10 |
| 14 | Erro de Idioma | "Hola, precio" | Vazia | Responde em Espanhol | idioma: espanhol | Responder em PT |
| 15 | Double Question | "Quanto é e onde vcs ficam?" | Vazia | Responde preço + Brusque/SC | etapa: descoberta | Responder só uma |
| 16 | Spam de "Oi" | "Oi" "Olá" "Oi" | Conversa ativa | Ignora a saudação (Anti-Greeting) | sem mudança | Repetir "Oi, tudo bem?" |
| 17 | Foto do Print | [Cliente manda foto] | Fechamento | Pergunta se é o comprovante | resumo: "Mandou anexo" | Alucinar dados da imagem |
| 18 | Confirmação Mista | "Fechado, reserva as G" | Negociação | Confirma e envia formulário | tamanho: G | Voltar para o catálogo |
| 19 | Pergunta Técnica | "Qual a gramatura?" | Fechamento | Responde e volta pro formulário | resumo: "Dúvida técnica" | Abandonar o fechamento |
| 20 | Encerramento | "Obrigado, tchau" | Completa | Despedida educada | etapa: finalizado | Continuar tentando vender |
