import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeMall — AI 쇼핑몰",
  description: "AI 추천 챗봇이 있는 쇼핑몰",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
