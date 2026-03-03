#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const CONFIG_PATH = process.env.AZURE_IMAGE_CONFIG
  || path.join(os.homedir(), 'keys', 'openai.azure.com', 'gpt-image-1.5.json');
const OUTPUT_DIR = path.resolve('assets/images/themes');

const REQUEST_DEFAULTS = {
  size: '1024x1024',
  quality: 'high',
  output_format: 'png',
  background: 'transparent',
  n: 1
};
const execFileAsync = promisify(execFile);

const JOBS = [
  {
    file: 'item-key-default.png',
    prompt: [
      '2D game item icon of a vintage brass key.',
      'Warm painterly style, gentle highlights, slightly worn metal details.',
      'Centered single object, no hands, no text, no frame.',
      'Fully transparent background (alpha).'
    ].join(' ')
  },
  {
    file: 'item-compass-default.png',
    prompt: [
      '2D game item icon of a classic brass compass with a cream dial and red needle.',
      'Warm painterly style matching a cozy storybook adventure UI.',
      'Centered single object, no text, no frame.',
      'Fully transparent background (alpha).'
    ].join(' ')
  },
  {
    file: 'item-key-sci-fi.png',
    prompt: [
      '2D game item icon of a futuristic access key.',
      'Cyan neon circuitry, sleek titanium body, holographic accents.',
      'Clean silhouette for mobile UI, centered single object, no text, no frame.',
      'Fully transparent background (alpha).'
    ].join(' ')
  },
  {
    file: 'item-compass-sci-fi.png',
    prompt: [
      '2D game item icon of a sci-fi star navigator compass.',
      'Luminous cyan ring, digital ticks, sleek metallic housing.',
      'Centered single object, no text, no frame.',
      'Fully transparent background (alpha).'
    ].join(' ')
  },
  {
    file: 'item-key-fantasy.png',
    prompt: [
      '2D game item icon of an ornate fantasy key.',
      'Ancient bronze and iron, engraved runes, subtle emerald gem accent.',
      'Storybook fantasy style, centered single object, no text, no frame.',
      'Fully transparent background (alpha).'
    ].join(' ')
  },
  {
    file: 'item-compass-fantasy.png',
    prompt: [
      '2D game item icon of an arcane fantasy compass.',
      'Bronze and obsidian details, glowing rune marks, mystical glow within the object.',
      'Storybook fantasy style, centered single object, no text, no frame.',
      'Fully transparent background (alpha).'
    ].join(' ')
  }
];

async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const config = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!config?.endpoint || !config?.key) {
    throw new Error(`Invalid config format in ${CONFIG_PATH}`);
  }

  return config;
}

async function requestImage(config, prompt) {
  const headers = {
    'Content-Type': 'application/json',
    'api-key': config.key
  };

  const body = { ...REQUEST_DEFAULTS, prompt };
  let response = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  let text = await response.text();

  if (!response.ok && /background/i.test(text)) {
    const fallbackBody = { ...body };
    delete fallbackBody.background;
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(fallbackBody)
    });
    text = await response.text();
  }

  if (!response.ok) {
    throw new Error(`Image generation failed (${response.status}): ${text.slice(0, 600)}`);
  }

  const parsed = JSON.parse(text);
  const b64 = parsed?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`Missing image data in response: ${text.slice(0, 600)}`);
  }

  return Buffer.from(b64, 'base64');
}

async function main() {
  const config = await loadConfig();
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (let i = 0; i < JOBS.length; i += 1) {
    const job = JOBS[i];
    const target = path.join(OUTPUT_DIR, job.file);
    process.stdout.write(`[${i + 1}/${JOBS.length}] generating ${job.file}...\n`);
    const image = await requestImage(config, job.prompt);
    await writeFile(target, image);
    await optimizePng(target);
  }

  process.stdout.write(`Done. Generated ${JOBS.length} assets in ${OUTPUT_DIR}\n`);
}

async function optimizePng(target) {
  const tempTarget = `${target}.tmp.png`;

  try {
    await execFileAsync('magick', [
      target,
      '-resize', '512x512',
      '-strip',
      '-define', 'png:compression-level=9',
      '-define', 'png:compression-filter=5',
      tempTarget
    ]);
    await rename(tempTarget, target);
  } catch {
    // Keep original file if ImageMagick is not available.
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
