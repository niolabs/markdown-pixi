import {
  Container,
  Text,
} from 'pixi.js'; // eslint-disable-line import/extensions

const { max } = Math;

export const press = (forme) => {
  const target = new Container();
  let top = 0;
  forme.forEach((line) => {
    const lh = line.reduce((val, [, , , { ascent, descent }]) => max(val, ascent + descent), 0);
    const baseline = line.reduce((val, [, , , { ascent }]) => max(val, ascent), 0);
    const mLeading = line.reduce((val, [, , { leading = 0 }]) => max(val, leading), 0);
    line.forEach(([text, left, style, { ascent }]) => {
      if (text) {
        const txt = new Text(text, style);
        txt.y = Math.round(top + (baseline - ascent));
        txt.x = Math.round(left);
        target.addChild(txt);
      }
    });
    top += lh + mLeading;
  });
  return [target, top];
};