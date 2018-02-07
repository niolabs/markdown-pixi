import {
  SCALE_MODES,
  Texture,
} from 'pixi.js'; // eslint-disable-line import/extensions

import { markdown } from 'markdown';
import { typesetMarkdown } from './typesetting';
import { press } from './press';

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
