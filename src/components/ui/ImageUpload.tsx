import { useCallback, useRef } from "react";

interface ImageUploadInlineProps {
  onImageSelected: (file: File, base64: string) => void;
  disabled?: boolean;
}

/**
 * Inline image upload button for embedding in the chat input area.
 * Renders as a small paperclip/image icon button.
 */
export function ImageUploadInline({
  onImageSelected,
  disabled = false,
}: ImageUploadInlineProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        onImageSelected(file, base64);
      };
      reader.readAsDataURL(file);

      // Reset so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onImageSelected]
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
        title="Attach reference image"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.068 2.069m-7.154-4.31a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06zm-4.5 7.5h11.25a2.25 2.25 0 002.25-2.25v-11.25a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v11.25a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </button>
    </>
  );
}
