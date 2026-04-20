-- Criação da tabela para guardar as mensagens do WhatsApp (Backups de Conversas e Memória da IA)
CREATE TABLE IF NOT EXISTS public.wa_messages (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    instance_name TEXT NOT NULL,
    remote_jid TEXT NOT NULL,
    message_id TEXT,
    push_name TEXT,
    is_from_me BOOLEAN NOT NULL DEFAULT false,
    content TEXT,
    message_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para armazenar os eventos brutos de Webhook para depuração (opcional, mas recomendado)
CREATE TABLE IF NOT EXISTS public.evolution_webhook_logs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    event_type TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuração de Segurança RLS (Row Level Security)
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Permitir leitura completa para conexões seguras
CREATE POLICY "Leitura total das mensagens WA pelo dono" 
ON public.wa_messages 
FOR SELECT 
USING ( true ); -- Como a instância carrega o prefixo de quem enviou, poderíamos refinar a permissão aqui no futuro

-- Permitir que funções autenticadas (Edge Functions com a chave de Serviço) possam Inserir livremente
CREATE POLICY "Servicos podem inserir mensagens" 
ON public.wa_messages 
FOR INSERT 
WITH CHECK ( true );

CREATE POLICY "Servicos podem inserir logs" 
ON public.evolution_webhook_logs 
FOR INSERT 
WITH CHECK ( true );

-- ==========================================
-- ATENÇÃO, COMANDO DE TEMPO REAL (REALTIME)
-- ==========================================
-- O comando abaixo é OBRIGATÓRIO para ativar o "Modo Ao Vivo"
-- Sem ele, a tabela NÃO envia as mensagens novas rápido para as abas!
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;

-- ===========================================
-- TREINAMENTO DA I.A. E PROMPTS DE SISTEMA
-- ===========================================
CREATE TABLE public.ai_training (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram')),
    system_prompt TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, channel)
);

ALTER TABLE public.ai_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário controla seus próprios treinamentos" 
ON public.ai_training 
FOR ALL USING (auth.uid() = user_id);
