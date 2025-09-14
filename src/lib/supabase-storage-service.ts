import { createClient } from '@supabase/supabase-js';

export class SupabaseStorageService {
  private supabase;

  constructor() {
    // Use service role key for server-side operations to bypass RLS
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async uploadMedia(file: File, userId: string): Promise<{ url: string; path: string }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      console.log('Uploading to Supabase Storage:', fileName);

      const { data, error } = await this.supabase.storage
        .from('media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      console.log('File uploaded successfully to Supabase:', publicUrl);

      return {
        url: publicUrl,
        path: fileName
      };
    } catch (error: any) {
      console.error('Error uploading to Supabase Storage:', error);
      throw new Error(`Failed to upload media: ${error.message}`);
    }
  }

  async deleteMedia(filePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from('media')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting from Supabase:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting media:', error);
      return false;
    }
  }
}