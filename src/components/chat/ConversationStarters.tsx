import { Agent, AGENT_AVATARS } from '@/types';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

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
        <img
          src={AGENT_AVATARS[agent.id]}
          alt={agent.name}
          className="w-20 h-20 rounded-full object-cover mx-auto mb-4"
        />

        <h1 className="text-3xl font-bold text-foreground mb-2">{agent.name}</h1>

        {/* Model badge in GRAY with check, not green */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <Check className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Usando o modelo recomendado pelo criador: {agent.recommendedModel}
          </span>
        </div>

        <p className="text-muted-foreground text-[15px] leading-relaxed max-w-[500px] mx-auto mb-8">
          {agent.description}
        </p>

        {/* NO progress bar - ChatGPT doesn't have this */}

        {/* Starters grid - smaller, more subtle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
          {agent.starters.map((starter, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              onClick={() => onStarterClick(starter)}
              className="text-left p-3 rounded-xl border border-border bg-secondary hover:border-muted-foreground/30 transition-colors cursor-pointer"
            >
              <span className="text-sm text-foreground leading-relaxed">{starter}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
