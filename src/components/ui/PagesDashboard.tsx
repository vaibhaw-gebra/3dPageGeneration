import { useState, useEffect, useCallback } from "react";
import type { SavedPage, CreatePageFormData } from "../../types";
import { pageStore } from "../../store/pageStore";
import { streamGeneratePage, streamExtractBrand, type SSEProgressEvent, type BrandExtractionEvent } from "../../api/bedrock";
import { CreatePageModal } from "./CreatePageModal";

interface PagesDashboardProps {
  onOpenPage: (page: SavedPage) => void;
  onBack: () => void;
}

export function PagesDashboard({ onOpenPage, onBack }: PagesDashboardProps) {
  const [pages, setPages] = useState<SavedPage[]>(pageStore.getPages());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [generatingPageId, setGeneratingPageId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ message: string; progress: number } | null>(null);

  useEffect(() => {
    return pageStore.subscribe(() => setPages([...pageStore.getPages()]));
  }, []);

  const handleCreate = useCallback(async (data: CreatePageFormData) => {
    setShowCreateModal(false);

    // Create page in store
    const page = pageStore.createPage({
      name: data.pageName,
      description: data.goal,
      prompt: data.goal,
      referenceUrl: data.referenceUrl,
      additionalContext: data.context,
      frameCount: data.frameCount,
    });

    pageStore.updatePage(page.id, { status: "generating" });
    setGeneratingPageId(page.id);
    setGenerationProgress({ message: "Starting...", progress: 0 });

    try {
      // Step 1: Brand extraction (if reference URL provided)
      if (data.referenceUrl) {
        setGenerationProgress({ message: "Extracting brand & theme from website...", progress: 2 });

        const brandData = await streamExtractBrand(
          data.referenceUrl,
          (event: BrandExtractionEvent) => {
            if (event.event === "progress") {
              // Brand extraction maps to 0-15% of total progress
              const scaledProgress = Math.round((event.progress || 0) * 0.15);
              setGenerationProgress({
                message: event.message || "Extracting brand...",
                progress: scaledProgress,
              });
            }
          }
        );

        // Store brand data on the page
        pageStore.updatePage(page.id, { brandAndTheme: brandData } as any);
        setGenerationProgress({ message: "Brand extracted! Starting page generation...", progress: 15 });
      }

      // Step 2: Full page generation (SSE pipeline)
      const result = await streamGeneratePage(
        {
          prompt: data.goal,
          referenceUrl: data.referenceUrl,
          frameCount: data.frameCount,
        },
        (event: SSEProgressEvent) => {
          if (event.event === "progress") {
            // Page generation maps to 15-100% of total progress
            const scaledProgress = 15 + Math.round((event.progress || 0) * 0.85);
            setGenerationProgress({
              message: event.message || "Working...",
              progress: scaledProgress,
            });
          }
        }
      );

      pageStore.updatePageResult(page.id, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      pageStore.updatePage(page.id, { status: "error" });
      setGenerationProgress({ message: msg, progress: 0 });
    } finally {
      setGeneratingPageId(null);
      setGenerationProgress(null);
    }
  }, []);

  const handleDelete = useCallback((e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    if (confirm("Delete this page?")) {
      pageStore.deletePage(pageId);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Navbar */}
      <nav className="h-14 flex items-center justify-between px-6 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <span className="text-purple-400 font-black text-lg tracking-wider">EVERFORGE</span>
          <span className="text-zinc-500 text-sm">|</span>
          <span className="text-zinc-300 text-sm font-medium">My Pages</span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Page
        </button>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {pages.length === 0 && !generatingPageId ? (
          <EmptyState onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pages.map((page) => (
                <PageCard
                  key={page.id}
                  page={page}
                  isGenerating={generatingPageId === page.id}
                  generationProgress={generatingPageId === page.id ? generationProgress : null}
                  onClick={() => {
                    if (page.status === "complete") onOpenPage(page);
                  }}
                  onDelete={(e) => handleDelete(e, page.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <CreatePageModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

// ─── Page Card ────────────────────────────────────────────────────

function PageCard({
  page,
  isGenerating,
  generationProgress,
  onClick,
  onDelete,
}: {
  page: SavedPage;
  isGenerating: boolean;
  generationProgress: { message: string; progress: number } | null;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: "Draft", color: "text-zinc-400", bg: "bg-zinc-700" },
    generating: { label: "Generating", color: "text-purple-400", bg: "bg-purple-600/20" },
    "wireframe-completed": { label: "Wireframe", color: "text-blue-400", bg: "bg-blue-600/20" },
    complete: { label: "Complete", color: "text-green-400", bg: "bg-green-600/20" },
    error: { label: "Error", color: "text-red-400", bg: "bg-red-600/20" },
  };

  const status = statusConfig[page.status] || statusConfig.draft;

  return (
    <div
      onClick={onClick}
      className={`group relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all ${
        page.status === "complete"
          ? "cursor-pointer hover:border-purple-600/50 hover:shadow-lg hover:shadow-purple-900/10"
          : "cursor-default"
      }`}
    >
      {/* Thumbnail / Placeholder */}
      <div className="aspect-video bg-zinc-800 relative overflow-hidden">
        {page.thumbnailUrl ? (
          <img
            src={page.thumbnailUrl}
            alt={page.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isGenerating ? (
              <div className="text-center space-y-2 px-4">
                <svg className="w-8 h-8 text-purple-400 animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-[11px] text-zinc-500 truncate">
                  {generationProgress?.message || "Generating..."}
                </p>
              </div>
            ) : (
              <svg className="w-10 h-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.068 2.069m-7.154-4.31a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06zm-4.5 7.5h11.25a2.25 2.25 0 002.25-2.25v-11.25a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v11.25a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
          </div>
        )}

        {/* Progress bar overlay */}
        {isGenerating && generationProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900/80">
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${generationProgress.progress}%` }}
            />
          </div>
        )}

        {/* Status badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.color}`}>
          {isGenerating && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse mr-1 align-middle" />
          )}
          {status.label}
        </div>

        {/* Delete button */}
        {!isGenerating && (
          <button
            onClick={onDelete}
            className="absolute top-2 right-2 p-1 rounded-lg bg-zinc-900/80 text-zinc-500 hover:text-red-400 hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-semibold text-zinc-200 truncate">{page.name}</h3>
        <p className="text-xs text-zinc-500 line-clamp-2">{page.description}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-zinc-600">
            {new Date(page.createdAt).toLocaleDateString()}
          </span>
          {page.referenceUrl && (
            <span className="text-[10px] text-purple-500 truncate max-w-[120px]">
              {new URL(page.referenceUrl).hostname}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">No pages yet</h2>
          <p className="text-sm text-zinc-500">
            Create your first 3D cinematic website page. Describe a scene, optionally provide a reference website, and watch the AI generate everything.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 mx-auto"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Your First Page
        </button>
      </div>
    </div>
  );
}
