-- Marketplace Conversations & Messages
-- P2P messaging between buyers and sellers
-- Participants: buyer + seller (exactly 2)
-- Messages are append-only

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'resolved')),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT different_parties CHECK (buyer_id != seller_id),
    CONSTRAINT unique_conversation UNIQUE(listing_id, buyer_id, seller_id)
);

CREATE TABLE IF NOT EXISTS public.marketplace_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.marketplace_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketplace_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: Only buyer & seller can read/write
CREATE POLICY "Read own conversations" ON marketplace_conversations
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Create conversation" ON marketplace_conversations
    FOR INSERT WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Update own conversation" ON marketplace_conversations
    FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Messages: Only conversation participants can read/write
CREATE POLICY "Read conversation messages" ON marketplace_messages
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM marketplace_conversations
            WHERE id = conversation_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

CREATE POLICY "Send message" ON marketplace_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS(
            SELECT 1 FROM marketplace_conversations
            WHERE id = conversation_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

-- Indexes
CREATE INDEX idx_marketplace_conversations_buyer ON marketplace_conversations(buyer_id);
CREATE INDEX idx_marketplace_conversations_seller ON marketplace_conversations(seller_id);
CREATE INDEX idx_marketplace_conversations_listing ON marketplace_conversations(listing_id);
CREATE INDEX idx_marketplace_conversations_status ON marketplace_conversations(status);
CREATE INDEX idx_marketplace_conversations_last_message_at ON marketplace_conversations(last_message_at DESC);

CREATE INDEX idx_marketplace_messages_conversation ON marketplace_messages(conversation_id);
CREATE INDEX idx_marketplace_messages_sender ON marketplace_messages(sender_id);
CREATE INDEX idx_marketplace_messages_created_at ON marketplace_messages(created_at DESC);
CREATE INDEX idx_marketplace_messages_unread ON marketplace_messages(read_at) WHERE read_at IS NULL;

COMMIT;
