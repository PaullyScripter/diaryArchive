import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | DiaryArchive",
  description: "The terms and conditions governing your use of DiaryArchive.",
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}