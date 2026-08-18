import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";

// jest-axe ships a jest-style matcher; cast to vitest's MatchersObject shape.
expect.extend(toHaveNoViolations as unknown as Parameters<typeof expect.extend>[0]);
