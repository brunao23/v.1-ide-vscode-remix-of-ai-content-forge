import { Agent } from '@/types';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

interface Props {
  agent: Agent;
  onStarterClick: (starter: string) => void;
}

export default function ConversationStarters({ agent, onStarterClick }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 pb-4" style={{ paddingTop: '15vh' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-[600px] w-full"
      >
        {/* Agent avatar */}
        <div
          className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl"
          style={{ background: agent.color + '22' }}
        >
          {agent.emoji}
        </div>

        {/* Agent name */}
        <h1 className="text-3xl font-bold text-foreground mb-2">{agent.name}</h1>

        {/* Recommended model */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <CheckCircle className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm text-muted-foreground">
            Modelo recomendado: <span className="text-primary">{agent.recommendedModel}</span>
          </span>
        </div>

        {/* Description */}
        <p className="text-text-secondary text-[15px] leading-relaxed max-w-[500px] mx-auto mb-8">
          {agent.description}
        </p>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-xs text-muted-foreground">Etapa {agent.order} de 7</span>
          <div className="flex gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className={`w-6 h-1.5 rounded-full ${
                  i + 1 <= agent.order ? 'bg-primary' : 'bg-secondary'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Starters grid */}
        <div className="grid grid-cols-2 gap-3 max-w-[500px] mx-auto">
          {agent.starters.map((starter, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              onClick={() => onStarterClick(starter)}
              className="bg-secondary border border-border-secondary rounded-xl p-4 text-left text-sm text-foreground leading-relaxed hover:border-[hsl(var(--border-focus))] hover:bg-accent transition-colors cursor-pointer"
            >
              {starter}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
