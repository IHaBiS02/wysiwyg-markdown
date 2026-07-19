import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(
  fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'),
);

const packages = new Map();
for (const [location, metadata] of Object.entries(lock.packages ?? {})) {
  if (!location.startsWith('node_modules/') || metadata.dev) continue;

  const packageDirectory = path.join(root, location);
  const packageJsonPath = path.join(packageDirectory, 'package.json');
  if (!fs.existsSync(packageJsonPath)) continue;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const key = `${packageJson.name}@${packageJson.version}`;
  if (packages.has(key)) continue;

  const licenseFile = fs
    .readdirSync(packageDirectory)
    .find((file) => /^licen[cs]e(?:\.|$)/i.test(file));
  const licenseText = licenseFile
    ? fs.readFileSync(path.join(packageDirectory, licenseFile), 'utf8').trim()
    : `No license file was included in the installed package. Declared license: ${packageJson.license ?? 'unknown'}`;

  const repository =
    typeof packageJson.repository === 'string'
      ? packageJson.repository
      : packageJson.repository?.url;

  packages.set(key, {
    name: packageJson.name,
    version: packageJson.version,
    license: packageJson.license ?? metadata.license ?? 'unknown',
    repository: repository?.replace(/^git\+/, '').replace(/\.git$/, ''),
    licenseText,
  });
}

const sections = [...packages.values()]
  .sort((left, right) => left.name.localeCompare(right.name))
  .map(
    (entry) => `## ${entry.name} ${entry.version}

- License: ${entry.license}
${entry.repository ? `- Source: ${entry.repository}\n` : ''}
\`\`\`text
${entry.licenseText}
\`\`\``,
  );

const output = `# Third-party licenses

This distribution bundles the runtime dependencies listed below. This file is
generated from the installed dependency tree by
\`scripts/generate-third-party-licenses.mjs\`.

${sections.join('\n\n')}
`;

fs.writeFileSync(path.join(root, 'THIRD_PARTY_LICENSES.md'), output, 'utf8');
console.log(`Wrote licenses for ${sections.length} runtime packages.`);
