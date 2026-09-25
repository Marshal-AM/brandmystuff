"use client";
import { useCurrentAccount, useDAppKit, useWallets } from "@mysten/dapp-kit-react";
import { useState } from "react";
import { Button, Modal, useToast } from "./ui";

export default function WalletConnect({ onClose, onConnected }: { onClose: () => void; onConnected: () => Promise<void> }) {
  const wallets = useWallets();
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title="Sign in with a Sui wallet">
      {!wallets.length && <p className="text-sm text-muted">No Sui wallet detected. Install Slush, Suiet or Phantom, or sign in with email instead.</p>}
      <div className="space-y-2">
        {wallets.map((w: any) => (
          <button
            key={w.name}
            className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-violet-300"
            onClick={async () => {
              setBusy(true);
              try {
                await dAppKit.connectWallet({ wallet: w });
                toast({ text: `Connected ${w.name}. Now sign the login message.`, tone: "info" });
              } catch (e: any) {
                toast({ text: e.message, tone: "bad" });
              } finally {
                setBusy(false);
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {w.icon && <img src={w.icon} alt="" className="h-8 w-8 rounded" />}
            <span className="font-medium">{w.name}</span>
          </button>
        ))}
      </div>
      {account && (
        <Button
          className="mt-4 w-full"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConnected();
              onClose();
            } catch (e: any) {
              toast({ text: e.message, tone: "bad" });
            } finally {
              setBusy(false);
            }
          }}
        >
          Sign in as {account.address.slice(0, 8)}…
        </Button>
      )}
    </Modal>
  );
}
