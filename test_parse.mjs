import { parseFountainToElements, renderEK1Html } from './public/screenplay-formatter.js';
import fs from 'fs';

const txt = fs.readFileSync('01_story/source/screenplay.fountain', 'utf8');
try {
  const els = parseFountainToElements(txt);
  renderEK1Html(els);
  console.log('Rendered successfully');
} catch (e) {
  console.error('Error rendering:', e);
}
