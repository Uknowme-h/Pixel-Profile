"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav() {
  const path = usePathname();
  const item = (href: string, label: string) => {
    const on = path === href || (href !== "/" && path.startsWith(href));
    return (
      <Link
        href={href}
        className={`text-sm transition-opacity ${on ? "text-[#111]" : "text-[#777] hover:text-[#111] hover:opacity-70"}`}
      >
        {label}
        {on && <span className="mt-1 block h-px bg-[#111]" />}
      </Link>
    );
  };
  return (
    <nav className="flex items-center gap-6" aria-label="Studio">
      {item("/", "Builder")}
      {item("/editor", "Editor")}
    </nav>
  );
}
