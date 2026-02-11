import { SearchRequest, SearchResponse, Post, PostMetrics } from '@/types/marketResearch';

const WEBHOOK_URL = 'https://seu-n8n.com/webhook/pesquisa-mercado';

// Generate mock data for demo purposes
function generateMockPosts(count: number, type?: string): Post[] {
  const types: Post['type'][] = ['reel', 'carousel', 'image', 'video'];
  const captions = [
    '🚀 5 estratégias de marketing digital que vão transformar seu negócio em 2026! #marketing #digital #estrategia',
    '📊 Como analisar seus concorrentes e encontrar oportunidades no mercado. Salve esse post! #empreendedorismo',
    '🎯 O segredo para criar conteúdo que engaja: conheça seu público como ninguém. #conteudo #engajamento',
    '💡 Dica rápida: Use storytelling nos seus reels para aumentar a retenção em até 300%! #reels #storytelling',
    '🔥 Tendências de redes sociais para ficar de olho esse ano. Qual você já está usando? #tendencias #socialmedia',
    '📱 Tutorial: Como criar carrosséis que viralizam no Instagram. Passo a passo completo! #tutorial #instagram',
    '🎬 Por trás das câmeras: como eu gravo meus vídeos em casa com equipamento simples. #bastidores #criador',
    '✨ Resultados reais: cliente aumentou vendas em 250% com nossa estratégia de conteúdo #resultados #case',
  ];

  return Array.from({ length: count }, (_, i) => {
    const postType = type && type !== 'all' ? type as Post['type'] : types[Math.floor(Math.random() * types.length)];
    const metrics: PostMetrics = {
      likes: Math.floor(Math.random() * 50000) + 500,
      comments: Math.floor(Math.random() * 2000) + 10,
      shares: Math.floor(Math.random() * 1000) + 5,
      views: Math.floor(Math.random() * 500000) + 5000,
      engagement_rate: Math.round((Math.random() * 8 + 0.5) * 10) / 10,
    };

    return {
      id: `post_${Date.now()}_${i}`,
      post_url: `https://instagram.com/p/${Math.random().toString(36).slice(2, 8)}`,
      type: postType,
      thumbnail_url: `https://picsum.photos/seed/${i + Date.now()}/400/400`,
      media_url: `https://picsum.photos/seed/${i + Date.now()}/800/800`,
      caption: captions[i % captions.length],
      published_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
      metrics,
      hashtags: ['#marketing', '#digital', '#conteudo'],
      mentions: Math.random() > 0.5 ? ['@usuario1'] : [],
    };
  });
}

export async function searchMarket(request: SearchRequest): Promise<SearchResponse> {
  // For demo, return mock data. Replace with real webhook call below.
  await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

  const posts = generateMockPosts(24, request.post_type);

  return {
    success: true,
    request_id: request.request_id,
    metadata: {
      platform: request.platform,
      username: request.username || request.keyword || '',
      profile_picture: `https://picsum.photos/seed/profile/200/200`,
      followers: Math.floor(Math.random() * 1000000) + 10000,
      following: Math.floor(Math.random() * 1000) + 100,
      total_posts: posts.length,
      scraped_at: new Date().toISOString(),
    },
    posts,
    pagination: {
      total: 127,
      returned: posts.length,
      has_more: true,
      next_cursor: 'cursor_next',
    },
  };

  /* Real webhook call:
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return res.json();
  */
}

export async function loadMorePosts(request: SearchRequest): Promise<SearchResponse> {
  await new Promise(r => setTimeout(r, 1500));
  const posts = generateMockPosts(12, request.post_type);
  return {
    success: true,
    request_id: request.request_id,
    posts,
    pagination: {
      total: 127,
      returned: posts.length,
      has_more: false,
    },
  };
}
