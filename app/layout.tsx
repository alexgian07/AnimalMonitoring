import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Έρευνα Γαλοπούλας — Dashboard",
  description: "Σύστημα παρακολούθησης ερευνητικού πληθυσμού γαλοπουλών",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="el" className={cn("font-sans", geist.variable)}>
        <body className="bg-gray-950 text-gray-100 antialiased min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
