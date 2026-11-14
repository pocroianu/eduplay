/**
 * Report Generator
 *
 * Generates validation reports in multiple formats:
 * - JSON (machine-readable, for CI/CD)
 * - HTML (human-readable, with visualizations)
 *
 * @module validation/ReportGenerator
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  ValidationReport,
  ReportGenerationOptions,
  HTMLReportOptions,
  ValidationSummary
} from './types';

/**
 * Default HTML report options
 */
export const DEFAULT_HTML_OPTIONS: HTMLReportOptions = {
  title: 'Validation Report',
  includeCharts: true,
  includeScreenshots: false,
  theme: 'light'
};

/**
 * Report generation service
 */
export class ReportGenerator {
  /**
   * Generate reports
   */
  async generate(
    report: ValidationReport,
    options: ReportGenerationOptions
  ): Promise<{ jsonPath?: string; htmlPath?: string }> {
    const result: { jsonPath?: string; htmlPath?: string } = {};

    if (options.format === 'json' || options.format === 'both') {
      const jsonPath = join(options.outputPath, 'validation-report.json');
      await this.generateJSON(report, jsonPath, options.includeDetails);
      result.jsonPath = jsonPath;
    }

    if (options.format === 'html' || options.format === 'both') {
      const htmlPath = join(options.outputPath, 'validation-report.html');
      await this.generateHTML(
        report,
        htmlPath,
        options.htmlOptions || DEFAULT_HTML_OPTIONS
      );
      result.htmlPath = htmlPath;
    }

    return result;
  }

  /**
   * Generate JSON report
   */
  private async generateJSON(
    report: ValidationReport,
    outputPath: string,
    includeDetails: boolean
  ): Promise<void> {
    const jsonReport = includeDetails
      ? report
      : {
          gameId: report.gameId,
          validatedAt: report.validatedAt,
          passed: report.passed,
          overallScore: report.overallScore,
          summary: report.summary,
          recommendations: report.recommendations
        };

    await writeFile(outputPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
  }

  /**
   * Generate HTML report
   */
  private async generateHTML(
    report: ValidationReport,
    outputPath: string,
    options: HTMLReportOptions
  ): Promise<void> {
    const html = this.buildHTMLReport(report, options);
    await writeFile(outputPath, html, 'utf-8');
  }

  /**
   * Build HTML report
   */
  private buildHTMLReport(
    report: ValidationReport,
    options: HTMLReportOptions
  ): string {
    const { summary } = report;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${options.title || 'Validation Report'} - ${report.gameId}</title>
    <style>
        ${this.getCSS(options.theme)}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${options.title || 'Validation Report'}</h1>
            <div class="meta">
                <span class="game-id">Game: ${report.gameId}</span>
                <span class="timestamp">Generated: ${new Date(report.validatedAt).toLocaleString()}</span>
                <span class="duration">Duration: ${(report.validationDuration / 1000).toFixed(2)}s</span>
            </div>
        </header>

        ${this.buildOverviewSection(report)}
        ${this.buildScoreSection(report)}
        ${this.buildIssuesSection(report)}
        ${this.buildStagesSection(report)}
        ${this.buildRemediationSection(report)}
        ${this.buildRecommendationsSection(report)}

        ${options.includeCharts ? this.buildChartsSection(report) : ''}
    </div>

    ${options.includeCharts ? this.getChartScript(report) : ''}
</body>
</html>
    `.trim();
  }

  /**
   * Build overview section
   */
  private buildOverviewSection(report: ValidationReport): string {
    const statusClass = report.passed ? 'success' : 'failure';
    const statusText = report.passed ? 'PASSED' : 'FAILED';

    return `
    <section class="overview">
        <div class="status-badge ${statusClass}">
            ${statusText}
        </div>
        <div class="score-display">
            <div class="score-value">${report.overallScore.toFixed(1)}</div>
            <div class="score-label">Overall Score</div>
        </div>
    </section>
    `;
  }

  /**
   * Build score section
   */
  private buildScoreSection(report: ValidationReport): string {
    const { summary } = report;
    const totalChecks =
      (report.stages.basic?.fileChecks.length || 0) +
      (report.stages.quality?.imageScores.length || 0) +
      (report.stages.quality?.textScores.length || 0) +
      (report.stages.compliance?.wcagChecks.length || 0);

    return `
    <section class="summary">
        <h2>Summary</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${totalChecks}</div>
                <div class="stat-label">Total Checks</div>
            </div>
            <div class="stat-card ${summary.criticalIssues > 0 ? 'critical' : ''}">
                <div class="stat-value">${summary.criticalIssues}</div>
                <div class="stat-label">Critical Issues</div>
            </div>
            <div class="stat-card ${summary.highIssues > 0 ? 'high' : ''}">
                <div class="stat-value">${summary.highIssues}</div>
                <div class="stat-label">High Issues</div>
            </div>
            <div class="stat-card ${summary.mediumIssues > 0 ? 'medium' : ''}">
                <div class="stat-value">${summary.mediumIssues}</div>
                <div class="stat-label">Medium Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.autoRemediatedIssues}</div>
                <div class="stat-label">Auto-Fixed</div>
            </div>
            <div class="stat-card ${summary.manualRemediationRequired > 0 ? 'warning' : ''}">
                <div class="stat-value">${summary.manualRemediationRequired}</div>
                <div class="stat-label">Manual Fixes Needed</div>
            </div>
        </div>
    </section>
    `;
  }

  /**
   * Build issues section
   */
  private buildIssuesSection(report: ValidationReport): string {
    const allIssues = this.collectAllIssues(report);
    const criticalIssues = allIssues.filter(i => i.severity === 'critical');
    const highIssues = allIssues.filter(i => i.severity === 'high');
    const mediumIssues = allIssues.filter(i => i.severity === 'medium');

    if (allIssues.length === 0) {
      return `
      <section class="issues">
          <h2>Issues</h2>
          <div class="no-issues">
              <span class="success-icon">✓</span>
              <p>No issues found! All validation checks passed.</p>
          </div>
      </section>
      `;
    }

    return `
    <section class="issues">
        <h2>Issues Found (${allIssues.length})</h2>

        ${criticalIssues.length > 0 ? this.buildIssueList('Critical', criticalIssues, 'critical') : ''}
        ${highIssues.length > 0 ? this.buildIssueList('High', highIssues, 'high') : ''}
        ${mediumIssues.length > 0 ? this.buildIssueList('Medium', mediumIssues, 'medium') : ''}
    </section>
    `;
  }

  /**
   * Build issue list
   */
  private buildIssueList(
    title: string,
    issues: any[],
    severity: string
  ): string {
    return `
    <div class="issue-category">
        <h3 class="${severity}">${title} Priority (${issues.length})</h3>
        <div class="issue-list">
            ${issues
              .map(
                issue => `
            <div class="issue-item ${severity}">
                <div class="issue-header">
                    <span class="issue-category-badge">${issue.category}</span>
                    <span class="issue-stage">${issue.stage}</span>
                </div>
                <div class="issue-message">${this.escapeHtml(issue.message)}</div>
                ${issue.file ? `<div class="issue-file">File: ${this.escapeHtml(issue.file)}</div>` : ''}
                ${issue.suggestedFix ? `<div class="issue-fix">💡 ${this.escapeHtml(issue.suggestedFix)}</div>` : ''}
            </div>
            `
              )
              .join('')}
        </div>
    </div>
    `;
  }

  /**
   * Build stages section
   */
  private buildStagesSection(report: ValidationReport): string {
    return `
    <section class="stages">
        <h2>Validation Stages</h2>

        ${report.stages.basic ? this.buildBasicStageDetails(report.stages.basic) : ''}
        ${report.stages.quality ? this.buildQualityStageDetails(report.stages.quality) : ''}
        ${report.stages.compliance ? this.buildComplianceStageDetails(report.stages.compliance) : ''}
    </section>
    `;
  }

  /**
   * Build basic stage details
   */
  private buildBasicStageDetails(stage: any): string {
    const passed = stage.passed;
    return `
    <div class="stage-card">
        <h3>
            <span class="stage-icon ${passed ? 'success' : 'failure'}">${passed ? '✓' : '✗'}</span>
            Basic Validation
        </h3>
        <div class="stage-stats">
            <span>Files: ${stage.fileChecks?.length || 0}</span>
            <span>Format Checks: ${stage.formatChecks?.length || 0}</span>
            <span>Size Checks: ${stage.sizeChecks?.length || 0}</span>
            <span>Schema Checks: ${stage.schemaChecks?.length || 0}</span>
        </div>
    </div>
    `;
  }

  /**
   * Build quality stage details
   */
  private buildQualityStageDetails(stage: any): string {
    const passed = stage.passed;
    return `
    <div class="stage-card">
        <h3>
            <span class="stage-icon ${passed ? 'success' : 'failure'}">${passed ? '✓' : '✗'}</span>
            Quality Validation
        </h3>
        <div class="stage-stats">
            <span>Overall Score: ${stage.overallScore?.toFixed(1) || 'N/A'}</span>
            <span>Images: ${stage.imageScores?.length || 0} (avg: ${stage.avgImageScore?.toFixed(1) || 'N/A'})</span>
            <span>Texts: ${stage.textScores?.length || 0} (avg: ${stage.avgTextScore?.toFixed(1) || 'N/A'})</span>
            <span>Audio: ${stage.audioScores?.length || 0} (avg: ${stage.avgAudioScore?.toFixed(1) || 'N/A'})</span>
        </div>
    </div>
    `;
  }

  /**
   * Build compliance stage details
   */
  private buildComplianceStageDetails(stage: any): string {
    const passed = stage.passed;
    const wcagPassed = stage.wcagChecks?.filter((c: any) => c.passed).length || 0;
    const wcagTotal = stage.wcagChecks?.length || 0;

    return `
    <div class="stage-card">
        <h3>
            <span class="stage-icon ${passed ? 'success' : 'failure'}">${passed ? '✓' : '✗'}</span>
            Compliance Validation
        </h3>
        <div class="stage-stats">
            <span>WCAG Checks: ${wcagPassed}/${wcagTotal} passed</span>
            <span>Educational Checks: ${stage.educationalChecks?.length || 0}</span>
            <span>Technical Checks: ${stage.technicalChecks?.length || 0}</span>
        </div>
    </div>
    `;
  }

  /**
   * Build remediation section
   */
  private buildRemediationSection(report: ValidationReport): string {
    if (!report.stages.remediation) {
      return '';
    }

    const { remediation } = report.stages;
    const successRate =
      remediation.totalIssues > 0
        ? ((remediation.autoRemediatedIssues / remediation.totalIssues) * 100).toFixed(1)
        : '0';

    return `
    <section class="remediation">
        <h2>Auto-Remediation</h2>
        <div class="remediation-summary">
            <div class="stat-card">
                <div class="stat-value">${remediation.autoRemediatedIssues}</div>
                <div class="stat-label">Issues Fixed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${successRate}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${remediation.manualRemediationRequired}</div>
                <div class="stat-label">Manual Fixes Needed</div>
            </div>
        </div>
    </section>
    `;
  }

  /**
   * Build recommendations section
   */
  private buildRecommendationsSection(report: ValidationReport): string {
    if (!report.recommendations || report.recommendations.length === 0) {
      return '';
    }

    return `
    <section class="recommendations">
        <h2>Recommendations</h2>
        <ul class="recommendation-list">
            ${report.recommendations.map(rec => `<li>${this.escapeHtml(rec)}</li>`).join('')}
        </ul>
    </section>
    `;
  }

  /**
   * Build charts section
   */
  private buildChartsSection(report: ValidationReport): string {
    return `
    <section class="charts">
        <h2>Visualizations</h2>
        <div class="chart-grid">
            <div class="chart-container">
                <canvas id="issuesChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="categoryChart"></canvas>
            </div>
        </div>
    </section>
    `;
  }

  /**
   * Get CSS styles
   */
  private getCSS(theme: 'light' | 'dark'): string {
    const isDark = theme === 'dark';
    const bg = isDark ? '#1a1a1a' : '#ffffff';
    const fg = isDark ? '#e0e0e0' : '#333333';
    const border = isDark ? '#333333' : '#e0e0e0';

    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: ${fg};
            background: ${bg};
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header { text-align: center; margin-bottom: 40px; }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        h2 { font-size: 1.8em; margin: 30px 0 15px; border-bottom: 2px solid ${border}; padding-bottom: 10px; }
        h3 { font-size: 1.3em; margin: 20px 0 10px; }
        .meta { display: flex; gap: 20px; justify-content: center; color: #666; }
        .overview { display: flex; gap: 40px; justify-content: center; align-items: center; margin: 40px 0; }
        .status-badge {
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 1.5em;
            font-weight: bold;
        }
        .status-badge.success { background: #4caf50; color: white; }
        .status-badge.failure { background: #f44336; color: white; }
        .score-display { text-align: center; }
        .score-value { font-size: 3em; font-weight: bold; color: #2196f3; }
        .score-label { color: #666; font-size: 0.9em; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: ${isDark ? '#2a2a2a' : '#f5f5f5'};
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 2px solid transparent;
        }
        .stat-card.critical { border-color: #f44336; }
        .stat-card.high { border-color: #ff9800; }
        .stat-card.medium { border-color: #ffc107; }
        .stat-card.warning { border-color: #ff9800; }
        .stat-value { font-size: 2em; font-weight: bold; }
        .stat-label { color: #666; font-size: 0.9em; margin-top: 5px; }
        .issue-category { margin: 20px 0; }
        .issue-list { display: flex; flex-direction: column; gap: 10px; }
        .issue-item {
            background: ${isDark ? '#2a2a2a' : '#f9f9f9'};
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #ccc;
        }
        .issue-item.critical { border-left-color: #f44336; }
        .issue-item.high { border-left-color: #ff9800; }
        .issue-item.medium { border-left-color: #ffc107; }
        .issue-header { display: flex; gap: 10px; margin-bottom: 8px; }
        .issue-category-badge {
            background: #2196f3;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.8em;
        }
        .issue-stage {
            background: #9e9e9e;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.8em;
        }
        .issue-message { font-weight: 500; margin: 8px 0; }
        .issue-file { color: #666; font-size: 0.9em; font-family: monospace; }
        .issue-fix {
            margin-top: 8px;
            padding: 8px;
            background: ${isDark ? '#1a3a1a' : '#e8f5e9'};
            border-radius: 4px;
            font-size: 0.9em;
        }
        .stage-card {
            background: ${isDark ? '#2a2a2a' : '#f5f5f5'};
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
        }
        .stage-icon { margin-right: 10px; }
        .stage-icon.success { color: #4caf50; }
        .stage-icon.failure { color: #f44336; }
        .stage-stats { display: flex; gap: 20px; margin-top: 10px; color: #666; }
        .no-issues {
            text-align: center;
            padding: 40px;
            background: ${isDark ? '#1a3a1a' : '#e8f5e9'};
            border-radius: 8px;
        }
        .success-icon { font-size: 3em; color: #4caf50; display: block; margin-bottom: 10px; }
        .recommendation-list { padding-left: 20px; }
        .recommendation-list li { margin: 10px 0; }
        .chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
        .chart-container { background: ${isDark ? '#2a2a2a' : '#f5f5f5'}; padding: 20px; border-radius: 8px; }
    `;
  }

  /**
   * Get chart script
   */
  private getChartScript(report: ValidationReport): string {
    const { summary } = report;

    return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script>
        // Issues by severity chart
        new Chart(document.getElementById('issuesChart'), {
            type: 'doughnut',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{
                    data: [${summary.criticalIssues}, ${summary.highIssues}, ${summary.mediumIssues}, ${summary.lowIssues}],
                    backgroundColor: ['#f44336', '#ff9800', '#ffc107', '#4caf50']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Issues by Severity' }
                }
            }
        });

        // Issues by category chart
        new Chart(document.getElementById('categoryChart'), {
            type: 'bar',
            data: {
                labels: ['Images', 'Text', 'Audio', 'Config'],
                datasets: [{
                    label: 'Issues',
                    data: [${summary.imageIssues}, ${summary.textIssues}, ${summary.audioIssues}, ${summary.configIssues}],
                    backgroundColor: '#2196f3'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Issues by Category' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    </script>
    `;
  }

  /**
   * Collect all issues from report
   */
  private collectAllIssues(report: ValidationReport): any[] {
    const issues: any[] = [];

    if (report.stages.basic) {
      issues.push(...report.stages.basic.issues);
    }
    if (report.stages.quality) {
      issues.push(...report.stages.quality.issues);
    }
    if (report.stages.compliance) {
      issues.push(...report.stages.compliance.issues);
    }

    return issues;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
