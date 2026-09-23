#!/usr/bin/env node
/**
 * Generates the two derived copies of the privacy policy from the single
 * source of truth, privacy_policy.txt:
 *
 *   src/lib/privacy-policy.ts  — rendered inside the app (works offline)
 *   docs/index.html            — the public page for the Play Console field
 *
 * Run after editing privacy_policy.txt:   npm run policy
 * Pass --check to fail instead of writing when the copies are out of date.
 *
 * Source format: a title line, "Effective Date:" / "Last Updated:" lines,
 * sections headed "N. Title", paragraphs separated by blank lines, and "- "
 * bullets whose continuation lines are indented.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'privacy_policy.txt'), 'utf8');

function parse(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const doc = { title: '', meta: [], sections: [] };
  let section = null;
  let block = null; // { kind: 'p' | 'ul', items: string[] }

  const flush = () => {
    if (block && section) section.blocks.push(block);
    block = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!doc.title && line) {
      doc.title = line;
      continue;
    }
    if (/^(Effective Date|Last Updated):/.test(line)) {
      doc.meta.push(line);
      continue;
    }
    if (/^\d+\.\s+\S/.test(line)) {
      flush();
      section = { heading: line, blocks: [] };
      doc.sections.push(section);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^- /.test(line)) {
      if (!block || block.kind !== 'ul') {
        flush();
        block = { kind: 'ul', items: [] };
      }
      block.items.push(line.slice(2).trim());
      continue;
    }
    if (/^\s+\S/.test(line) && block && block.kind === 'ul') {
      block.items[block.items.length - 1] += ' ' + line.trim();
      continue;
    }
    if (!block || block.kind !== 'p') {
      flush();
      block = { kind: 'p', items: [''] };
    }
    block.items[0] = (block.items[0] + ' ' + line.trim()).trim();
  }
  flush();
  return doc;
}

const doc = parse(source);
if (!doc.sections.length) throw new Error('privacy_policy.txt: no sections found');
const contact = doc.sections.find((s) => /contact/i.test(s.heading));
const body = doc.sections.filter((s) => s !== contact);

// ---------------------------------------------------------------- app copy
const asText = (s) =>
  s.blocks
    .map((b) => (b.kind === 'ul' ? b.items.map((i) => '• ' + i).join('\n') : b.items[0]))
    .join('\n\n');

const ts = `/**
 * GENERATED from privacy_policy.txt by scripts/build-privacy-policy.js.
 * Do not edit by hand — edit privacy_policy.txt and run \`npm run policy\`.
 *
 * Google Play requires the policy to be linked or included within the app, so
 * the full text ships here and renders with no network.
 */

export const PRIVACY_POLICY_EFFECTIVE = ${JSON.stringify(doc.meta.join(' · '))};

export const PRIVACY_POLICY_CONTACT = ${JSON.stringify(contact ? asText(contact) : '')};

export const PRIVACY_POLICY_SECTIONS: { heading: string; body: string }[] = ${JSON.stringify(
  body.map((s) => ({ heading: s.heading, body: asText(s) })),
  null,
  2
)};
`;

// ---------------------------------------------------------------- web copy
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s) =>
  esc(s)
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1">$1</a>')
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ShieldVPN Privacy Policy</title>
<!-- GENERATED from privacy_policy.txt by scripts/build-privacy-policy.js. Do not edit by hand. -->
<style>
  :root { color-scheme: light dark; }
  body { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 5rem;
         font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         color: #1f2937; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #e5e7eb; background: #111; } a { color: #93c5fd; } }
  h1 { font-size: 1.85rem; margin-bottom: .25rem; }
  h2 { font-size: 1.1rem; margin-top: 2.25rem; }
  .meta { color: #6b7280; margin: .15rem 0; font-size: .92rem; }
  ul { padding-left: 1.2rem; }
  li { margin: .35rem 0; }
</style>
</head>
<body>
<h1>${esc(doc.title)}</h1>
${doc.meta.map((m) => `<p class="meta">${esc(m)}</p>`).join('\n')}
${doc.sections
  .map(
    (s) =>
      `<h2>${esc(s.heading)}</h2>\n` +
      s.blocks
        .map((b) =>
          b.kind === 'ul'
            ? '<ul>\n' + b.items.map((i) => `  <li>${linkify(i)}</li>`).join('\n') + '\n</ul>'
            : `<p>${linkify(b.items[0])}</p>`
        )
        .join('\n')
  )
  .join('\n')}
</body>
</html>
`;

const outputs = [
  [path.join(root, 'src/lib/privacy-policy.ts'), ts],
  [path.join(root, 'docs/index.html'), html],
];

if (process.argv.includes('--check')) {
  const stale = outputs.filter(([f, c]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== c);
  if (stale.length) {
    console.error('Out of date: ' + stale.map(([f]) => path.relative(root, f)).join(', '));
    console.error('Run: npm run policy');
    process.exit(1);
  }
  console.log('Privacy policy copies are in sync.');
} else {
  for (const [f, c] of outputs) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, c);
    console.log('wrote', path.relative(root, f));
  }
}
