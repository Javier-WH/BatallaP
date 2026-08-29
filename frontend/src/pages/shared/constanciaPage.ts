import type { CSSProperties } from 'react';

// Letter page geometry shared by the editor canvas and the preview sheet.
export const CONSTANCIA_PAGE_STYLE: CSSProperties = {
  fontFamily: "'Times New Roman', serif",
  fontSize: '12pt',
  lineHeight: 1.5,
  width: '8.5in',
  height: '11in',
  minHeight: '11in',
  padding: '1in',
  margin: '0 auto',
  background: 'white',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  boxSizing: 'border-box',
};

// Styles the preview and the print window need, since neither inherits the app stylesheet
// the same way the editor canvas does.
export const CONSTANCIA_PAGE_CSS = `
  .constancia-layer { position: absolute; inset: 0; pointer-events: none; }
  .constancia-layer-behind { z-index: 0; }
  .constancia-layer-front { z-index: 30; }
  .constancia-preview { position: relative; z-index: 10; }
  .constancia-preview p, .constancia-preview h1, .constancia-preview h2, .constancia-preview h3 { margin: 0; }
  .constancia-preview ul, .constancia-preview ol { margin: 0; padding-left: 2em; }
`;

/**
 * Turns the rendered template HTML into the inner markup of a constancia sheet.
 *
 * Floating images are moved into dedicated layers so their coordinates resolve against the
 * page box exactly like they do in the editor, instead of against their parent paragraph.
 */
export function buildConstanciaPageHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  // Drop the trailing empty block Tiptap keeps at the end of the document.
  const paragraphs = Array.from(body.querySelectorAll('p'));
  while (paragraphs.length > 0 && paragraphs[paragraphs.length - 1].innerHTML.trim() === '') {
    paragraphs.pop()?.remove();
  }

  // Reproduce the line breaks the editor renders so vertical rhythm matches.
  body.querySelectorAll('p').forEach((paragraph) => {
    if (paragraph.innerHTML.trim() === '') {
      paragraph.appendChild(doc.createElement('br'));
      return;
    }
    const lastElement = paragraph.lastElementChild;
    const lastChildOfSpan = lastElement?.tagName === 'SPAN' ? lastElement.lastElementChild : null;
    if (lastChildOfSpan?.tagName === 'BR') paragraph.appendChild(doc.createElement('br'));
  });

  const behind = doc.createElement('div');
  behind.className = 'constancia-layer constancia-layer-behind';
  const front = doc.createElement('div');
  front.className = 'constancia-layer constancia-layer-front';

  body.querySelectorAll<HTMLImageElement>('img[data-wrap]').forEach((image) => {
    const wrap = image.getAttribute('data-wrap');
    if (wrap === 'behind') behind.appendChild(image);
    else if (wrap === 'front') front.appendChild(image);
  });

  const content = doc.createElement('div');
  content.className = 'constancia-preview';
  while (body.firstChild) content.appendChild(body.firstChild);

  return `${behind.outerHTML}${content.outerHTML}${front.outerHTML}`;
}
