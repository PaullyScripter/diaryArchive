import { DonationAddressList } from "@/components/donations/donation-address-list";

export const metadata = {
  title: "Support DiaryArchive",
  description: "Support DiaryArchive with a pseudonymous cryptocurrency donation.",
};

export default function DonatePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-accent">Support DiaryArchive</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Help keep DiaryArchive growing</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          Every bit of support, no matter the amount, is genuinely appreciated. Donations help fund the continued development and upkeep of this nonprofit project.
        </p>
      </header>

      <section className="mb-8 rounded-md border border-border bg-overlay/5 p-4 sm:p-5" aria-labelledby="privacy-note">
        <h2 id="privacy-note" className="text-sm font-semibold text-foreground">Pseudonymous donations</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This page does not ask for your name, email address, account, or any other donor information. Blockchain transactions are still publicly visible, so pseudonymous does not mean fully anonymous.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Because we cannot reliably connect a donation to a DiaryArchive account, we unfortunately cannot provide site rewards: no badge, receipt, personal thank-you email, or other donor reward. Your support is appreciated even when we cannot personally identify or thank you.
        </p>
      </section>

      <section aria-labelledby="addresses-heading">
        <div className="mb-4">
          <h2 id="addresses-heading" className="text-lg font-semibold text-foreground">Donation addresses</h2>
          <p className="mt-1 text-sm text-muted">Please verify the asset and network carefully before sending. Cryptocurrency transfers are irreversible.</p>
        </div>
        <DonationAddressList />
      </section>

      <p className="mt-8 text-xs leading-relaxed text-subtle">
        Only send an asset on the network shown beside its address. USDC and USDT addresses above accept Ethereum mainnet (ERC-20) transfers only. DiaryArchive does not custody funds or process donations through this site.
      </p>
    </div>
  );
}
