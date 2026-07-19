import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sideNote = path.join(root, 'SideNote');
const vendorDirectory = path.join(sideNote, 'vendor');

if (!fs.existsSync(path.join(sideNote, 'package.json'))) {
  throw new Error(`SideNote repository was not found at ${sideNote}`);
}

fs.mkdirSync(vendorDirectory, { recursive: true });
fs.copyFileSync(
  path.join(root, 'dist', 'wysiwyg-markdown.js'),
  path.join(vendorDirectory, 'wysiwyg-markdown.js'),
);
fs.copyFileSync(
  path.join(root, 'THIRD_PARTY_LICENSES.md'),
  path.join(sideNote, 'WYSIWYG_MARKDOWN_LICENSES.md'),
);

console.log('Synced the editor bundle and third-party licenses to SideNote.');
