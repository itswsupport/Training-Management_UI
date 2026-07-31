"use client";

import "./globals.css";
// SweetAlert2's base stylesheet; globals.css re-themes it in the app font.
import "sweetalert2/dist/sweetalert2.min.css";

import { Exo } from "next/font/google";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "@/context/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import ProtectedLayoutWrapper from "@/components/ProtectedLayoutWrapper";
import FontOverride from "@/components/ui/FontOverride";

// Configure Exo font
const exo = Exo({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-exo",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={exo.variable} suppressHydrationWarning>
      <head>
        <title>REPL ETMS</title>
        <meta name="description" content="Employee Training Management System" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#3482AE" />
      </head>
      <body
        className={`${exo.className} antialiased flex h-screen overflow-hidden`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <SidebarProvider>
            <FontOverride />
            <Toaster position="top-right" />
            <ProtectedLayoutWrapper>{children}</ProtectedLayoutWrapper>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
