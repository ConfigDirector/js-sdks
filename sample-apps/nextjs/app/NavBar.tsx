"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="tab-bar">
      <Link href="/" className={`tab-btn${pathname === "/" ? " active" : ""}`}>
        Configs
      </Link>
      <Link href="/context" className={`tab-btn${pathname === "/context" ? " active" : ""}`}>
        Context
      </Link>
    </nav>
  );
}
