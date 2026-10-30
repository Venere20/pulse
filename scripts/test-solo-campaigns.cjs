const { spawnSync } = require('node:child_process');
for (const file of ['test-solo-games', 'test-stars', 'test-hearts', 'test-sequence', 'test-secret-word', 'test-word-search', 'test-sliding', 'test-clouds', 'test-new-solo-screens']) {
  const result = spawnSync(process.execPath, ['scripts/' + file + '.cjs'], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
