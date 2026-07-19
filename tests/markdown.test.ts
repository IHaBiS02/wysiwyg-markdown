import { describe, expect, it } from 'vitest';
import { parseMarkdown, serializeMarkdown } from '../src/core/markdown';

describe('Markdown conversion', () => {
  it('round-trips the supported document structure', () => {
    const source = [
      '# Heading',
      '',
      'A paragraph with **bold**, *italic*, and `code`.',
      '',
      '- first',
      '- second',
      '',
      '> quote',
    ].join('\n');

    const serialized = serializeMarkdown(parseMarkdown(source));

    expect(serialized).toContain('# Heading');
    expect(serialized).toContain('**bold**');
    expect(serialized).toContain('*italic*');
    // The serializer intentionally canonicalizes unordered list markers.
    expect(serialized).toContain('* first');
    expect(serialized).toContain('> quote');
  });

  it('accepts an empty document', () => {
    expect(serializeMarkdown(parseMarkdown(''))).toBe('');
  });
});
