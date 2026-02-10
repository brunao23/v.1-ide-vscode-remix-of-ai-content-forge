import { AGENTS, Agent } from '@/types';
import { useChatStore } from '@/stores/chatStore';

// Simulated AI responses per agent
const MOCK_RESPONSES: Record<string, string[]> = {
  'brand-book': [
    `## Vamos construir seu Brand Book! 📘\n\nQue ótimo que você quer definir a identidade da sua marca! Vou te guiar por um processo estratégico de perguntas para criar um Brand Book completo.\n\n### Primeira pergunta:\n\n**Qual é o nome da sua marca e qual problema ela resolve?**\n\nMe conte de forma simples: o que sua empresa faz e por que ela existe. Isso vai ser a base de todo o nosso trabalho.`,
    `Excelente! Agora vamos aprofundar.\n\n### Segunda pergunta:\n\n**Qual é a missão da sua marca?**\n\nA missão deve responder: *"O que fazemos, para quem e como fazemos diferente?"*\n\nTente pensar em uma frase que capture a essência do impacto que sua marca quer causar no mundo.`,
  ],
  'market-research': [
    `## Iniciando Pesquisa de Mercado 🔍\n\nVou analisar seu mercado com base no Brand Book que já temos. Deixe-me começar mapeando:\n\n1. **Concorrentes diretos e indiretos**\n2. **Tendências do segmento**\n3. **Oportunidades inexploradas**\n4. **Ameaças potenciais**\n\nAnalisando dados...`,
  ],
  'icp-architect': [
    `## Construindo seu ICP 🎯\n\nCom base no Brand Book e na Pesquisa de Mercado, vou criar o perfil completo do seu cliente ideal.\n\n### Vamos começar:\n\n**Descreva em detalhes quem é a pessoa que mais se beneficia do seu produto/serviço.** Pense em:\n- Idade, gênero, localização\n- Profissão e renda\n- Estilo de vida\n- O que a mantém acordada à noite`,
  ],
};

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find(a => a.id === id);
}

export function simulateResponse(agentId: string, messageIndex: number): string {
  const responses = MOCK_RESPONSES[agentId] || MOCK_RESPONSES['brand-book'];
  return responses[messageIndex % responses.length] || responses[0];
}

export async function streamResponse(
  text: string,
  onChunk: (accumulated: string) => void,
  onDone: () => void
) {
  let accumulated = '';
  const chars = text.split('');
  
  for (let i = 0; i < chars.length; i++) {
    accumulated += chars[i];
    onChunk(accumulated);
    // Variable speed: faster for spaces, slower for newlines
    const delay = chars[i] === '\n' ? 60 : chars[i] === ' ' ? 15 : 20;
    await new Promise(r => setTimeout(r, delay));
  }
  onDone();
}
