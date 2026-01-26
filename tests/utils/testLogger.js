/**
 * Test Instrumentation Logger
 * Provides logging and diagnostic utilities for testing
 */

class TestLogger {
  constructor() {
    this.logs = [];
    this.enabled = process.env.NODE_ENV === "test";
  }

  log(level, message, metadata = {}) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
    };

    this.logs.push(logEntry);

    if (process.env.VERBOSE_LOGGING === "true") {
      console.log(JSON.stringify(logEntry));
    }
  }

  info(message, metadata) {
    this.log("INFO", message, metadata);
  }

  error(message, metadata) {
    this.log("ERROR", message, metadata);
  }

  warn(message, metadata) {
    this.log("WARN", message, metadata);
  }

  debug(message, metadata) {
    this.log("DEBUG", message, metadata);
  }

  getLogs(filter = {}) {
    let filtered = this.logs;

    if (filter.level) {
      filtered = filtered.filter((log) => log.level === filter.level);
    }

    if (filter.message) {
      filtered = filtered.filter((log) => log.message.includes(filter.message));
    }

    return filtered;
  }

  clear() {
    this.logs = [];
  }

  getStats() {
    return {
      total: this.logs.length,
      byLevel: this.logs.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}

module.exports = new TestLogger();
