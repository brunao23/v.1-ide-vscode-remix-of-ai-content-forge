import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types';
import { getAgentById } from '@/services/chatService';
import { Copy, ThumbsUp, ThumbsDown, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

interface Props {
  message: Message;
  agentId: string;
}

export default function MessageBubble({ message, agentId }: Props) {
  const agent = getAgentById(agentId);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-secondary text-foreground px-4 py-3 rounded-[20px_20px_4px_20px] max-w-[85%] text-base leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Agent avatar + name */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
          style={{ background: (agent?.color || '#10a37f') + '22' }}
        >
          {agent?.emoji || '🤖'}
        </span>
        <span className="text-xs text-muted-foreground">{agent?.name || 'Assistente'}</span>
      </div>

      {/* Thinking indicator */}
      {message.thinking && (
        <details className="text-sm text-muted-foreground mb-3 cursor-pointer">
          <summary className="italic hover:text-foreground transition-colors">
            Pensou por {message.thinkingDuration?.toFixed(0) || '?'}s
          </summary>
          <div className="mt-2 p-3 bg-secondary rounded-lg text-sm text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
            {message.thinking}
          </div>
        </details>
      )}

      {/* Message content */}
      <div className={`prose-chat text-base ${message.isStreaming ? 'typing-cursor' : ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>

      {/* Action buttons */}
      {!message.isStreaming && (
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={handleCopy}
            className="p-2 rounded-md hover:bg-secondary transition-colors group"
            title="Copiar"
          >
            <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
          <button className="p-2 rounded-md hover:bg-secondary transition-colors group">
            <ThumbsUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
          <button className="p-2 rounded-md hover:bg-secondary transition-colors group">
            <ThumbsDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
          <button className="p-2 rounded-md hover:bg-secondary transition-colors group">
            <MoreHorizontal className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
