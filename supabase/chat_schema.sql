-- Live Chat System for Agent-Admin Communication
-- Run this in Supabase SQL Editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chat conversations table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_agent ON public.chat_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON public.chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON public.chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_read ON public.chat_messages(read) WHERE read = false;

-- Enable Row Level Security
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean re-run)
DROP POLICY IF EXISTS "Agents can view own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Agents can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can view conversation messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update own message read status" ON public.chat_messages;

-- RLS Policies for chat_conversations
-- Agents can see their own conversations
CREATE POLICY "Agents can view own conversations"
ON public.chat_conversations FOR SELECT
USING (
    agent_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
    )
);

-- Admins can view all conversations
CREATE POLICY "Admins can view all conversations"
ON public.chat_conversations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
    )
);

-- Agents can create conversations
CREATE POLICY "Agents can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (
    agent_id = auth.uid() 
    AND EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'agent'
    )
);

-- RLS Policies for chat_messages
-- Users can see messages in their conversations
CREATE POLICY "Users can view conversation messages"
ON public.chat_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = conversation_id 
        AND (
            c.agent_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
            )
        )
    )
);

-- Users can insert messages in their conversations
CREATE POLICY "Users can insert messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = conversation_id 
        AND (
            c.agent_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
            )
        )
    )
);

-- Users can update read status of messages
CREATE POLICY "Users can update own message read status"
ON public.chat_messages FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = conversation_id 
        AND (
            c.agent_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = conversation_id 
        AND (
            c.agent_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
            )
        )
    )
);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

-- Create function to update last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_conversations
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update last_message_at
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON public.chat_messages;
CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();
