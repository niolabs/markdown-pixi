import {
  Container,
  SCALE_MODES,
  Text,
  TextMetrics,
  Texture,
} from 'pixi.js'; // eslint-disable-line import/extensions


import { markdown } from 'markdown';

// Adapted from TextMetrics#wrap
// eslint-disable-next-line no-underscore-dangle
function wrap(iText, style, canvas = TextMetrics._canvas) {
  let text = iText;
  const context = canvas.getContext('2d');

  const font = style.toFontString();
  const fontProperties = TextMetrics.measureFont(font);
  context.font = font;

  const lineHeight = style.lineHeight || fontProperties.fontSize + style.strokeThickness;

  const spaceWidth = context.measureText(' ').width + style.letterSpacing;

  return {
    next(indent = 0, allowLonger = true) {
      const wordWrapWidth = Math.max(0, style.wordWrapWidth - indent);

      // Greedy wrapping algorithm that will wrap words as the line grows longer
      // than its horizontal bounds.
      let result = '';

      let spaceLeft = wordWrapWidth;
      const words = text.split('\n', 1)[0].split(' ');

      for (let j = 0; j < words.length; j += 1) {
        const wordWidth = context.measureText(words[j]).width
          + ((words[j].length - 1) * style.letterSpacing);
        const wordWidthWithSpace = wordWidth + spaceWidth;

        if (j === 0 && wordWidthWithSpace > spaceLeft && !allowLonger) {
          // Don't allow indented first-words to overflow.
          return ['', 0, spaceLeft, lineHeight, fontProperties, false];
        } else if (j === 0 || wordWidthWithSpace > spaceLeft) {
          // Skip printing the newline if it's the first word of the line that is
          // greater than the word wrap width.
          if (j > 0) {
            break;
          }

          result += words[j];
          spaceLeft = wordWrapWidth - wordWidth;
        } else {
          spaceLeft -= wordWidthWithSpace;
          result += ` ${words[j]}`;
        }
      }

      text = text.substr(result.length + 1);

      return [
        result,
        context.measureText(result).width + ((result.length - 1) * style.letterSpacing),
        spaceLeft,
        lineHeight,
        fontProperties,
        text.length === 0,
      ];
    },
  };
}

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

const typesetMarkdown = (node, style, options, forme = []) => {
  typesetNode(node, style, options, forme, 0, 0);
  return forme;
};

const { max } = Math;

const press = (forme) => {
  const target = new Container();
  let top = 0;
  forme.forEach((line) => {
    const lh = line.reduce((val, [, , , { ascent, descent }]) => max(val, ascent + descent), 0);
    const baseline = line.reduce((val, [, , , { ascent }]) => max(val, ascent), 0);
    const mLeading = line.reduce((val, [, , { leading = 0 }]) => max(val, leading), 0);
    line.forEach(([text, left, style, metrics]) => {
      if (text) {
        const txt = new Text(text, style);
        txt.y = Math.round(top + (baseline - metrics.ascent));
        txt.x = Math.round(left);
        target.addChild(txt);
      }
    });
    top += lh + mLeading;
  });
  return [target, top];
};

export function renderMarkdownToTexture(md, style, options = {}) {
  const {
    renderer = (() => { throw new Error('renderer is required'); })(),
    getStyle = s => s,
    resolution = renderer.resolution,
    scaleMode = SCALE_MODES.LINEAR,
  } = options;

  const jsonml = markdown.parse(md);
  const forme = typesetMarkdown(jsonml, style, { getStyle });
  const [target, height] = press(forme);

  return (height === 0) ? Texture.EMPTY
    : renderer.generateTexture(target, scaleMode, resolution);
}

export const createMarkdownProvider = renderer => (md, style, options = {}) => (
  renderMarkdownToTexture(md, style, Object.assign({ renderer }, options))
);
