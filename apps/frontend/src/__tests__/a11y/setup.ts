import { type ReactElement } from "react";
import { render } from "@testing-library/react";
import axe from "axe-core";

export async function testAccessibility(component: ReactElement): Promise<void> {
  const { container } = render(component);
  const result = await axe.run(container);

  if (result.violations.length > 0) {
    const messages = result.violations.map(
      (v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`,
    );
    throw new Error(`Accessibility violations found:\n${messages.join("\n")}`);
  }
}

export function toHaveNoA11yViolations(received: { violations: Array<{ id: string; description: string; nodes: unknown[] }> }) {
  const pass = received.violations.length === 0;
  if (pass) {
    return { pass: true, message: () => "No accessibility violations found" };
  }
  const detail = received.violations
    .map((v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`)
    .join("\n");
  return {
    pass: false,
    message: () => `Accessibility violations:\n${detail}`,
  };
}

export async function assertNoViolations(container: HTMLElement): Promise<void> {
  const result = await axe.run(container);
  if (result.violations.length > 0) {
    const messages = result.violations.map(
      (v) => `  - ${v.id}: ${v.description}`,
    );
    throw new Error(`A11y violations:\n${messages.join("\n")}`);
  }
}
