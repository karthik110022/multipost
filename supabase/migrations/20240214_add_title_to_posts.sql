-- Add title column to posts table
alter table public.posts 
add column title text;

-- Update existing posts to extract title from content
update public.posts
set title = split_part(content, E'\n', 1)
where title is null;
