function wrap(text, style, canvas = PIXI.TextMetrics._canvas) {
  const context = canvas.getContext('2d');

  const font = style.toFontString();
  const fontProperties = PIXI.TextMetrics.measureFont(font);
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

      text = text.substr(result.length + 1)

      return [
        result,
        context.measureText(result).width + ((result.length - 1) * style.letterSpacing),
        spaceLeft,
        lineHeight,
        fontProperties,
        text.length === 0,
      ];
    }
  }
}

const nodeIsBlock = elem => (
  elem === "para" ||
  elem === "header" ||
  elem === "hr" ||
  elem === "blockquote" ||
  elem === "code_block" ||
  elem === 'listitem'
);

const nodeIsInline = elem => !nodeIsBlock(elem)

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
      formeLine.push([line, tLeft, style, metrics])
    }

    if (end) {
      return [forme, left, (lineNum === 0 ? indent : left) + Math.round(width)]
    }

    lineNum++;
  }

  throw new Error('possible infinite loop... too many lines iterated')
}

const typesetText = (text, style, options, forme, left, indent) => (
  typesetTextPlain(text.replace(/(?:\n|\r|\r\n| {2,})/g, ' '), style, options, forme, left, indent)
);

const typesetNode = (node, baseStyle, options, forme = [], iLeft, indent) => {
  let left = iLeft;
  const [elem, ...rest] = node;

  const props = (
    typeof rest[0] === "object" && !Array.isArray(rest[0])
  ) ? rest.shift() : {};

  const style = options.getStyle(baseStyle, elem, props);

  switch (elem) {
    case "blockquote": {
      left += 20;
      indent += 20;
      break;
    }
    case "code_block": {
      left += 10;
      indent += 10;
      break;
    }
    case "listitem": {
      left += 20;
      indent += 20;
      break;
    }
  }

  rest.forEach((child) => {
    const typeset = Array.isArray(child) ? typesetNode
      : elem === 'code_block' ? typesetTextPlain
      : elem === 'inlinecode' ? typesetTextPlain
      : typesetText
    const [_, nLeft, nIndent] = typeset(child, style, options, forme, left, indent)
    left = nLeft
    indent = nIndent
  });

  if (nodeIsBlock(elem)) {
    indent = iLeft;
    left = iLeft;
    if (forme.length > 0 && forme[forme.length - 1][0][0] !== undefined) {
      forme.push([
        [undefined, 0, style, { ascent: 7, descent: 0, fontSize: 7 }]
      ]);
    }
  }

  return [forme, left, indent];
};

const typesetMarkdown = (node, style, options, forme = []) => {
  typesetNode(node, style, options, forme, 0, 0);
  return [forme];
}

const press = (forme) => {
  const target = new PIXI.Container();
  let top = 0;
  forme.forEach((line) => {
    const lh = line.reduce((max, [_a, _b, _c, { ascent, descent }]) => Math.max(max, ascent + descent), 0);
    const baseline = line.reduce((max, [_a, _b, _c, { ascent }]) => Math.max(max, ascent), 0);
    const leading = line.reduce((max, [_a, _b, { leading = 0 }]) => Math.max(max, leading), 0);
    line.forEach(([text, left, style, metrics]) => {
      if (text) {
        const txt = new PIXI.Text(text, style);
        txt.y = Math.round(top + (baseline - metrics.ascent));
        txt.x = Math.round(left);
        target.addChild(txt);
      }
    });
    top += lh + leading;
  })
  return [target, top];
}

const renderMarkdown = (md, style, options = {}) => {
  const {
    renderer = (() => { throw new Error('renderer is required') })(),
    getStyle = style => style,
  } = options;

  const jsonml = markdown.parse(md)
  console.log(jsonml)
  const [forme] = typesetMarkdown(jsonml, style, { getStyle });
  const [target, height] = press(forme);
  if (height === 0) { return PIXI.Texture.EMPTY; }
  const texture = PIXI.RenderTexture.create(
    style.wordWrapWidth, height,
    PIXI.settings.SCALE_MODE.LINEAR,
    renderer.resolution
  );
  renderer.render(target, texture);
  return texture;
};

// -------------------

console.clear()
const app = new PIXI.Application({
  width: 450,
  height: 1500,
  backgroundColor: 0xffffff,
  antialias: true,
  view: document.getElementById("stage"),
  resolution: 2,
  powerPrefernce: "low-performance",
});

document.getElementById("stage").style.width = `${450}px`;

const content = `
An h1 header
============

Paragraphs are                        separated by a blank line.

2nd paragraph. *Italic*, **bold**, and \`monospace\`. Itemized lists
look like:

  * this one
  * that one
  * the other one

Note that --- not considering the asterisk --- the actual text
content starts at 4-columns in.

> Block quotes are
> written like so.
>
> They can span multiple paragraphs,
> if you like.

Use 3 dashes for an em-dash. Use 2 dashes for ranges (ex., "it's all
in chapters 12--14"). Three dots ... will be converted to an ellipsis.
Unicode is supported. ☺



An h2 header
------------

Here's a numbered list:

 1. first item
 2. second item
 3. third item

Note again how the actual text starts at 4 columns in (4 characters
from the left side). Here's a code sample:

    # Let me re-iterate ...
    for i in 1 .. 10 { do-something(i) }
`


const style = new PIXI.TextStyle({
  fontFamily: "Lato",
  fontWeight: '200',
  fontSize: '13px',
  wordWrapWidth: 420,
  leading: 5,
  fill: 0x333333,
});

const texture = renderMarkdown(content, style, {
  renderer: app.renderer,
  getStyle: (baseStyle, elem, props) => {
    switch(elem) {
      case "em": {
        const style = baseStyle.clone();
        style.fontStyle = "italic"
        return style;
      }
      case "strong": {
        const style = baseStyle.clone();
        style.fontWeight = "bold"
        return style;
      }
      case "header": {
        const style = baseStyle.clone();
        style.fontWeight = "bold";
        style.fontSize = [undefined, '32px', '24px', '18px', '14px', '12px', '10px'][props.level] || style.fontSize;
        return style;
      }
      case "code_block":
      case "inlinecode": {
        const style = baseStyle.clone();
        style.fontFamily = "Fira Mono"
        return style;
      }
    }
    return baseStyle;
  }
});

const sprite = new PIXI.Sprite(texture);
const gfx = new PIXI.Graphics();
gfx.lineStyle(1, 0, 1)
gfx.moveTo(420, 0);
gfx.lineTo(420, 1000);

app.stage.addChild(gfx);
app.stage.addChild(sprite)

app.stop()
app.render()
