declare module "jest-axe" {
  export interface AxeResults {
    violations: Array<{ id: string; impact: string; help: string; nodes: unknown[] }>;
    passes: Array<{ id: string }>;
  }

  export function axe(element: Element | Document): Promise<AxeResults>;

  export const toHaveNoViolations: {
    (results: AxeResults): { pass: boolean; message: () => string };
  };
}