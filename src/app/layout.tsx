import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "T.I.K.I. | LDG Entertainment Division",
    template: "%s | T.I.K.I.",
  },
  description: "Technical Information & Knowledge Index for the LDG Entertainment Division.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
