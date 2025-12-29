const currentVersion = process.versions.node;
const requiredVersion = '24.0.0';

function compareVersions(current, required) {
  const currentParts = current.split('.').map(Number);
  const requiredParts = required.split('.').map(Number);

  for (let i = 0; i < requiredParts.length; i++) {
    if (currentParts[i] > requiredParts[i]) return 1;
    if (currentParts[i] < requiredParts[i]) return -1;
  }
  return 0;
}

if (compareVersions(currentVersion, requiredVersion) < 0) {
  console.error(`\x1b[31m✖ Node version ${currentVersion} is not supported.\x1b[0m`);
  console.error(`\x1b[33m! This project requires Node.js version ${requiredVersion} or higher.\x1b[0m`);
  console.error(`\x1b[36mℹ Please upgrade your Node.js version.\x1b[0m\n`);
  process.exit(1);
}

console.log(`\x1b[32m✓ Node version ${currentVersion} is compatible.\x1b[0m`);
