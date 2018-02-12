const markdown = require('markdown').markdown;
const TextStyle = require('pixi.js').TextStyle;
const { typesetMarkdown } = require('../dist/index');

describe('typesetter()', () => {
  it('should handle plain text', () => {
    const baseStyle = new TextStyle({
      wordWrapWidth: 500,
    });

    const md = `this is some plaintext`

    const jsonml = markdown.parse(md);
    const result = typesetMarkdown(jsonml, baseStyle, {
      getStyle: s => s,
      images: {},
      collapseWhitespace: true,
      smartypants: true,
      decodeEntities: true,
    });

    expect(result.length).to.equal(2);
    const [ text, spacer ] = result;

    // Text
    {
      expect(text.length).to.equal(1);
      const [[type, content, left, width, style, metrics]] = text;
      expect(type.toString()).to.equal('Symbol(typesetting.text)');
      expect(content).to.equal('this is some plaintext');
      expect(style).to.equal(baseStyle);
    }


    // Spacer
    {
      expect(spacer.length).to.equal(1);
      const [[type, content, left, width, style, metrics]] = spacer;
      expect(type.toString()).to.equal('Symbol(typesetting.spacer)');
      expect(content).to.equal(undefined);
      expect(style).to.equal(baseStyle);
      expect(metrics).to.deep.equal({ ascent: 7, descent: 0, fontSize: 7 });
    }
  });

  it('should wrap plain text', () => {
    const baseStyle = new TextStyle({
      wordWrapWidth: 200,
    });

    const md = `this is some plaintext`

    const jsonml = markdown.parse(md);
    const result = typesetMarkdown(jsonml, baseStyle, {
      getStyle: s => s,
      images: {},
      collapseWhitespace: true,
      smartypants: true,
      decodeEntities: true,
    });

    expect(result.length).to.equal(3);
    const [ line1, line2, spacer ] = result;

    // Text
    {
      expect(line1.length).to.equal(1);
      const [[type, content, left, width, style, metrics]] = line1;
      expect(type.toString()).to.equal('Symbol(typesetting.text)');
      expect(content).to.equal('this is some');
      expect(style).to.equal(baseStyle);
    }

    // Text
    {
      expect(line2.length).to.equal(1);
      const [[type, content, left, width, style, metrics]] = line2;
      expect(type.toString()).to.equal('Symbol(typesetting.text)');
      expect(content).to.equal('plaintext');
      expect(style).to.equal(baseStyle);
    }

    // Spacer
    {
      expect(spacer.length).to.equal(1);
      const [[type, content, left, width, style, metrics]] = spacer;
      expect(type.toString()).to.equal('Symbol(typesetting.spacer)');
      expect(content).to.equal(undefined);
      expect(style).to.equal(baseStyle);
      expect(metrics).to.deep.equal({ ascent: 7, descent: 0, fontSize: 7 });
    }
  });
});
