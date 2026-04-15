import { AGENTS } from '@/types';

type MentionMatch = {
  agentId: string;
  mentionStart: number;
  mentionEnd: number;
};

type MentionContext = {
  start: number;
  end: number;
  query: string;
};

function normalizeAlias(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}

function buildAliasMap() {
  const aliases = new Map<string, string>();

  for (const agent of AGENTS) {
    const idAlias = normalizeAlias(agent.id);
    if (idAlias) aliases.set(idAlias, agent.id);

    const nameAlias = normalizeAlias(agent.name);
    if (nameAlias) aliases.set(nameAlias, agent.id);

    const nameParts = agent.name
      .split(/\s+/)
      .map((part) => normalizeAlias(part))
      .filter(Boolean);
    for (const part of nameParts) {
      if (!aliases.has(part)) aliases.set(part, agent.id);
    }
  }

  return aliases;
}

const AGENT_ALIAS_MAP = buildAliasMap();

export function getMentionContext(text: string, cursorIndex: number): MentionContext | null {
  const safeCursor = Math.max(0, Math.min(cursorIndex, text.length));
  const atIndex = text.lastIndexOf('@', Math.max(0, safeCursor - 1));
  if (atIndex === -1) return null;

  if (atIndex > 0) {
    const prevChar = text[atIndex - 1];
    if (/[a-zA-Z0-9_-]/.test(prevChar)) return null;
  }

  const query = text.slice(atIndex + 1, safeCursor);
  if (!/^[a-zA-Z0-9._-]*$/.test(query)) return null;

  return {
    start: atIndex,
    end: safeCursor,
    query,
  };
}

function resolveMentionToken(token: string): string | null {
  const cleanToken = token.replace(/^@/, '').trim();
  if (!cleanToken) return null;
  const alias = normalizeAlias(cleanToken);
  if (!alias) return null;
  return AGENT_ALIAS_MAP.get(alias) || null;
}

export function resolveMentionedAgent(text: string): { targetAgentId: string | null; cleanedText: string } {
  const regex = /(^|[\s([{])@([a-zA-Z0-9._-]+)/g;
  const matches: MentionMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const full = match[0];
    const prefix = match[1] || '';
    const token = `@${match[2] || ''}`;
    const agentId = resolveMentionToken(token);
    if (!agentId) continue;

    const mentionStart = match.index + prefix.length;
    const mentionEnd = mentionStart + token.length;
    matches.push({ agentId, mentionStart, mentionEnd });

    if (full.length === 0) break;
  }

  if (matches.length === 0) {
    return { targetAgentId: null, cleanedText: text.trim() };
  }

  const selected = matches[matches.length - 1];
  let cleaned = text;

  // Remove all valid agent mentions from text before sending to model.
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    cleaned = cleaned.slice(0, m.mentionStart) + cleaned.slice(m.mentionEnd);
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return { targetAgentId: selected.agentId, cleanedText: cleaned };
}
