import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DonationAddressList } from "@/components/donations/donation-address-list";

describe("DonationAddressList", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders only the supported static donation addresses", () => {
    render(<DonationAddressList />);

    expect(screen.getByText("Bitcoin (BTC)")).toBeInTheDocument();
    expect(screen.getByText("Ethereum (ETH)")).toBeInTheDocument();
    expect(screen.getByText("Litecoin (LTC)")).toBeInTheDocument();
    expect(screen.getByText("USD Coin (USDC)")).toBeInTheDocument();
    expect(screen.getByText("Tether (USDT)")).toBeInTheDocument();
    expect(screen.queryByText(/Monero|XMR/i)).not.toBeInTheDocument();
  });

  it("copies an address without sending donation or donor data to the app", async () => {
    render(<DonationAddressList />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Bitcoin (BTC) donation address" }));

    await waitFor(() => expect(screen.getByText("Address copied to your clipboard.")).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("bc1q4ptf647z66c85fmeafvgfcs38x2ngmrpxe2da9");
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<DonationAddressList />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
