import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | DiaryArchive",
  description: "How DiaryArchive handles your data, privacy, security, and your rights.",
};

export default function PolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
