import { Agent } from '@/types';

// Mapeia agent ID → tipo de documento que ele produz (igual ao DB)
export const AGENT_TO_DOC_TYPE: Record<string, string> = {
  'brand-book': 'brand-book',
  'market-research': 'pesquisa',
  'icp-architect': 'icp',
  'pillar-strategist': 'pilares',
  'matrix-generator': 'matriz',
  'diretora-criativa': 'calendario',
  'scriptwriter': 'roteiro',
};

// Mapeia tipo de documento → agent ID que o produz
export const DOC_TYPE_TO_AGENT: Record<string, string> = {
  'brand-book': 'brand-book',
  'pesquisa': 'market-research',
  'icp': 'icp-architect',
  'pilares': 'pillar-strategist',
  'matriz': 'matrix-generator',
  'calendario': 'diretora-criativa',
  'roteiro': 'scriptwriter',
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  'brand-book': 'Brand Book',
  'pesquisa': 'Pesquisa de Mercado',
  'icp': 'Mapa do ICP',
  'pilares': 'Pilares de Conteúdo',
  'matriz': 'Matriz de Conteúdo',
  'calendario': 'Calendário Editorial',
  'roteiro': 'Roteiro de Vídeo',
};

// Retorna lista de tipos de documentos que faltam para usar o agente
export function getMissingDocTypes(agent: Agent, existingTypes: Set<string>): string[] {
  return agent.requires
    .map(agentId => AGENT_TO_DOC_TYPE[agentId])
    .filter((type): type is string => Boolean(type))
    .filter(type => !existingTypes.has(type));
}
