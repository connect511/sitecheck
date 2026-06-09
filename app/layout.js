import "./globals.css";

export const metadata = {
  title: "SiteCheck by Digistick — Free Website Audit",
  description:
    "Paste your URL and get an instant diagnostic across performance, SEO, accessibility and conversion. By Digistick.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
