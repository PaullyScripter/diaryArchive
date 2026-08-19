import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Avatar } from "@/components/shared/avatar";
import { TagBadge } from "@/components/shared/tag-badge";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("accessibility (jest-axe)", () => {
  it("button renders without violations", async () => {
    const { container } = render(<Button>Save</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("labeled input renders without violations", async () => {
    const { container } = render(
      <label>
        Username
        <Input />
      </label>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("password input renders without violations", async () => {
    const { container } = render(
      <label>
        Password
        <PasswordInput />
      </label>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("avatar with alt text renders without violations", async () => {
    const { container } = render(<Avatar src="/a.png" alt="User avatar" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("tag badge renders without violations", async () => {
    const { container } = render(<TagBadge tag="memoir" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});