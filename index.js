import core from '@actions/core';

try {
  const operation = core.getInput('operation');
  console.log(`Operation: ${operation}`);

  core.setOutput("folderId", time);
} catch (error) {
  core.setFailed(error.message);
}
