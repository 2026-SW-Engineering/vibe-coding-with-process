"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clearAuth, getUser, isAdmin, isLoggedIn, type AuthUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

interface Props {
  cartCount?: number;
  onSearch?: (q: string) => void;
  searchValue?: string;
}

export default function Navbar({ cartCount = 0, onSearch, searchValue = "" }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState(searchValue);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setUser(getUser());
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    clearAuth();
    setLoggedIn(false);
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
  };

  return (
    <header className="bg-white border-b border-[#E0E0E0] sticky top-0 z-40">
      {/* Top bar */}
      <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 flex items-center gap-1.5">
          <span className="text-[22px] font-black text-[#1A1A1A] tracking-tight leading-none">VIBE</span>
          <span className="text-[22px] font-black text-[#E53935] tracking-tight leading-none">MALL</span>
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-[560px] mx-auto">
          <div className="flex border-2 border-[#1A1A1A] rounded-sm overflow-hidden">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="상품을 검색해보세요"
              className="flex-1 px-3 py-2 text-sm outline-none bg-white"
            />
            <button type="submit" className="bg-[#1A1A1A] px-4 text-white flex items-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>

        {/* Right actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {loggedIn ? (
            <>
              <Link href="/cart" className="flex flex-col items-center gap-0.5 relative group">
                <div className="relative">
                  <svg className="w-6 h-6 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#E53935] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#555]">장바구니</span>
              </Link>

              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen(!menuOpen)} className="flex flex-col items-center gap-0.5">
                  <div className="w-6 h-6 bg-[#1A1A1A] text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {user?.name?.[0] || "U"}
                  </div>
                  <span className="text-[10px] text-[#555] max-w-[48px] truncate">{user?.name}</span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-[#E0E0E0] shadow-md py-1 z-50">
                    <div className="px-3 py-2 border-b border-[#F0F0F0]">
                      <p className="text-xs font-semibold text-[#1A1A1A]">{user?.name}</p>
                      <p className="text-[11px] text-[#888]">{user?.email}</p>
                    </div>
                    <Link href="/orders" className="flex items-center gap-2 px-3 py-2 text-xs text-[#333] hover:bg-[#F5F5F5]" onClick={() => setMenuOpen(false)}>
                      📦 주문내역
                    </Link>
                    {isAdmin() && (
                      <Link href="/admin" className="flex items-center gap-2 px-3 py-2 text-xs text-[#C62828] hover:bg-[#FFF5F5]" onClick={() => setMenuOpen(false)}>
                        ⚙️ 관리자
                      </Link>
                    )}
                    <button onClick={handleLogout} className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-[#555] hover:bg-[#F5F5F5] border-t border-[#F0F0F0]">
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <Link href="/login" className="text-[#333] hover:text-[#E53935]">로그인</Link>
              <span className="text-[#E0E0E0]">|</span>
              <Link href="/register" className="text-[#333] hover:text-[#E53935]">회원가입</Link>
            </div>
          )}
        </div>
      </div>

      {/* Category nav */}
      <nav className="border-t border-[#F0F0F0] bg-white">
        <div className="max-w-[1200px] mx-auto px-4">
          <ul className="flex gap-0 text-xs font-medium text-[#444]">
            {["전체", "전자기기", "의류", "식품", "뷰티", "홈/리빙"].map(cat => (
              <li key={cat}>
                <Link
                  href={cat === "전체" ? "/" : `/?category=${encodeURIComponent(cat)}`}
                  className="block px-4 py-2.5 hover:text-[#E53935] hover:border-b-2 hover:border-[#E53935] transition-colors"
                >
                  {cat}
                </Link>
              </li>
            ))}
            {isAdmin() && (
              <li className="ml-auto">
                <Link href="/admin" className="block px-4 py-2.5 text-[#C62828] hover:text-[#E53935]">관리자</Link>
              </li>
            )}
          </ul>
        </div>
      </nav>
    </header>
  );
}
