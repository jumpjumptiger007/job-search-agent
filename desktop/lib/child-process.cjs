function isChildExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

module.exports = { isChildExited };
