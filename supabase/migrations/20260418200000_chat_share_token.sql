-- Add share_token to enable public conversation sharing
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_share_token
  ON chat_conversations(share_token)
  WHERE share_token IS NOT NULL;

-- Allow public (unauthenticated) reads of shared conversations
CREATE POLICY "Public read shared conversations"
  ON chat_conversations FOR SELECT
  USING (share_token IS NOT NULL);

-- Allow public reads of messages belonging to a shared conversation
CREATE POLICY "Public read messages of shared conversations"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations cc
      WHERE cc.id = chat_messages.conversation_id
        AND cc.share_token IS NOT NULL
    )
  );

-- Allow owner to set/clear their own share_token
CREATE POLICY "Owner can update share_token"
  ON chat_conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
