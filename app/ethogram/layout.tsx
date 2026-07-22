import type { Viewport } from "next";
import { UserButton } from "@clerk/nextjs";

/* Dedicated full-screen layout for the ethogram tool — no dashboard sidebar,
 * so it's clean and usable on a phone. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function EthogramLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
        <span className="font-semibold">🐦 Ethogram</span>
        <UserButton />
      </header>
      {children}
    </div>
  );
}
