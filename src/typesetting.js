import smartypants from 'smartypants';
import { decodeHTML } from 'entities';

import { wrap } from './wrap';
import { textType, imageType, spacerType } from './typesetting-types';

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
    const allowLonger = lineNum !== 0 || indent === left;
    const [line, width, , , metrics, end] = lines.next(sLeft, allowLonger);

    if (line.length) {
      const appendPrevious = lineNum === 0;
      const formeLine = (appendPrevious ? forme : (forme.push([]), forme))[forme.length - 1];
      const tLeft = lineNum === 0 ? indent : left;
      formeLine.push([textType, line, tLeft, width, style, metrics]);
    }

    if (end) { return [left, (lineNum === 0 ? indent : left) + Math.round(width)]; }

    lineNum += 1;
    doNotGetStuckInInfiniteLoop -= 1;
  } while (doNotGetStuckInInfiniteLoop > 0);

  throw new Error('possible infinite loop... too many lines iterated');
};

const whitespaceRegex = /(?:\n|\r|\r\n| {2,})/g;
const typesetText = (text, style, options, forme, left, indent) => {
  let result = text;
  result = options.collapseWhitespace ? result.replace(whitespaceRegex, ' ') : result;
  result = options.smartypants ? smartypants(result, 'qDe') : result;
  result = options.decodeEntities ? decodeHTML(result) : result;
  return typesetTextPlain(result, style, options, forme, left, indent);
};

const typesetNode = (node, baseStyle, options, forme = [], iLeft, iIndent) => {
  let left = iLeft;
  let indent = iIndent;
  const [elem, ...rest] = node;

  const props = (
    typeof rest[0] === 'object' && !Array.isArray(rest[0])
  ) ? rest.shift() : {};

  const style = options.getStyle(baseStyle, elem, props);

  if (nodeIsBlock(elem)) { forme.push([]); }

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
    case 'img_ref': {
      const image = options.images[props.ref];
      if (image === undefined) break;

      const { texture, alignment = 1 } = image;
      forme[forme.length - 1].push([
        imageType,
        texture,
        indent,
        texture.width,
        style,
        {
          ascent: texture.height * alignment,
          descent: texture.height * (1 - alignment),
          fontSize: texture.height,
        },
      ]);
      indent += texture.width;
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
        [spacerType, undefined, 0, 0, style, { ascent: 7, descent: 0, fontSize: 7 }],
      ]);
    }
  }

  return [left, indent];
};

export const typesetMarkdown = (node, style, options, forme = []) => {
  typesetNode(node, style, options, forme, 0, 0);
  // Remove trailing space if its there
  if (forme[forme.length - 1][0][0] === spacerType) { forme.pop(); }
  return forme;
};
