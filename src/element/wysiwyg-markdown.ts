import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorState, type Plugin, type Transaction } from 'prosemirror-state';
import { EditorView, type NodeView } from 'prosemirror-view';
import { standardCommands, type EditorCommand } from '../core/commands';
import {
  markdownSchema,
  parseMarkdown,
  serializeMarkdown,
} from '../core/markdown';
import { ExtensionRegistry } from '../extensions/registry';
import { createStandardInputRules } from '../extensions/standard';
import type { EditorExtension } from '../extensions/types';
import { editorStyles } from './styles';

export type EditorMode = 'wysiwyg' | 'source' | 'readonly';

interface BlockSourceRange {
  from: number;
  to: number;
}

export interface WysiwygMarkdownInputDetail {
  markdown: string;
  source: 'keyboard' | 'paste' | 'command' | 'source-edit' | 'api';
}

export type ImageUploadHandler = (file: File) => Promise<string | null>;
export type ImageResolver = (source: string) => Promise<string | null> | string | null;
export type PastedTextTransformer = (text: string) => string;

export class WysiwygMarkdownElement extends LitElement {
  static formAssociated = true;

  static properties = {
    value: { type: String },
    mode: { type: String, reflect: true },
    placeholder: { type: String },
    readonly: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    name: { type: String, reflect: true },
    blockSourceOpen: { state: true },
    blockSourceValue: { state: true },
  };

  static styles = editorStyles;

  value = '';
  mode: EditorMode = 'wysiwyg';
  placeholder = '';
  readonly = false;
  disabled = false;
  name = '';
  uploadImage?: ImageUploadHandler;
  imageResolver?: ImageResolver;
  transformPastedText?: PastedTextTransformer;

  protected blockSourceOpen = false;
  protected blockSourceValue = '';
  protected documentSourceValue = '';

  #view?: EditorView;
  #registry = new ExtensionRegistry();
  #blockSourceRange?: BlockSourceRange;
  #lastDocumentMarkdown = '';
  #plugins: Plugin[] = [];
  readonly #historyPlugin = history();
  readonly #standardInputRulesPlugin = createStandardInputRules();
  readonly #historyKeymapPlugin = keymap({
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-y': redo,
  });
  readonly #baseKeymapPlugin = keymap(baseKeymap);
  #internals?: ElementInternals;
  #defaultValue = '';

  constructor() {
    super();
    if (typeof this.attachInternals === 'function') {
      this.#internals = this.attachInternals();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'textbox');
    if (!this.hasAttribute('aria-multiline')) {
      this.setAttribute('aria-multiline', 'true');
    }
    if (this.hasUpdated && !this.#view) {
      this.updateComplete.then(() => this.#mountEditor());
    }
  }

  render() {
    const sourceMode = this.mode === 'source';
    const empty = !this.value.trim();

    return html`
      <div class="surface" part="surface">
        ${empty && !sourceMode && this.placeholder
          ? html`<div class="placeholder" part="placeholder">${this.placeholder}</div>`
          : nothing}
        <div
          id="editor-mount"
          class="editor-mount"
          part="editor"
          ?hidden=${sourceMode}
          @dblclick=${this.#handleEditorDoubleClick}
        ></div>
        <textarea
          id="document-source"
          class="source-editor"
          part="source-editor"
          aria-label="Markdown source"
          spellcheck="false"
          ?hidden=${!sourceMode}
          ?readonly=${this.readonly}
          ?disabled=${this.disabled}
          .value=${this.documentSourceValue}
          @input=${this.#handleDocumentSourceInput}
          @keydown=${this.#handleDocumentSourceKeyDown}
        ></textarea>
        ${this.blockSourceOpen
          ? html`
              <section class="block-source-panel" part="block-source-panel">
                <textarea
                  id="block-source"
                  aria-label="Block Markdown source"
                  spellcheck="false"
                  .value=${this.blockSourceValue}
                  @input=${this.#handleBlockSourceInput}
                  @keydown=${this.#handleBlockSourceKeyDown}
                ></textarea>
                <div class="block-source-actions">
                  <button type="button" @click=${this.cancelBlockSourceEdit}>취소</button>
                  <button
                    type="button"
                    class="primary"
                    @click=${this.applyBlockSourceEdit}
                  >적용</button>
                </div>
              </section>
            `
          : nothing}
      </div>
    `;
  }

  protected firstUpdated(): void {
    this.#mountEditor();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated && changed.has('value')) {
      this.value = serializeMarkdown(this.#parseOrReport(this.value));
    }
    if (changed.has('mode') && this.mode === 'source') {
      this.documentSourceValue = this.value;
    }
  }

  #mountEditor(): void {
    if (this.#view) return;
    const mount = this.renderRoot.querySelector<HTMLElement>('#editor-mount');
    if (!mount) throw new Error('Editor mount element was not created.');

    const document = this.#parseOrReport(this.value);
    this.#lastDocumentMarkdown = serializeMarkdown(document);
    this.#defaultValue = this.value;
    this.documentSourceValue = this.value;
    this.#plugins = this.#createPlugins();
    const state = EditorState.create({
      doc: document,
      schema: markdownSchema,
      plugins: this.#plugins,
    });

    this.#view = new EditorView(mount, {
      state,
      editable: () => this.#isEditable(),
      dispatchTransaction: (transaction) => this.#dispatchTransaction(transaction),
      transformPastedText: (text) => this.transformPastedText?.(text) ?? text,
      handlePaste: (view, event) => this.#handleImagePaste(view, event),
      handleDOMEvents: {
        blur: () => {
          this.#emitChange('keyboard');
          return false;
        },
      },
      nodeViews: {
        image: (node) => this.#createImageNodeView(node),
        list_item: (node, view, getPos) =>
          this.#createListItemNodeView(node, view, getPos),
      },
    });
    this.#syncFormValue();
  }

  protected updated(changed: PropertyValues<this>): void {
    if (!this.#view) return;

    if (
      changed.has('value') &&
      this.mode !== 'source' &&
      this.value !== this.#lastDocumentMarkdown
    ) {
      this.#replaceDocument(this.value, false);
    }

    if (changed.has('mode')) {
      if (changed.get('mode') === 'source' && this.mode !== 'source') {
        this.#replaceDocument(this.documentSourceValue, true, 'source-edit');
      }
      this.#view.setProps({ editable: () => this.#isEditable() });
      this.dispatchEvent(
        new CustomEvent('mode-change', {
          detail: { mode: this.mode },
          bubbles: true,
          composed: true,
        }),
      );
    }

    if (changed.has('readonly') || changed.has('disabled')) {
      this.#view.setProps({ editable: () => this.#isEditable() });
    }

    if (
      changed.has('mode') ||
      changed.has('readonly') ||
      changed.has('disabled')
    ) {
      this.#refreshTaskCheckboxes();
    }

    if (changed.has('value') || changed.has('disabled')) {
      this.#syncFormValue();
    }
  }

  disconnectedCallback(): void {
    this.#view?.destroy();
    this.#view = undefined;
    super.disconnectedCallback();
  }

  getMarkdown(): string {
    return this.value;
  }

  setMarkdown(markdown: string): void {
    this.value = markdown ?? '';
    if (this.mode === 'source') this.documentSourceValue = this.value;
  }

  formResetCallback(): void {
    this.setMarkdown(this.#defaultValue);
  }

  setMode(mode: EditorMode): void {
    if (!['wysiwyg', 'source', 'readonly'].includes(mode)) {
      throw new Error(`Unsupported editor mode: ${mode}`);
    }
    this.mode = mode;
  }

  override focus(options?: FocusOptions): void {
    if (this.mode === 'source') {
      this.updateComplete.then(() =>
        this.renderRoot.querySelector<HTMLTextAreaElement>('#document-source')?.focus(options),
      );
      return;
    }
    this.#view?.focus();
  }

  undo(): boolean {
    if (!this.#view) return false;
    return undo(
      this.#view.state,
      (transaction) =>
        this.#view?.dispatch(transaction.setMeta('wysiwygMarkdownSource', 'command')),
      this.#view,
    );
  }

  redo(): boolean {
    if (!this.#view) return false;
    return redo(
      this.#view.state,
      (transaction) =>
        this.#view?.dispatch(transaction.setMeta('wysiwygMarkdownSource', 'command')),
      this.#view,
    );
  }

  execute(commandName: string): boolean {
    if (!this.#view) return false;
    const command = this.#commands()[commandName];
    if (!command) return false;
    return command({
      state: this.#view.state,
      dispatch: (transaction) =>
        this.#view?.dispatch(transaction.setMeta('wysiwygMarkdownSource', 'command')),
      view: this.#view,
    });
  }

  use(extension: EditorExtension): void {
    this.#registry.add(extension);
    this.#reconfigurePlugins();
  }

  removeExtension(name: string): boolean {
    const removed = this.#registry.remove(name);
    if (removed) this.#reconfigurePlugins();
    return removed;
  }

  getExtensions(): readonly EditorExtension[] {
    return this.#registry.list();
  }

  insertText(text: string): boolean {
    if (!this.#view || !this.#isEditable()) return false;
    const { from, to } = this.#view.state.selection;
    this.#view.dispatch(
      this.#view.state.tr
        .insertText(text, from, to)
        .setMeta('wysiwygMarkdownSource', 'api'),
    );
    return true;
  }

  insertMarkdown(markdown: string): boolean {
    if (!this.#view || !this.#isEditable()) return false;
    const parsed = this.#parseOrReport(markdown);
    const { from, to } = this.#view.state.selection;
    this.#view.dispatch(
      this.#view.state.tr
        .replaceWith(from, to, parsed.content)
        .scrollIntoView()
        .setMeta('wysiwygMarkdownSource', 'api'),
    );
    return true;
  }

  replaceSelection(markdown: string): boolean {
    return this.insertMarkdown(markdown);
  }

  insertImage(source: string, alt = 'Image', title: string | null = null): boolean {
    if (!this.#view || !this.#isEditable()) return false;
    const image = markdownSchema.nodes.image.create({ src: source, alt, title });
    this.#view.dispatch(
      this.#view.state.tr
        .replaceSelectionWith(image)
        .scrollIntoView()
        .setMeta('wysiwygMarkdownSource', 'api'),
    );
    return true;
  }

  cancelBlockSourceEdit = (): void => {
    this.blockSourceOpen = false;
    this.blockSourceValue = '';
    this.#blockSourceRange = undefined;
    this.#view?.setProps({ editable: () => this.#isEditable() });
    this.#refreshTaskCheckboxes();
    this.#view?.focus();
  };

  applyBlockSourceEdit = (): void => {
    if (!this.#view || !this.#blockSourceRange) return;
    const parsed = this.#parseOrReport(this.blockSourceValue);
    const { from, to } = this.#blockSourceRange;
    this.#view.dispatch(
      this.#view.state.tr
        .replaceWith(from, to, parsed.content)
        .scrollIntoView()
        .setMeta('wysiwygMarkdownSource', 'source-edit'),
    );
    this.blockSourceOpen = false;
    this.blockSourceValue = '';
    this.#blockSourceRange = undefined;
    this.#view.setProps({ editable: () => this.#isEditable() });
    this.#refreshTaskCheckboxes();
    this.#emitChange('source-edit');
    this.#view.focus();
  };

  #isEditable(): boolean {
    return (
      this.mode === 'wysiwyg' &&
      !this.readonly &&
      !this.disabled &&
      !this.blockSourceOpen
    );
  }

  #createPlugins(): Plugin[] {
    return [
      this.#historyPlugin,
      this.#standardInputRulesPlugin,
      ...this.#registry.plugins(),
      this.#historyKeymapPlugin,
      this.#baseKeymapPlugin,
    ];
  }

  #reconfigurePlugins(): void {
    if (!this.#view) return;
    this.#plugins = this.#createPlugins();
    this.#view.updateState(
      this.#view.state.reconfigure({ plugins: this.#plugins }),
    );
  }

  #commands(): Record<string, EditorCommand> {
    return this.#registry.commands(standardCommands);
  }

  #dispatchTransaction(transaction: Transaction): void {
    if (!this.#view) return;
    const state = this.#view.state.apply(transaction);
    this.#view.updateState(state);

    if (transaction.docChanged) {
      const markdown = serializeMarkdown(state.doc);
      this.#lastDocumentMarkdown = markdown;
      this.value = markdown;
      this.documentSourceValue = markdown;
      if (!transaction.getMeta('wysiwygMarkdownSilent')) {
        const source =
          transaction.getMeta('wysiwygMarkdownSource') ??
          (transaction.getMeta('paste') ? 'paste' : 'keyboard');
        this.#emitInput(source);
      }
    }

    if (transaction.selectionSet) {
      this.dispatchEvent(
        new CustomEvent('selection-change', {
          detail: {
            from: state.selection.from,
            to: state.selection.to,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  #replaceDocument(
    markdown: string,
    emit: boolean,
    source: WysiwygMarkdownInputDetail['source'] = 'api',
  ): void {
    if (!this.#view) return;
    const parsed = this.#parseOrReport(markdown);
    const transaction = this.#view.state.tr.replaceWith(
      0,
      this.#view.state.doc.content.size,
      parsed.content,
    );
    transaction.setMeta('wysiwygMarkdownSource', source);
    transaction.setMeta('wysiwygMarkdownSilent', !emit);
    if (source === 'api') transaction.setMeta('addToHistory', false);
    this.#view.dispatch(transaction);
  }

  #parseOrReport(markdown: string): ProseMirrorNode {
    try {
      return parseMarkdown(markdown);
    } catch (error) {
      this.#reportError(error, markdown);
      return parseMarkdown('');
    }
  }

  #emitInput(source: WysiwygMarkdownInputDetail['source']): void {
    this.dispatchEvent(
      new CustomEvent<WysiwygMarkdownInputDetail>('input', {
        detail: { markdown: this.value, source },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #emitChange(source: WysiwygMarkdownInputDetail['source']): void {
    this.dispatchEvent(
      new CustomEvent<WysiwygMarkdownInputDetail>('change', {
        detail: { markdown: this.value, source },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #syncFormValue(): void {
    if (this.#internals && typeof this.#internals.setFormValue === 'function') {
      this.#internals.setFormValue(this.disabled ? null : this.value);
    }
  }

  #reportError(error: unknown, markdown: string): void {
    this.dispatchEvent(
      new CustomEvent('editor-error', {
        detail: { error, markdown },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #handleImagePaste(view: EditorView, event: ClipboardEvent): boolean {
    const file = [...(event.clipboardData?.files ?? [])].find((candidate) =>
      candidate.type.startsWith('image/'),
    );
    if (!file || !this.uploadImage) return false;

    event.preventDefault();
    const selection = {
      from: view.state.selection.from,
      to: view.state.selection.to,
    };
    void this.#uploadAndInsertImage(file, selection);
    return true;
  }

  async #uploadAndInsertImage(file: File, selection: BlockSourceRange): Promise<void> {
    if (!this.#view || !this.uploadImage) return;
    try {
      const source = await this.uploadImage(file);
      if (!source || !this.#view) return;
      const image = markdownSchema.nodes.image.create({
        src: source,
        alt: file.name || 'Image',
        title: null,
      });
      const maximum = this.#view.state.doc.content.size;
      const from = Math.min(selection.from, maximum);
      const to = Math.min(selection.to, maximum);
      this.#view.dispatch(
        this.#view.state.tr
          .replaceWith(from, to, image)
          .scrollIntoView()
          .setMeta('wysiwygMarkdownSource', 'paste'),
      );
    } catch (error) {
      this.#reportError(error, `[image paste: ${file.name}]`);
    }
  }

  #createImageNodeView(initialNode: ProseMirrorNode): NodeView {
    const image = document.createElement('img');
    let node = initialNode;
    let resolvedSource: string | null = null;
    let destroyed = false;

    const updateSource = async (source: string): Promise<void> => {
      image.dataset.source = source;
      image.alt = node.attrs.alt ?? '';
      image.title = node.attrs.title ?? '';
      try {
        resolvedSource = this.imageResolver
          ? await this.imageResolver(source)
          : source;
        if (destroyed) {
          this.#revokeResolvedImage(resolvedSource);
          return;
        }
        if (resolvedSource) {
          image.src = resolvedSource;
          image.removeAttribute('data-missing');
        } else {
          image.removeAttribute('src');
          image.dataset.missing = 'true';
          image.alt = node.attrs.alt || `Image not found: ${source}`;
        }
      } catch (error) {
        image.removeAttribute('src');
        image.dataset.missing = 'true';
        this.#reportError(error, source);
      }
    };

    void updateSource(node.attrs.src);
    return {
      dom: image,
      update: (updatedNode) => {
        if (updatedNode.type !== node.type) return false;
        this.#revokeResolvedImage(resolvedSource);
        resolvedSource = null;
        node = updatedNode;
        void updateSource(updatedNode.attrs.src);
        return true;
      },
      destroy: () => {
        destroyed = true;
        this.#revokeResolvedImage(resolvedSource);
      },
    };
  }

  #revokeResolvedImage(source: string | null): void {
    if (source?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(source);
    }
  }

  #createListItemNodeView(
    initialNode: ProseMirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
  ): NodeView {
    const item = document.createElement('li');
    let node = initialNode;

    if (node.attrs.checked === null) {
      return { dom: item, contentDOM: item };
    }

    item.dataset.task = 'true';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.contentEditable = 'false';
    checkbox.setAttribute('aria-label', 'Toggle task');
    checkbox.checked = Boolean(node.attrs.checked);
    checkbox.disabled = !this.#isEditable();

    const content = document.createElement('div');
    content.className = 'task-content';
    item.append(checkbox, content);
    item.dataset.checked = checkbox.checked ? 'true' : 'false';

    const handleChange = (): void => {
      if (!this.#isEditable()) {
        checkbox.checked = Boolean(node.attrs.checked);
        return;
      }
      const position = getPos();
      if (typeof position !== 'number') return;
      view.dispatch(
        view.state.tr
          .setNodeMarkup(position, undefined, {
            ...node.attrs,
            checked: checkbox.checked,
          })
          .setMeta('wysiwygMarkdownSource', 'command'),
      );
    };
    checkbox.addEventListener('change', handleChange);

    return {
      dom: item,
      contentDOM: content,
      update: (updatedNode) => {
        if (
          updatedNode.type !== node.type ||
          updatedNode.attrs.checked === null
        ) {
          return false;
        }
        node = updatedNode;
        checkbox.checked = Boolean(updatedNode.attrs.checked);
        checkbox.disabled = !this.#isEditable();
        item.dataset.checked = checkbox.checked ? 'true' : 'false';
        return true;
      },
      stopEvent: (event) => event.target === checkbox,
      destroy: () => checkbox.removeEventListener('change', handleChange),
    };
  }

  #refreshTaskCheckboxes(): void {
    this.renderRoot
      .querySelectorAll<HTMLInputElement>('li[data-task] > input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.disabled = !this.#isEditable();
      });
  }

  #handleEditorDoubleClick = (event: MouseEvent): void => {
    if (!this.#view || !this.#isEditable()) return;
    const result = this.#view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    if (!result) return;

    const resolved = this.#view.state.doc.resolve(result.pos);
    if (resolved.depth < 1) return;
    const node = resolved.node(1);
    const from = resolved.before(1);
    const to = resolved.after(1);
    const temporaryDocument = markdownSchema.topNodeType.create(null, [node]);

    this.#blockSourceRange = { from, to };
    this.blockSourceValue = serializeMarkdown(temporaryDocument);
    this.blockSourceOpen = true;
    this.#view.setProps({ editable: () => this.#isEditable() });
    this.updateComplete.then(() => {
      const textarea = this.renderRoot.querySelector<HTMLTextAreaElement>('#block-source');
      textarea?.focus();
      textarea?.select();
    });
  };

  #handleDocumentSourceInput = (event: InputEvent): void => {
    this.documentSourceValue = (event.currentTarget as HTMLTextAreaElement).value;
    this.value = this.documentSourceValue;
    this.#emitInput('source-edit');
  };

  #handleDocumentSourceKeyDown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.setMode('wysiwyg');
    }
  };

  #handleBlockSourceInput = (event: InputEvent): void => {
    this.blockSourceValue = (event.currentTarget as HTMLTextAreaElement).value;
  };

  #handleBlockSourceKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelBlockSourceEdit();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.applyBlockSourceEdit();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'wysiwyg-markdown': WysiwygMarkdownElement;
  }
}
