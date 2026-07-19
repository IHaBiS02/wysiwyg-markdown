import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorState, type Plugin, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
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

export class WysiwygMarkdownElement extends LitElement {
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

  protected blockSourceOpen = false;
  protected blockSourceValue = '';
  protected documentSourceValue = '';

  #view?: EditorView;
  #registry = new ExtensionRegistry();
  #blockSourceRange?: BlockSourceRange;
  #lastDocumentMarkdown = '';
  #plugins: Plugin[] = [];

  connectedCallback(): void {
    super.connectedCallback();
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

  #mountEditor(): void {
    if (this.#view) return;
    const mount = this.renderRoot.querySelector<HTMLElement>('#editor-mount');
    if (!mount) throw new Error('Editor mount element was not created.');

    const document = this.#parseOrReport(this.value);
    this.#lastDocumentMarkdown = serializeMarkdown(document);
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
    });
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
      if (this.mode === 'source') {
        this.documentSourceValue = this.value;
      } else if (changed.get('mode') === 'source') {
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
    return undo(this.#view.state, this.#view.dispatch, this.#view);
  }

  redo(): boolean {
    if (!this.#view) return false;
    return redo(this.#view.state, this.#view.dispatch, this.#view);
  }

  execute(commandName: string): boolean {
    if (!this.#view) return false;
    const command = this.#commands()[commandName];
    if (!command) return false;
    return command({
      state: this.#view.state,
      dispatch: this.#view.dispatch,
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
    this.#view.dispatch(this.#view.state.tr.insertText(text, from, to));
    return true;
  }

  insertMarkdown(markdown: string): boolean {
    if (!this.#view || !this.#isEditable()) return false;
    const parsed = this.#parseOrReport(markdown);
    const { from, to } = this.#view.state.selection;
    this.#view.dispatch(
      this.#view.state.tr.replaceWith(from, to, parsed.content).scrollIntoView(),
    );
    return true;
  }

  replaceSelection(markdown: string): boolean {
    return this.insertMarkdown(markdown);
  }

  cancelBlockSourceEdit = (): void => {
    this.blockSourceOpen = false;
    this.blockSourceValue = '';
    this.#blockSourceRange = undefined;
    this.#view?.focus();
  };

  applyBlockSourceEdit = (): void => {
    if (!this.#view || !this.#blockSourceRange) return;
    const parsed = this.#parseOrReport(this.blockSourceValue);
    const { from, to } = this.#blockSourceRange;
    this.#view.dispatch(
      this.#view.state.tr.replaceWith(from, to, parsed.content).scrollIntoView(),
    );
    this.blockSourceOpen = false;
    this.blockSourceValue = '';
    this.#blockSourceRange = undefined;
    this.#emitChange('source-edit');
    this.#view.focus();
  };

  #isEditable(): boolean {
    return this.mode === 'wysiwyg' && !this.readonly && !this.disabled;
  }

  #createPlugins(): Plugin[] {
    return [
      history(),
      createStandardInputRules(),
      ...this.#registry.plugins(),
      keymap({
        'Mod-z': undo,
        'Shift-Mod-z': redo,
        'Mod-y': redo,
      }),
      keymap(baseKeymap),
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
      this.#emitInput(transaction.getMeta('paste') ? 'paste' : 'keyboard');
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
    const nextState = this.#view.state.apply(transaction);
    this.#view.updateState(nextState);
    const canonical = serializeMarkdown(nextState.doc);
    this.#lastDocumentMarkdown = canonical;
    this.value = canonical;
    this.documentSourceValue = canonical;
    if (emit) this.#emitInput(source);
  }

  #parseOrReport(markdown: string): ProseMirrorNode {
    try {
      return parseMarkdown(markdown);
    } catch (error) {
      this.dispatchEvent(
        new CustomEvent('editor-error', {
          detail: { error, markdown },
          bubbles: true,
          composed: true,
        }),
      );
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
      this.#replaceDocument(this.documentSourceValue, true, 'source-edit');
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
