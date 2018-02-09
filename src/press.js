import {
  Container,
  Text,
  Sprite,
} from 'pixi.js'; // eslint-disable-line import/extensions

import { textType, imageType } from './typesetting-types';

const { max } = Math;

const getLineHeight = (val, [, , , , , { ascent, descent }]) => max(val, ascent + descent);
const getBaseline = (val, [, , , , , { ascent }]) => max(val, ascent);
const getLeading = (val, [, , , , { leading = 0 }]) => max(val, leading);
const getLineWidth = (val, [, , , width]) => val + width;

function createDisplayObject([type, content, , , style]) {
  switch (type) {
    case textType: return new Text(content, style);
    case imageType: return new Sprite(content);
    default: return undefined;
  }
}

export const press = (forme) => {
  const target = new Container();
  let top = 0;
  forme.forEach((line) => {
    const lh = line.reduce(getLineHeight, 0);
    const baseline = line.reduce(getBaseline, 0);
    const mLeading = line.reduce(getLeading, 0);
    const lineWidth = line.reduce(getLineWidth, 0);

    line.forEach((chunk) => {
      const dispObj = createDisplayObject(chunk);
      const [, , left, , style, { ascent }] = chunk;

      if (!dispObj) return;

      dispObj.y = Math.round(top + (baseline - ascent));
      switch (style.align) {
        case 'right': {
          dispObj.x = Math.round((style.wordWrapWidth - lineWidth) + left);
          break;
        }
        case 'center': {
          dispObj.x = Math.round(((style.wordWrapWidth - lineWidth) / 2) + left);
          break;
        }
        case 'left':
        default: {
          dispObj.x = Math.round(left);
        }
      }

      target.addChild(dispObj);
    });
    top += lh + mLeading;
  });
  return [target, top];
};
