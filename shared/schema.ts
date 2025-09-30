import { z } from "zod";

export const shopifyProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  productType: z.string().optional(),
  vendor: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.object({
    id: z.string(),
    url: z.string(),
    altText: z.string().optional(),
  })).optional(),
  variants: z.array(z.object({
    id: z.string(),
    title: z.string(),
    sku: z.string().optional(),
    price: z.string().optional(),
  })).optional(),
});

export const imageUploadSchema = z.object({
  file: z.instanceof(File).or(z.string()),
  productName: z.string().optional(),
  shopifyProductId: z.string().optional(),
});

export const videoGenerationSchema = z.object({
  id: z.string(),
  productName: z.string(),
  imageUrl: z.string(),
  imagekitUrl: z.string().optional(),
  status: z.enum(['pending', 'analyzing', 'generating', 'completed', 'failed']),
  geminiDescription: z.string().optional(),
  videoPrompt: z.string().optional(),
  videoUrl: z.string().optional(),
  videoData: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ShopifyProduct = z.infer<typeof shopifyProductSchema>;
export type ImageUpload = z.infer<typeof imageUploadSchema>;
export type VideoGeneration = z.infer<typeof videoGenerationSchema>;
export type InsertVideoGeneration = Omit<VideoGeneration, 'id' | 'createdAt' | 'updatedAt'>;
