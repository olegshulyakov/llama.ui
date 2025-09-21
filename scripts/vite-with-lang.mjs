#!/usr/bin/env node
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

const supportedCommands = new Set(['build', 'dev', 'preview']);

const command =
  args.length > 0 && supportedCommands.has(args[0]) ? args.shift() : 'dev';

let resolvedLanguage;
const forwardedArgs = [];

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];

  if (!argument) {
    continue;
  }

  if (argument === '--lang') {
    resolvedLanguage = args[index + 1];
    index += 1;
    continue;
  }

  if (argument.startsWith('--lang=')) {
    resolvedLanguage = argument.split('=')[1];
    continue;
  }

  forwardedArgs.push(argument);
}

if (typeof resolvedLanguage === 'string' && resolvedLanguage.length > 0) {
  process.env.VITE_APP_LANG = resolvedLanguage;
}

const child = spawn('vite', [command, ...forwardedArgs], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_APP_LANG: process.env.VITE_APP_LANG,
  },
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
