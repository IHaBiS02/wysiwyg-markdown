import {
  InputRule,
  textblockTypeInputRule,
  wrappingInputRule,
} from 'prosemirror-inputrules';
import type { Plugin } from 'prosemirror-state';
import { inputRules } from 'prosemirror-inputrules';
import { markdownSchema } from '../core/markdown';

export function createStandardInputRules(): Plugin {
  const rules = [
    textblockTypeInputRule(
      /^(#{1,6})\s$/,
      markdownSchema.nodes.heading,
      (match) => ({ level: match[1].length }),
    ),
    textblockTypeInputRule(/^```$/, markdownSchema.nodes.code_block),
    wrappingInputRule(/^\s*>\s$/, markdownSchema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, markdownSchema.nodes.bullet_list),
    wrappingInputRule(
      /^(\d+)\.\s$/,
      markdownSchema.nodes.ordered_list,
      (match) => ({ order: Number(match[1]) }),
      (match, node) => node.childCount + node.attrs.order === Number(match[1]),
    ),
    new InputRule(/^---$/, (state, _match, start, end) => {
      const horizontalRule = markdownSchema.nodes.horizontal_rule;
      if (!horizontalRule) return null;
      return state.tr.replaceWith(start, end, horizontalRule.create());
    }),
  ];

  return inputRules({ rules });
}
