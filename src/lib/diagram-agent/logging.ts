import type { DiagramPlan, DiagramTarget } from './types';

function operationSummary(plan: DiagramPlan) {
  return plan.operations.reduce<Record<string, number>>((summary, operation) => {
    summary[operation.type] = (summary[operation.type] ?? 0) + 1;
    return summary;
  }, {});
}

/** Diagnostic output for the desktop inspector. Deliberately excludes prompts, API settings, and file contents. */
export class DiagramAgentLogger {
  inspectStarted(details: { tabId: string | null; elementCount: number; mode: string }) {
    console.info('[diagram-agent] inspect started', { ...details, at: new Date().toISOString() });
  }

  requestCompleted(details: { responseLength: number; planDetected: boolean }) {
    console.info('[diagram-agent] model response completed', { ...details, at: new Date().toISOString() });
  }

  planApplying(plan: DiagramPlan, target: DiagramTarget) {
    console.groupCollapsed('[diagram-agent] applying plan');
    console.info('target', target);
    console.info('summary', plan.summary);
    console.table(operationSummary(plan));
    console.groupEnd();
  }

  planApplied(details: { tabId: string; beforeElementCount: number; afterElementCount: number }) {
    console.info('[diagram-agent] plan applied and save requested', { ...details, at: new Date().toISOString() });
  }

  failure(stage: string, error: unknown) {
    console.error(`[diagram-agent] ${stage} failed`, error);
  }
}

export const diagramAgentLogger = new DiagramAgentLogger();
