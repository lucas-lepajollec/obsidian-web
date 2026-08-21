import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';

const require = createRequire(import.meta.url);
const lan = process.argv.slice(2).includes('--lan');
const host = lan ? '0.0.0.0' : '127.0.0.1';
const nextBinary = require.resolve('next/dist/bin/next');
const lanAddresses = Object.entries(networkInterfaces())
  .flatMap(([name, entries]) => (entries ?? [])
    .filter(entry => entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'))
    .map(entry => ({ name, address: entry.address })));

if (lan) {
  console.log('[ShardNote] LAN development enabled on 0.0.0.0:2499');
  for (const { name, address } of lanAddresses) {
    console.log(`[ShardNote] ${name}: http://${address}:2499`);
  }
  console.log('[ShardNote] Use only on a trusted network. The phone must be on the same network and Windows Firewall must allow Node.js.');
} else {
  console.log('[ShardNote] Local development: http://127.0.0.1:2499');
}

const child = spawn(process.execPath, [nextBinary, 'dev', '-H', host, '-p', '2499'], {
  stdio: 'inherit',
  env: lan
    ? {
        ...process.env,
        SHARDNOTE_ALLOWED_DEV_ORIGINS: [
          'localhost',
          '127.0.0.1',
          ...lanAddresses.map(entry => entry.address),
        ].join(','),
      }
    : process.env,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', code => process.exit(code ?? 0));
