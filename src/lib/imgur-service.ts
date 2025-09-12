export interface ImgurResponse {
  data: {
    id: string;
    title: string;
    description: string;
    datetime: number;
    type: string;
    animated: boolean;
    width: number;
    height: number;
    size: number;
    views: number;
    bandwidth: number;
    vote: any;
    favorite: boolean;
    nsfw: any;
    section: any;
    account_url: any;
    account_id: any;
    is_ad: boolean;
    in_most_viral: boolean;
    has_sound: boolean;
    tags: any[];
    ad_type: number;
    ad_url: string;
    edited: string;
    in_gallery: boolean;
    link: string;
    deletehash: string;
  };
  success: boolean;
  status: number;
}

export class ImgurService {
  private clientId: string;
  private baseUrl = 'https://api.imgur.com/3';

  constructor() {
    this.clientId = process.env.IMGUR_CLIENT_ID || '';
    if (!this.clientId) {
      console.warn('Imgur Client ID not found. Image uploads will fail.');
    }
  }

  async uploadImage(file: File): Promise<{ url: string; deleteHash?: string }> {
    if (!this.clientId) {
      throw new Error('Imgur Client ID not configured');
    }

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${this.baseUrl}/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Client-ID ${this.clientId}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Imgur upload failed: ${response.status} ${errorText}`);
      }

      const result: ImgurResponse = await response.json();

      if (!result.success) {
        throw new Error('Imgur upload failed: Invalid response');
      }

      return {
        url: result.data.link,
        deleteHash: result.data.deletehash,
      };
    } catch (error: any) {
      console.error('Error uploading to Imgur:', error);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  async deleteImage(deleteHash: string): Promise<boolean> {
    if (!this.clientId) {
      throw new Error('Imgur Client ID not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/image/${deleteHash}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Client-ID ${this.clientId}`
        },
      });

      const result = await response.json();
      return result.success;
    } catch (error: any) {
      console.error('Error deleting from Imgur:', error);
      return false;
    }
  }
}