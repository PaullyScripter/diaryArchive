"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

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
  const [selectedId, setSelectedId] = useState(DONATION_ADDRESSES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const selected = DONATION_ADDRESSES.find((item) => item.id === selectedId) ?? DONATION_ADDRESSES[0];

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
    <div aria-label="Donation addresses">
      <div className="grid gap-4 lg:grid-cols-[7rem_minmax(0,1fr)] lg:items-stretch">
        <div className="flex items-center lg:justify-center">
          <span className="text-xl font-medium uppercase tracking-tight text-foreground lg:[writing-mode:horizontal-tb]">Cryptos</span>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)]">
          <div className="space-y-2" role="group" aria-label="Choose a cryptocurrency">
            {DONATION_ADDRESSES.map((item) => {
              const isSelected = item.id === selected.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setCopiedId(null);
                    setCopyError(null);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2 ${
                    isSelected
                      ? "border-foreground bg-overlay/10 text-foreground"
                      : "border-border bg-background text-muted hover:bg-overlay/5 hover:text-foreground"
                  }`}
                  aria-pressed={isSelected}
                >
                  <span>
                    <span className="block text-sm font-semibold">{item.asset}</span>
                    <span className="mt-1 block text-xs">{item.network}</span>
                  </span>
                  <span aria-hidden="true" className="text-lg leading-none">{isSelected ? "•" : ""}</span>
                </button>
              );
            })}
          </div>

          <div className="flex min-h-64 items-center justify-center rounded-md border border-border bg-background p-5">
            <QRCodeSVG
              value={selected.address}
              size={220}
              includeMargin
              role="img"
              aria-label={`${selected.asset} donation address QR code`}
              bgColor="var(--color-background)"
              fgColor="var(--color-foreground)"
              className="h-auto max-w-full"
            />
          </div>

          <div className="md:col-start-2">
            <p className="mb-2 text-xs font-medium text-muted">{selected.asset} address</p>
            <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all text-xs leading-relaxed text-foreground">{selected.address}</code>
              <button
                type="button"
                onClick={() => void handleCopy(selected)}
                className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-overlay/10 focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
                aria-label={`Copy ${selected.asset} donation address`}
              >
                {copiedId === selected.id ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-muted">Cautions</p>
        <ul className="mx-auto mt-2 max-w-2xl space-y-1 text-center text-xs leading-relaxed text-muted">
          <li>Verify the asset and network before sending. Cryptocurrency transfers are irreversible.</li>
          <li>USDC and USDT accept Ethereum mainnet (ERC-20) transfers only.</li>
          {selected.note && <li className="text-amber-700 dark:text-amber-300">{selected.note}</li>}
        </ul>
      </div>
      <p className="min-h-5 text-xs text-muted" role="status" aria-live="polite">
        {copyError ?? (copiedId ? "Address copied to your clipboard." : "")}
      </p>
    </div>
  );
}
