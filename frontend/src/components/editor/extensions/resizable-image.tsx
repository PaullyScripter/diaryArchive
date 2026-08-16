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

  const onHandleDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const imgEl = e.currentTarget.parentElement?.querySelector("img") as HTMLImageElement;
    const startWidth = width || imgEl?.naturalWidth || 300;
    const naturalWidth = imgEl?.naturalWidth || 300;
    const naturalHeight = imgEl?.naturalHeight || 200;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(50, Math.min(startWidth + delta, 1200));
      updateAttributes({
        width: Math.round(newWidth),
        height: Math.round((newWidth / naturalWidth) * naturalHeight),
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <NodeViewWrapper className="resizable-image-wrapper" as="span">
      <span
        className="group"
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
        <span
          className={`resize-handle group-hover:opacity-100 ${selected ? "opacity-100" : "opacity-0"}`}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 18,
            height: 18,
            background: "var(--color-accent, #b8735a)",
            border: "2px solid var(--color-background, #fff)",
            borderRadius: "2px",
            cursor: "nwse-resize",
            transition: "opacity 0.15s ease",
          }}
          onPointerDown={onHandleDown}
          title="Drag to resize"
        />
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
