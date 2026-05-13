import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as fs from 'fs';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.configService.get<string>('cloudinary.cloudName'),
      api_key: this.configService.get<string>('cloudinary.apiKey'),
      api_secret: this.configService.get<string>('cloudinary.apiSecret'),
    });
  }

  async upload(
    filePath: string,
    publicId: string,
    folder: string,
  ): Promise<{ url: string; publicId: string }> {
    const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      resource_type: 'auto',
    });

    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      this.logger.warn(`Failed to delete temp file: ${filePath}`, err);
    }

    return { url: result.secure_url, publicId: result.public_id };
  }

  async delete(urlOrPublicId: string): Promise<void> {
    if (!urlOrPublicId) return;

    let publicId = urlOrPublicId;
    if (urlOrPublicId.startsWith('http')) {
      const match = urlOrPublicId.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      if (match) publicId = match[1];
    }

    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
      this.logger.warn(`Failed to delete from Cloudinary: ${publicId}`, err);
    }

    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch { /* not raw type — ignore */ }
  }
}
