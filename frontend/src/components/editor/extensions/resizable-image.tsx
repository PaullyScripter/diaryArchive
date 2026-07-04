import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImage: {
      setResizableImage: (options: { src: string; width?: number; height?: number }) => ReturnType;
    };
  }
}

function ResizableImageNodeView({ node, updateAttributes, selected }: any) {
  const { src, alt, title, width, height } = node.attrs;

  return (
    <NodeViewWrapper className="resizable-image-wrapper" as="span">
      <span
        style={{
          display: "inline-block",
          position: "relative",
          maxWidth: "100%",
        }}
      >
        <img
          src={src}
          alt={alt}
          title={title}
          width={width}
          height={height}
          draggable
          data-drag-handle
          style={{
            display: "block",
            maxWidth: "100%",
            height: "auto",
            borderRadius: "0.375rem",
            width: width ? `${width}px` : undefined,
          }}
        />
        {(selected || node.attrs.width) && (
          <span
            className="resize-handle"
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 14,
              height: 14,
              background: "var(--color-accent, #b8735a)",
              borderRadius: "0 0 0.375rem 0",
              cursor: "nwse-resize",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const startX = e.clientX;
              const imgEl = e.currentTarget.parentElement?.querySelector("img") as HTMLImageElement;
              const startWidth = width || imgEl?.naturalWidth || 300;
              const naturalWidth = imgEl?.naturalWidth || 300;
              const naturalHeight = imgEl?.naturalHeight || 200;

              const onMove = (ev: MouseEvent) => {
                const delta = ev.clientX - startX;
                const newWidth = Math.max(50, Math.min(startWidth + delta, 1200));
                updateAttributes({
                  width: Math.round(newWidth),
                  height: Math.round((newWidth / naturalWidth) * naturalHeight),
                });
              };

              const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
              };

              document.addEventListener("mousemove", onMove);
              document.addEventListener("mouseup", onUp);
            }}
          />
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  name: "resizableImage",

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLElement).getAttribute("width");
          return w ? parseInt(w, 10) : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          return { width: attrs.width };
        },
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const h = (el as HTMLElement).getAttribute("height");
          return h ? parseInt(h, 10) : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.height) return {};
          return { height: attrs.height };
        },
      },
    };
  },

  addCommands() {
    return {
      setResizableImage:
        (options) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                src: options.src,
                width: options.width ?? null,
                height: options.height ?? null,
              },
            })
            .run(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  },
});
