import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Resource Navigator | Louisville Neighbor Network",
  description: "Find community resources in Louisville, KY. Connect with housing, food, healthcare, employment, and more through the Neighbor Network.",
  keywords: ["Louisville", "resources", "community", "help", "housing", "food", "healthcare", "Kentucky"],
  authors: [{ name: "Louisville Neighbor Network" }],
  openGraph: {
    title: "Resource Navigator | Louisville Neighbor Network",
    description: "Find community resources in Louisville, KY",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
