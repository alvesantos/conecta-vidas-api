import type { Request, Response } from "express";

export const webhookController = {
  async handle(req: Request, res: Response) {
    console.log(req.body);

    return res.status(200).json({
      received: true,
    });
  },

  async evolutionHandle(req: Request, res: Response) {
    const body = req.body;
    
    // Log the received payload for debugging
    console.log("Evolution Webhook received:", JSON.stringify(body, null, 2));

    // Respond immediately to Evolution API
    res.status(200).json({ received: true });

    try {
      if (body.event === 'messages.upsert') {
        const msgData = body.data;
        
        if (!msgData || !msgData.message) return;
        
        const remoteJid = msgData.key.remoteJid;
        const fromMe = msgData.key.fromMe;
        
        if (fromMe) return; // Ignorar mensagens enviadas por nós mesmos
        if (remoteJid.includes('@g.us')) return; // Ignorar mensagens de grupo
        
        let text = '';
        if (msgData.message.conversation) {
            text = msgData.message.conversation;
        } else if (msgData.message.extendedTextMessage?.text) {
            text = msgData.message.extendedTextMessage.text;
        }
        
        text = text.trim();
        if (!text) return;

        let replyText = "";
        if (text === "1") {
            replyText = "Um instante, um atendente vai entrar em contato com voce";
        } else if (text === "2") {
            replyText = "Por favor, cadastre-se na nossa plataforma.";
        } else {
            replyText = "Ola, somos do conectavidas. Você é cliente da nossa plataforma?\n\n1 - Sim\n2 - Não";
        }

        const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'conecta'; // Exemplo
        const apiKey = process.env.EVOLUTION_API_KEY || 'sua_api_key_aqui';

        const sendUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
        
        // Asynchronously send the reply back
        await fetch(sendUrl, {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
               'apikey': apiKey
           },
           body: JSON.stringify({
               number: remoteJid,
               text: replyText
           })
        });
      }
    } catch (err) {
      console.error("Erro ao processar webhook evolution:", err);
    }
  }
};
