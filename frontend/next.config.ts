import type { NextConfig } from "next";
import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Bundle Monaco's editor + language-service workers locally (no CDN) so
      // the professional HTML/CSS editor stays privacy-first and offline-capable.
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: ["html", "css"],
          features: [
            "bracketMatching",
            "bracketPairColorization",
            "caretOperations",
            "clipboard",
            "codeAction",
            "codelens",
            "colorPicker",
            "comment",
            "contextmenu",
            "coreCommands",
            "cursorUndo",
            "find",
            "folding",
            "fontZoom",
            "format",
            "gotoError",
            "gotoLine",
            "hover",
            "inPlaceReplace",
            "indentation",
            "inlineCompletions",
            "inlineSuggestions",
            "linesOperations",
            "links",
            "multicursor",
            "parameterHints",
            "quickCommand",
            "quickHelp",
            "quickOutline",
            "referenceSearch",
            "rename",
            "smartSelect",
            "snippet",
            "suggest",
            "toggleHighContrast",
            "toggleTabFocusMode",
            "transpose",
            "wordHighlighter",
            "wordOperations",
            "wordPartOperations",
          ],
        }),
      );
    }
    return config;
  },
};

export default nextConfig;