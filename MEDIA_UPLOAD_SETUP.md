# Media Upload Setup - Direct Reddit Integration

## Overview
This implementation uses **direct Reddit API uploads** instead of external storage services like Cloudflare. This approach is:
- ✅ **Completely FREE** - No external storage costs
- ✅ **Simple** - No external dependencies
- ✅ **Reliable** - Uses Reddit's native media hosting

## How It Works

### Upload Flow:
1. **User uploads media** → Files stay in browser memory
2. **Direct Reddit upload** → Files sent directly to Reddit's API
3. **Reddit hosts media** → Reddit stores files on `i.redd.it` (images) or `v.redd.it` (videos)
4. **URLs saved to database** → Reddit URLs stored for post history
5. **Post history displays media** → Images/videos shown from Reddit's servers

### Database Changes:
- Added `media_urls` column to `post_platforms` table
- Added `has_media` boolean flag for quick filtering
- Media URLs are stored as TEXT[] array

### Code Changes:
1. **reddit-service.ts** - Removed Cloudflare dependency, uses direct Reddit API
2. **social-media-service.ts** - Updated to save media URLs to database
3. **PostHistory.tsx** - Added media display component
4. **Migration** - Added database columns for media storage

## Benefits:
- **No storage costs** - Reddit hosts everything for free
- **Better reliability** - No external service dependencies
- **Faster uploads** - Direct to Reddit, no intermediate storage
- **Automatic optimization** - Reddit handles image/video processing

## Testing:
1. Run database migration: Apply `20250914_add_media_urls_to_post_history.sql`
2. Restart your dev server: `npm run dev`
3. Go to `/create-post` and upload images/videos
4. Check `/history` to see media in post history

## Credits:
Media upload implementation developed with assistance from Claude (Anthropic).