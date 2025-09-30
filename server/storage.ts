import { type VideoGeneration, type InsertVideoGeneration } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createVideoGeneration(data: InsertVideoGeneration): Promise<VideoGeneration>;
  getVideoGeneration(id: string): Promise<VideoGeneration | undefined>;
  updateVideoGeneration(id: string, data: Partial<InsertVideoGeneration>): Promise<VideoGeneration | undefined>;
  listVideoGenerations(): Promise<VideoGeneration[]>;
}

export class MemStorage implements IStorage {
  private videoGenerations: Map<string, VideoGeneration>;

  constructor() {
    this.videoGenerations = new Map();
  }

  async createVideoGeneration(data: InsertVideoGeneration): Promise<VideoGeneration> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const videoGeneration: VideoGeneration = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.videoGenerations.set(id, videoGeneration);
    return videoGeneration;
  }

  async getVideoGeneration(id: string): Promise<VideoGeneration | undefined> {
    return this.videoGenerations.get(id);
  }

  async updateVideoGeneration(id: string, data: Partial<InsertVideoGeneration>): Promise<VideoGeneration | undefined> {
    const existing = this.videoGenerations.get(id);
    if (!existing) return undefined;
    
    const updated: VideoGeneration = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.videoGenerations.set(id, updated);
    return updated;
  }

  async listVideoGenerations(): Promise<VideoGeneration[]> {
    return Array.from(this.videoGenerations.values());
  }
}

export const storage = new MemStorage();
