import core from '@actions/core';

try {
  const operation = core.getInput('operation');
  console.log(`Operation: ${operation}`);

  core.setOutput("folderId", '1234567890');
} catch (error) {
  core.setFailed(error.message);
}
