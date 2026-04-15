-- Add video_url column to store reel/video URLs for saved posts
alter table public.market_research_saved_posts
  add column if not exists video_url text;

-- Allow upsert policy to update video_url (update policy)
create policy "Users can update own saved posts"
  on public.market_research_saved_posts for update
  using (auth.uid() = user_id);
