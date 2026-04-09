import type { SavedPage, FrameManifest, PagePlan } from "../types";

const STORAGE_KEY = "everforge-3d-pages";

function generateId(): string {
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadPages(): SavedPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePages(pages: SavedPage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

export type PageStoreListener = () => void;

class PageStore {
  private listeners: Set<PageStoreListener> = new Set();
  private pages: SavedPage[] = loadPages();

  subscribe(listener: PageStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    savePages(this.pages);
    this.listeners.forEach((l) => l());
  }

  getPages(): SavedPage[] {
    return this.pages;
  }

  getPageById(id: string): SavedPage | undefined {
    return this.pages.find((p) => p.id === id);
  }

  createPage(data: {
    name: string;
    description: string;
    prompt: string;
    referenceUrl?: string;
    additionalContext?: string;
    frameCount: number;
  }): SavedPage {
    const now = new Date().toISOString();
    const page: SavedPage = {
      id: generateId(),
      name: data.name,
      description: data.description,
      status: "draft",
      referenceUrl: data.referenceUrl,
      additionalContext: data.additionalContext,
      frameCount: data.frameCount,
      prompt: data.prompt,
      createdAt: now,
      updatedAt: now,
    };
    this.pages = [page, ...this.pages];
    this.notify();
    return page;
  }

  updatePage(id: string, updates: Partial<SavedPage>): SavedPage | undefined {
    const idx = this.pages.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    this.pages[idx] = {
      ...this.pages[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.notify();
    return this.pages[idx];
  }

  updatePageResult(
    id: string,
    result: { frameManifest: FrameManifest; pagePlan: PagePlan }
  ) {
    const thumbnail = result.frameManifest.frames[0]?.imageUrl;
    this.updatePage(id, {
      status: "complete",
      frameManifest: result.frameManifest,
      pagePlan: result.pagePlan,
      thumbnailUrl: thumbnail,
      generatedAt: new Date().toISOString(),
    });
  }

  deletePage(id: string) {
    this.pages = this.pages.filter((p) => p.id !== id);
    this.notify();
  }
}

export const pageStore = new PageStore();
