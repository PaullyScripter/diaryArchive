"use client";

import { useState } from "react";

type DonationAddress = {
  id: string;
  asset: string;
  network: string;
  address: string;
  note?: string;
};

export const DONATION_ADDRESSES: DonationAddress[] = [
  {
    id: "btc",
    asset: "Bitcoin (BTC)",
    network: "Bitcoin mainnet",
    address: "bc1q4ptf647z66c85fmeafvgfcs38x2ngmrpxe2da9",
  },
  {
    id: "eth",
    asset: "Ethereum (ETH)",
    network: "Ethereum mainnet",
    address: "0x8EB12941aE8869838F647eB0bbc89751C17dfBBc",
  },
  {
    id: "ltc",
    asset: "Litecoin (LTC)",
    network: "Litecoin mainnet",
    address: "ltc1qhxl437hwuw03zuc49034msfuvfqakpv6tslvwd",
  },
  {
    id: "usdc-eth",
    asset: "USD Coin (USDC)",
    network: "Ethereum mainnet (ERC-20) only",
    address: "0x8EB12941aE8869838F647eB0bbc89751C17dfBBc",
    note: "Do not send USDC on Solana or another network to this address.",
  },
  {
    id: "usdt-eth",
    asset: "Tether (USDT)",
    network: "Ethereum mainnet (ERC-20) only",
    address: "0x8EB12941aE8869838F647eB0bbc89751C17dfBBc",
    note: "Do not send USDT on Solana or another network to this address.",
  },
];

async function copyAddress(address: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(address);
    return true;
  }

  const textArea = document.createElement("textarea");
  textArea.value = address;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  return copied;
}

export function DonationAddressList() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopy = async (item: DonationAddress) => {
    setCopyError(null);
    try {
      if (await copyAddress(item.address)) {
        setCopiedId(item.id);
        window.setTimeout(() => setCopiedId(null), 2200);
      } else {
        setCopyError("Copying is unavailable in this browser. Please select the address manually.");
      }
    } catch {
      setCopyError("Copying is unavailable in this browser. Please select the address manually.");
    }
  };

  return (
    <div className="space-y-3" aria-label="Donation addresses">
      {DONATION_ADDRESSES.map((item) => (
        <article key={item.id} className="rounded-md border border-border bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">{item.asset}</h2>
              <p className="mt-1 text-xs text-muted">{item.network}</p>
              <code className="mt-3 block break-all text-xs leading-relaxed text-foreground">
                {item.address}
              </code>
              {item.note && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{item.note}</p>}
            </div>
            <button
              type="button"
              onClick={() => void handleCopy(item)}
              className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-overlay/10 focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
              aria-label={`Copy ${item.asset} donation address`}
            >
              {copiedId === item.id ? "Copied" : "Copy address"}
            </button>
          </div>
        </article>
      ))}
      <p className="min-h-5 text-xs text-muted" role="status" aria-live="polite">
        {copyError ?? (copiedId ? "Address copied to your clipboard." : "")}
      </p>
    </div>
  );
}
