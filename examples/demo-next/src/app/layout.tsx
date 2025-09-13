import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Demo Next App",
  description: "Analytics tracking demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="/tracker.js" defer></script>
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
