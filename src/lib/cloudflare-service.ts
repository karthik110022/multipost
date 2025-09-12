export class CloudflareService {
  private accountId: string;
  private apiToken: string;
  private imagesBaseUrl: string;
  private streamBaseUrl: string;

  constructor() {
    this.accountId = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID || '';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.imagesBaseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;
    this.streamBaseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
    };
  }

  async uploadImage(file: File): Promise<string> {
    try {
      console.log('Uploading image to Cloudflare Images...', { 
        fileName: file.name, 
        fileSize: file.size,
        fileType: file.type 
      });

      // Create form data for Cloudflare Images upload
      const formData = new FormData();
      formData.append('file', file);
      
      // Optional: Add metadata
      formData.append('metadata', JSON.stringify({
        filename: file.name,
        uploadedAt: new Date().toISOString()
      }));

      // Upload to Cloudflare Images
      const response = await fetch(`${this.imagesBaseUrl}`, {
        method: 'POST',
        headers: this.headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cloudflare Images upload failed:', errorText);
        throw new Error(`Cloudflare Images upload failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || 'Upload failed');
      }

      // Cloudflare Images provides multiple variants, use the public variant
      const imageUrl = result.result.variants[0] || result.result.url;
      console.log('Image uploaded successfully to Cloudflare Images:', imageUrl);
      
      return imageUrl;
    } catch (error: any) {
      console.error('Error uploading to Cloudflare Images:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  async uploadVideo(file: File): Promise<string> {
    try {
      console.log('Uploading video to Cloudflare Stream...', { 
        fileName: file.name, 
        fileSize: file.size,
        fileType: file.type 
      });

      // Step 1: Request a one-time upload URL for direct creator upload
      const uploadUrlResponse = await fetch(`${this.streamBaseUrl}/direct_upload`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 3600, // 1 hour max
          allowedOrigins: ['*'], // In production, specify your domain
          requireSignedURLs: false,
          meta: {
            filename: file.name,
            uploadedAt: new Date().toISOString()
          }
        }),
      });

      if (!uploadUrlResponse.ok) {
        const errorText = await uploadUrlResponse.text();
        console.error('Failed to get Cloudflare Stream upload URL:', errorText);
        throw new Error(`Failed to get upload URL: ${uploadUrlResponse.status}`);
      }

      const uploadUrlResult = await uploadUrlResponse.json();
      
      if (!uploadUrlResult.success) {
        throw new Error(uploadUrlResult.errors?.[0]?.message || 'Failed to get upload URL');
      }

      const { uploadURL, uid } = uploadUrlResult.result;

      // Step 2: Upload the video file to the provided URL
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch(uploadURL, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Video upload failed: ${uploadResponse.status}`);
      }

      // Step 3: Get the video details to return the playback URL
      const videoDetailsResponse = await fetch(`${this.streamBaseUrl}/${uid}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!videoDetailsResponse.ok) {
        console.warn('Could not get video details, but upload may have succeeded');
        // Return a basic playback URL
        return `https://videodelivery.net/${uid}`;
      }

      const videoDetails = await videoDetailsResponse.json();
      
      // Return the playback URL
      const videoUrl = `https://videodelivery.net/${uid}`;
      console.log('Video uploaded successfully to Cloudflare Stream:', videoUrl);
      
      return videoUrl;
    } catch (error: any) {
      console.error('Error uploading to Cloudflare Stream:', error);
      throw new Error(`Failed to upload video: ${error.message}`);
    }
  }

  // Helper method to get video embed HTML
  getVideoEmbedHtml(videoId: string, width = 640, height = 360): string {
    return `<iframe
      src="https://iframe.videodelivery.net/${videoId}?poster=https%3A%2F%2Fvideodelivery.net%2F${videoId}%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600"
      style="border: none; position: absolute; top: 0; left: 0; height: 100%; width: 100%;"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
      allowfullscreen="true">
    </iframe>`;
  }
}