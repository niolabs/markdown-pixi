import {
  Container,
  RenderTexture,
  SCALE_MODES,
  Text,
  TextMetrics,
  Texture,
} from 'pixi.js';

import { markdown } from 'markdown';

// Adapted from TextMetrics#wrap
function wrap(text, style, canvas = TextMetrics._canvas) {
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

      for (let j = 0; j < words.length; j++) {
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

const nodeIsInline = elem => !nodeIsBlock(elem);

const typesetTextPlain = (text, style, options, forme, left, indent) => {
  const lines = wrap(text, style);
  let lineNum = 0;
  let doNotGetStuckInInfiniteLoop = 100000;
  while ((--doNotGetStuckInInfiniteLoop) >= 0) {
    const sLeft = lineNum === 0 ? indent : left;
    const allowLonger = lineNum === 0 && indent === left;
    const [line, width, remaining, lineHeight, metrics, end] = lines.next(sLeft, allowLonger);

    if (line.length) {
      const appendPrevious = (lineNum === 0 && !(indent === left));
      const formeLine = (appendPrevious ? forme : (forme.push([]), forme))[forme.length - 1];
      const tLeft = lineNum === 0 ? indent : left;
      formeLine.push([line, tLeft, style, metrics]);
    }

    if (end) { return [left, (lineNum === 0 ? indent : left) + Math.round(width)]; }

    lineNum++;
  }

  throw new Error('possible infinite loop... too many lines iterated');
};

const typesetText = (text, style, options, forme, left, indent) => (
  typesetTextPlain(text.replace(/(?:\n|\r|\r\n| {2,})/g, ' '), style, options, forme, left, indent)
);

const typesetNode = (node, baseStyle, options, forme = [], iLeft, indent) => {
  let left = iLeft;
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

const press = (forme) => {
  const target = new Container();
  let top = 0;
  forme.forEach((line) => {
    const lh = line.reduce((max, [_a, _b, _c, { ascent, descent }]) => Math.max(max, ascent + descent), 0);
    const baseline = line.reduce((max, [_a, _b, _c, { ascent }]) => Math.max(max, ascent), 0);
    const leading = line.reduce((max, [_a, _b, { leading = 0 }]) => Math.max(max, leading), 0);
    line.forEach(([text, left, style, metrics]) => {
      if (text) {
        const txt = new Text(text, style);
        txt.y = Math.round(top + (baseline - metrics.ascent));
        txt.x = Math.round(left);
        target.addChild(txt);
      }
    });
    top += lh + leading;
  });
  return [target, top];
};

export function renderMarkdownToTexture(md, style, options = {}) {
  const {
    renderer = (() => { throw new Error('renderer is required'); })(),
    getStyle = style => style,
  } = options;

  const jsonml = markdown.parse(md);
  console.log(jsonml);
  const forme = typesetMarkdown(jsonml, style, { getStyle });
  const [target, height] = press(forme);
  if (height === 0) { return Texture.EMPTY; }
  const texture = RenderTexture.create(
    style.wordWrapWidth, height,
    SCALE_MODE.LINEAR,
    renderer.resolution,
  );
  renderer.render(target, texture);
  return texture;
}
