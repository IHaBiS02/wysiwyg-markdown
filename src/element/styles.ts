import { css } from 'lit';

export const editorStyles = css`
  :host {
    --editor-background: #ffffff;
    --editor-color: #1f2328;
    --editor-border-color: #d0d7de;
    --editor-muted-background: #f6f8fa;
    --editor-accent: #0969da;
    --editor-font-family:
      ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --editor-code-font-family:
      ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
    --editor-font-size: 16px;
    --editor-min-height: 240px;

    display: block;
    min-width: 0;
    color: var(--editor-color);
    font-family: var(--editor-font-family);
    font-size: var(--editor-font-size);
  }

  * {
    box-sizing: border-box;
  }

  .surface {
    min-height: var(--editor-min-height);
    overflow: auto;
    border: 1px solid var(--editor-border-color);
    border-radius: 8px;
    background: var(--editor-background);
  }

  .editor-mount,
  .source-editor {
    min-height: var(--editor-min-height);
  }

  .editor-mount[hidden],
  .source-editor[hidden] {
    display: none;
  }

  .editor-mount .ProseMirror {
    min-height: var(--editor-min-height);
    padding: 16px;
    outline: none;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .editor-mount .ProseMirror > *:first-child {
    margin-top: 0;
  }

  .editor-mount .ProseMirror > *:last-child {
    margin-bottom: 0;
  }

  .editor-mount .ProseMirror p {
    line-height: 1.65;
  }

  .editor-mount .ProseMirror h1,
  .editor-mount .ProseMirror h2,
  .editor-mount .ProseMirror h3,
  .editor-mount .ProseMirror h4,
  .editor-mount .ProseMirror h5,
  .editor-mount .ProseMirror h6 {
    line-height: 1.25;
  }

  .editor-mount .ProseMirror blockquote {
    margin-left: 0;
    padding-left: 1em;
    border-left: 4px solid var(--editor-border-color);
    color: color-mix(in srgb, var(--editor-color) 72%, transparent);
  }

  .editor-mount .ProseMirror pre,
  .editor-mount .ProseMirror code {
    font-family: var(--editor-code-font-family);
    background: var(--editor-muted-background);
  }

  .editor-mount .ProseMirror pre {
    overflow-x: auto;
    padding: 12px;
    border-radius: 6px;
    white-space: pre;
  }

  .editor-mount .ProseMirror code {
    padding: 0.12em 0.3em;
    border-radius: 4px;
  }

  .editor-mount .ProseMirror pre code {
    padding: 0;
  }

  .editor-mount .ProseMirror img {
    max-width: 100%;
    height: auto;
  }

  .source-editor {
    display: block;
    width: 100%;
    resize: none;
    border: 0;
    padding: 16px;
    outline: none;
    background: var(--editor-background);
    color: var(--editor-color);
    font: inherit;
    font-family: var(--editor-code-font-family);
    line-height: 1.55;
    tab-size: 2;
  }

  .block-source-panel {
    position: sticky;
    bottom: 0;
    z-index: 2;
    border-top: 1px solid var(--editor-border-color);
    padding: 12px;
    background: var(--editor-muted-background);
    box-shadow: 0 -8px 24px rgb(0 0 0 / 8%);
  }

  .block-source-panel textarea {
    display: block;
    width: 100%;
    min-height: 120px;
    resize: vertical;
    border: 1px solid var(--editor-border-color);
    border-radius: 6px;
    padding: 10px;
    background: var(--editor-background);
    color: var(--editor-color);
    font-family: var(--editor-code-font-family);
    font-size: 0.9em;
    line-height: 1.5;
  }

  .block-source-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  button {
    border: 1px solid var(--editor-border-color);
    border-radius: 6px;
    padding: 6px 10px;
    background: var(--editor-background);
    color: var(--editor-color);
    cursor: pointer;
  }

  button.primary {
    border-color: var(--editor-accent);
    background: var(--editor-accent);
    color: #ffffff;
  }

  :host([disabled]) {
    opacity: 0.65;
  }

  :host([disabled]) .surface {
    cursor: not-allowed;
  }

  .placeholder {
    pointer-events: none;
    position: absolute;
    margin: 16px;
    color: color-mix(in srgb, var(--editor-color) 45%, transparent);
  }
`;
