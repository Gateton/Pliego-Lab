import type { Chat } from "../types/chat";
import { useT } from "../i18n";
import { imageThumbnailUrl } from "../api/comfyInject";
import { Modal } from "./ui";

interface Props {
  chat: Chat;
  onClose: () => void;
}

/** Grid of every image generated in this chat (reads existing message.images — no extra storage). */
export function ChatGalleryModal({ chat, onClose }: Props) {
  const t = useT();
  const images = chat.messages.flatMap((m) =>
    Object.entries(m.images ?? {}).flatMap(([key, result]) =>
      result.status === "ok" ? [{ key: `${m.id}:${key}`, url: result.url, prompt: result.prompt }] : []
    )
  );

  return (
    <Modal title={t("chat.gallery.title")} onClose={onClose} size="lg">
      {images.length === 0 ? (
        <p className="text-sm text-text-muted">{t("chat.gallery.empty")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <a key={img.key} href={img.url} target="_blank" rel="noreferrer" title={img.prompt}>
              <img
                src={imageThumbnailUrl(img.url, 192)}
                alt={img.prompt}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full rounded-md border border-border object-cover transition-opacity hover:opacity-90"
              />
            </a>
          ))}
        </div>
      )}
    </Modal>
  );
}
