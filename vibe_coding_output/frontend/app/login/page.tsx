"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.auth.login({ email, password });
      setAuth(res.access_token, res.user as { id: number; email: string; name: string; role: "user" | "admin" });
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-1">
            <span className="text-2xl font-black text-[#1A1A1A]">VIBE</span>
            <span className="text-2xl font-black text-[#E53935]">MALL</span>
          </Link>
        </div>

        <div className="bg-white border border-[#E0E0E0] p-8">
          <h1 className="text-lg font-bold text-[#1A1A1A] mb-5">로그인</h1>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#444] mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="example@email.com"
                className="w-full px-3 py-2.5 border border-[#D8D8D8] text-sm outline-none focus:border-[#1A1A1A] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#444] mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="비밀번호 입력"
                className="w-full px-3 py-2.5 border border-[#D8D8D8] text-sm outline-none focus:border-[#1A1A1A] transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-[#E53935] bg-[#FFF5F5] border border-[#FFCDD2] px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1A1A] hover:bg-[#333] disabled:bg-[#AAA] text-white font-bold py-2.5 text-sm transition-colors"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <div className="mt-5 p-3 bg-[#F8F8F8] border border-[#EBEBEB] text-xs text-[#666]">
            <p className="font-semibold text-[#444] mb-1">테스트 계정</p>
            <p>일반: user@shop.com / user123</p>
            <p>관리자: admin@shop.com / admin123</p>
          </div>

          <p className="mt-5 text-center text-xs text-[#888]">
            계정이 없으신가요?{" "}
            <Link href="/register" className="text-[#E53935] font-semibold hover:underline">회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
