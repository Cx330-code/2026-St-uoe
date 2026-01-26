/**
 * Test Metrics Collector
 * Tracks and reports test execution metrics
 */

class MetricsCollector {
  constructor() {
    this.metrics = {
      testRuns: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      totalDuration: 0,
      testDurations: [],
      coverageData: null,
      faultsFound: [],
    };
  }

  recordTestStart() {
    this.startTime = Date.now();
  }

  recordTestEnd(result) {
    const duration = Date.now() - this.startTime;
    this.metrics.testRuns++;
    this.metrics.totalDuration += duration;
    this.metrics.testDurations.push(duration);

    if (result === "passed") {
      this.metrics.passed++;
    } else if (result === "failed") {
      this.metrics.failed++;
    } else if (result === "skipped") {
      this.metrics.skipped++;
    }
  }

  recordFault(fault) {
    this.metrics.faultsFound.push({
      timestamp: new Date().toISOString(),
      ...fault,
    });
  }

  setCoverageData(coverage) {
    this.metrics.coverageData = coverage;
  }

  getMetrics() {
    return {
      ...this.metrics,
      averageDuration:
        this.metrics.testRuns > 0
          ? this.metrics.totalDuration / this.metrics.testRuns
          : 0,
      passRate:
        this.metrics.testRuns > 0
          ? ((this.metrics.passed / this.metrics.testRuns) * 100).toFixed(2)
          : 0,
      testYield: {
        totalTests: this.metrics.testRuns,
        faultsFound: this.metrics.faultsFound.length,
        faultsPerTest:
          this.metrics.testRuns > 0
            ? (this.metrics.faultsFound.length / this.metrics.testRuns).toFixed(
                3
              )
            : 0,
      },
    };
  }

  generateReport() {
    const metrics = this.getMetrics();

    return `
=== Test Metrics Report ===
Total Test Runs: ${metrics.testRuns}
Passed: ${metrics.passed}
Failed: ${metrics.failed}
Skipped: ${metrics.skipped}
Pass Rate: ${metrics.passRate}%

=== Performance ===
Total Duration: ${metrics.totalDuration}ms
Average Duration: ${metrics.averageDuration.toFixed(2)}ms

=== Test Yield ===
Total Faults Found: ${metrics.faultsFound.length}
Faults Per Test: ${metrics.testYield.faultsPerTest}

=== Coverage ===
${metrics.coverageData ? JSON.stringify(metrics.coverageData, null, 2) : "No coverage data available"}
    `.trim();
  }

  reset() {
    this.metrics = {
      testRuns: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      totalDuration: 0,
      testDurations: [],
      coverageData: null,
      faultsFound: [],
    };
  }
}

module.exports = new MetricsCollector();
