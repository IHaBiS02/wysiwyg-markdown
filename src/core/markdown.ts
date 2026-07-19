import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  schema,
} from 'prosemirror-markdown';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

export { schema as markdownSchema };

export function parseMarkdown(markdown: string): ProseMirrorNode {
  return defaultMarkdownParser.parse(markdown ?? '');
}

export function serializeMarkdown(document: ProseMirrorNode): string {
  return defaultMarkdownSerializer.serialize(document);
}
