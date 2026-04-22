ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'regular';

UPDATE public.chat_conversations
SET conversation_type = 'regular'
WHERE conversation_type IS NULL OR conversation_type = '';
