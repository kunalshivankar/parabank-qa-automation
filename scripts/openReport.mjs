import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve(process.argv[2] ?? 'reports/parabank-report.html');

if (!existsSync(reportPath)) {
  console.error(`Report not found: ${reportPath}\nRun a test command first, for example: npm run test:unit`);
  process.exit(1);
}

const commands = {
  win32: ['cmd', ['/c', 'start', '""', reportPath]],
  darwin: ['open', [reportPath]],
};
const [command, args] = commands[process.platform] ?? ['xdg-open', [reportPath]];

const child = spawn(command, args, { stdio: 'ignore', detached: true });
child.on('error', () => {
  console.log(`Could not open a browser automatically. Open this file manually:\n${reportPath}`);
});
child.unref();
console.log(`Opening ${reportPath}`);
