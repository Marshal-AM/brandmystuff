"use client";
import { useCurrentAccount, useDAppKit, useWallets } from "@mysten/dapp-kit-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Wallet } from "lucide-react";
import { Button, Modal, useToast } from "./ui";

export default function WalletConnect({ onClose, onConnected }: { onClose: () => void; onConnected: () => Promise<void> }) {
  const wallets = useWallets();
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title="Sign in with a Sui wallet">
      {!wallets.length && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-p/15 text-p"><Wallet className="h-5 w-5" /></span>
          <p className="text-sm text-muted">No Sui wallet detected. Install Slush, Suiet or Phantom, or sign in with email instead.</p>
        </div>
      )}
      <div className="space-y-2">
        {wallets.map((w: any, i: number) => {
          const connected = account && w.accounts?.some((a: any) => a.address === account.address);
          return (
            <motion.button
              key={w.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 24 }}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${connected ? "border-p bg-p/10" : "border-line-strong bg-white/[0.03] hover:border-p/50 hover:bg-p/[0.06]"}`}
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
              {w.icon ? <img src={w.icon} alt="" className="h-10 w-10 rounded-xl" /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-p/15 text-p"><Wallet className="h-5 w-5" /></span>}
              <span className="flex-1 font-semibold">{w.name}</span>
              {connected ? <span className="text-xs font-bold text-p">Connected</span> : <ChevronRight className="h-4 w-4 text-muted transition-colors group-hover:text-p" />}
            </motion.button>
          );
        })}
      </div>
      {account && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            className="mt-5 w-full"
            size="lg"
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
            Sign in as <span className="font-mono">{account.address.slice(0, 8)}…</span>
          </Button>
        </motion.div>
      )}
    </Modal>
  );
}
