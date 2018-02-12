import {
  SCALE_MODES,
  Texture,
  TextStyle,
  RenderTexture,
} from 'pixi.js'; // eslint-disable-line import/extensions

import { markdown } from 'markdown';
import { typesetMarkdown } from './typesetting';
import { press } from './press';

export { typesetMarkdown, press };

export function renderMarkdownToTexture(md, style = new TextStyle(), options = {}) {
  const {
    renderer = (() => { throw new Error('renderer is required'); })(),
    getStyle = s => s,
    resolution = renderer.resolution,
    scaleMode = SCALE_MODES.LINEAR,
    images = {},

    // Typographical Options
    collapseWhitespace = true,
    smartypants = true,
    decodeEntities = true,
  } = options;

  const jsonml = markdown.parse(md);
  const forme = typesetMarkdown(jsonml, style, {
    getStyle,
    images,
    collapseWhitespace,
    smartypants,
    decodeEntities,
  });
  const [target, height] = press(forme);

  if (height === 0) { return Texture.EMPTY; }
  const texture = RenderTexture.create(
    style.wordWrapWidth,
    height,
    scaleMode,
    resolution,
  );
  renderer.render(target, texture);
  target.destroy({ children: true });
  return texture;
}

export const createMarkdownProvider = renderer => (md, style, options = {}) => (
  renderMarkdownToTexture(md, style, Object.assign({ renderer }, options))
);
