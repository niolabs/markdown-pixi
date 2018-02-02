function wrap(text, style, canvas = PIXI.TextMetrics._canvas) {
  const context = canvas.getContext('2d');

  const font = style.toFontString();
  const fontProperties = PIXI.TextMetrics.measureFont(font);
  context.font = font;

  const lineHeight = style.lineHeight || fontProperties.fontSize + style.strokeThickness;

  const spaceWidth = context.measureText(' ').width
    + style.letterSpacing;

  return {
    next(indent = 0, allowLonger = true) {
      const wordWrapWidth = Math.max(0, style.wordWrapWidth - indent);

      // Greedy wrapping algorithm that will wrap words as the line grows longer
      // than its horizontal bounds.
      let result = '';
      const firstChar = text.charAt(0);
      const firstLine = text.split('\n', 1)[0];

      let spaceLeft = wordWrapWidth;
      const words = firstLine.split(' ');

      for (let j = 0; j < words.length; j++) {
        const wordWidth = context.measureText(words[j]).width
          + ((words[j].length - 1) * style.letterSpacing);
        const wordWidthWithSpace = wordWidth + spaceWidth;

        if (j === 0 && wordWidthWithSpace > spaceLeft && !allowLonger) {
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

console.clear()
const app = new PIXI.Application({
  width: 300,
  height: 1500,
  backgroundColor: 0xffffff,
  antialias: true,
  view: document.getElementById("stage"),
  resolution: 1,
  powerPrefernce: "low-performance",
});

document.getElementById("stage").style.width = `${300}px`;

const content = `
# This is a test
this **is a really long bolded \`part\` that should wrap at some** point then switch back

do paragraphs still work?

okay *i think* i may have gotten it and wrapping in the right spot
`

const getStyle = (baseStyle, elem, props) => {
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
      style.fontSize = '14px'
      return style;
    }
  }
  return baseStyle;
}

const nodeIsBlock = elem => (
  elem === "para" ||
  elem === "header" ||
  elem === "hr" ||
  elem === "blockquote" ||
  elem === "code_block"
);
const nodeIsInline = elem => !nodeIsBlock(elem)

const renderText = (text, target, style, top, left, indent = 0) => {
  console.log("rendering: '%s'", text, indent)
  const lines = wrap(text, style);
  let lineNum = 0;
  let abort = 100000;
  while (true && ((--abort) >= 0)) {
    const [line, width, remaining, lineHeight, _, end] = lines.next(lineNum === 0 ? indent : undefined, lineNum !== 0 && indent === 0);
    if (line.length) {
      const txt = new PIXI.Text(line, style);
      txt.y = top;
      txt.x = lineNum === 0 ? indent : left;
      target.addChild(txt);
    }
    if (end) {
      return [top, (lineNum === 0 ? indent : 0) + Math.round(width)]
    }
    top += lineHeight
    lineNum++;
  }
  throw new Error('possible infinite loop')

}

const renderNode = (node, target, baseStyle, iTop = 0, iLeft = 0, indent =0 ) => {
  let top = iTop, left = iLeft;
  const [elem, ...rest] = node;

  const props = (
    typeof rest[0] === "object" && !Array.isArray(rest[0])
  ) ? rest.shift() : {};

  const style = getStyle(baseStyle, elem, props);

  for (let i = 0; i < rest.length; i++) {
    const child = rest[i];
    const render = Array.isArray(child) ? renderNode : renderText
    const [nTop, nIndent] = render(child, target, style, top, left, indent)
    top = nTop
    indent = nIndent
  }

  if (nodeIsBlock(elem)) {
    top += 14 + 10;
    indent = 0;
    left = iLeft;
  }

  return [top, indent];
};

const renderMarkdown = (md, style, renderer) => {
  const target = new PIXI.Container();
  const jsonml = markdown.parse(md)
  console.log(JSON.stringify(jsonml, null, 2))
  const [height] = renderNode(jsonml, target, style, 0);
  if (height === 0) { return PIXI.Texture.EMPTY; }
  const texture = PIXI.RenderTexture.create(
    style.wordWrapWidth, height,
    PIXI.settings.SCALE_MODE.LINEAR,
    renderer.resolution
  );
  renderer.render(target, texture);
  return texture;
};

const style = new PIXI.TextStyle({
  fontFamily: "Lato",
  fontWeight: '200',
  fontSize: '13px',
  wordWrapWidth: 200,
  leading: 0,
  fill: 0x333333,
});

const texture = renderMarkdown(content, style, app.renderer)
const sprite = new PIXI.Sprite(texture);
const gfx = new PIXI.Graphics();
gfx.lineStyle(1, 0, 1)
gfx.moveTo(200, 0);
gfx.lineTo(200, 1000);

app.stage.addChild(gfx);
app.stage.addChild(sprite)

app.stop()
app.render()
