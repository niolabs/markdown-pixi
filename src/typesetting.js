import { wrap } from './wrap';

const nodeIsBlock = elem => (
  elem === 'para' ||
  elem === 'header' ||
  elem === 'hr' ||
  elem === 'blockquote' ||
  elem === 'code_block' ||
  elem === 'listitem'
);

const typesetTextPlain = (text, style, options, forme, left, indent) => {
  const lines = wrap(text, style);
  let lineNum = 0;
  let doNotGetStuckInInfiniteLoop = 100000;
  do {
    const sLeft = lineNum === 0 ? indent : left;
    const allowLonger = lineNum === 0 && indent === left;
    const [line, width, , , metrics, end] = lines.next(sLeft, allowLonger);

    if (line.length) {
      const appendPrevious = (lineNum === 0 && !(indent === left));
      const formeLine = (appendPrevious ? forme : (forme.push([]), forme))[forme.length - 1];
      const tLeft = lineNum === 0 ? indent : left;
      formeLine.push([line, tLeft, style, metrics]);
    }

    if (end) { return [left, (lineNum === 0 ? indent : left) + Math.round(width)]; }

    lineNum += 1;
    doNotGetStuckInInfiniteLoop -= -1;
  } while (doNotGetStuckInInfiniteLoop > 0);

  throw new Error('possible infinite loop... too many lines iterated');
};

const typesetText = (text, style, options, forme, left, indent) => (
  typesetTextPlain(text.replace(/(?:\n|\r|\r\n| {2,})/g, ' '), style, options, forme, left, indent)
);

const typesetNode = (node, baseStyle, options, forme = [], iLeft, iIndent) => {
  let left = iLeft;
  let indent = iIndent;
  const [elem, ...rest] = node;

  const props = (
    typeof rest[0] === 'object' && !Array.isArray(rest[0])
  ) ? rest.shift() : {};

  const style = options.getStyle(baseStyle, elem, props);

  switch (elem) {
    case 'blockquote': {
      left += 20;
      indent += 20;
      break;
    }
    case 'code_block': {
      left += 10;
      indent += 10;
      break;
    }
    case 'listitem': {
      left += 20;
      indent += 20;
      break;
    }
    default:
  }

  rest.forEach((child) => {
    const typeset = Array.isArray(child) ? typesetNode
      : elem === 'code_block' ? typesetTextPlain
        : elem === 'inlinecode' ? typesetTextPlain
          : typesetText;

    const [nLeft, nIndent] = typeset(child, style, options, forme, left, indent);

    left = nLeft;
    indent = nIndent;
  });

  if (nodeIsBlock(elem)) {
    indent = iLeft;
    left = iLeft;
    if (forme.length > 0 && forme[forme.length - 1][0][0] !== undefined) {
      forme.push([
        [undefined, 0, style, { ascent: 7, descent: 0, fontSize: 7 }],
      ]);
    }
  }

  return [left, indent];
};

export const typesetMarkdown = (node, style, options, forme = []) => {
  typesetNode(node, style, options, forme, 0, 0);
  return forme;
};
