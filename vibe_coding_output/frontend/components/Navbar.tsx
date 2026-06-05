"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearAuth, getUser, isAdmin, isLoggedIn, type AuthUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function Navbar({ cartCount = 0 }: { cartCount?: number }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setUser(getUser());
  }, []);

  const handleLogout = () => {
    clearAuth();
    setLoggedIn(false);
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🛍️</span>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              VibeMall
            </span>
          </Link>

          <div className="hidden sm:flex items-center gap-6">
            <Link href="/" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">
              홈
            </Link>
            {loggedIn && (
              <>
                <Link href="/cart" className="relative text-slate-600 hover:text-indigo-600 font-medium transition-colors">
                  장바구니
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-3 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>
                <Link href="/orders" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">
                  주문내역
                </Link>
                {isAdmin() && (
                  <Link href="/admin" className="text-amber-600 hover:text-amber-700 font-medium transition-colors">
                    관리자
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {loggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full font-medium transition-colors"
                >
                  <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {user?.name?.[0] || "U"}
                  </span>
                  <span className="hidden sm:block">{user?.name}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <Link href="/cart" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:hidden" onClick={() => setMenuOpen(false)}>
                      🛒 장바구니
                    </Link>
                    <Link href="/orders" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:hidden" onClick={() => setMenuOpen(false)}>
                      📦 주문내역
                    </Link>
                    {isAdmin() && (
                      <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50" onClick={() => setMenuOpen(false)}>
                        ⚙️ 관리자
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                    >
                      🚪 로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-slate-600 hover:text-indigo-600 font-medium px-4 py-2">
                  로그인
                </Link>
                <Link
                  href="/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-full transition-colors"
                >
                  회원가입
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
