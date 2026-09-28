// Launch options for the headless browser the tools drive.
//
// Uses $CHROMIUM if set, then the Chromium that Playwright installs in
// Claude's sandbox, and otherwise the Google Chrome installed on this machine.
// With gpu, the browser runs in a visible window so it gets the real GPU;
// without it, WebGL runs on the CPU through SwiftShader.

import { existsSync } from 'node:fs';

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export function launchOptions({ gpu = false } = {}) {
  const exe = process.env.CHROMIUM || (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : null);
  return {
    ...(exe ? { executablePath: exe } : { channel: 'chrome' }),
    headless: !gpu,
    args: gpu
      ? ['--ignore-gpu-blocklist', '--enable-gpu']
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  };
}
