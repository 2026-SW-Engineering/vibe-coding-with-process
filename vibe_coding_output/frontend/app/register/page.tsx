"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", name: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("비밀번호가 일치하지 않습니다"); return; }
    if (form.password.length < 6) { setError("비밀번호는 6자 이상이어야 합니다"); return; }
    setLoading(true);
    try {
      await api.auth.register({ email: form.email, name: form.name, password: form.password });
      router.push("/login");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "회원가입에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: "name", label: "이름", type: "text", placeholder: "홍길동" },
    { name: "email", label: "이메일", type: "email", placeholder: "example@email.com" },
    { name: "password", label: "비밀번호", type: "password", placeholder: "6자 이상" },
    { name: "confirm", label: "비밀번호 확인", type: "password", placeholder: "비밀번호 재입력" },
  ];

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
          <h1 className="text-lg font-bold text-[#1A1A1A] mb-5">회원가입</h1>

          <form onSubmit={handleSubmit} className="space-y-3">
            {fields.map(f => (
              <div key={f.name}>
                <label className="block text-xs font-semibold text-[#444] mb-1">{f.label}</label>
                <input
                  type={f.type}
                  name={f.name}
                  value={form[f.name as keyof typeof form]}
                  onChange={handleChange}
                  required
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 border border-[#D8D8D8] text-sm outline-none focus:border-[#1A1A1A] transition-colors"
                />
              </div>
            ))}

            {error && (
              <p className="text-xs text-[#E53935] bg-[#FFF5F5] border border-[#FFCDD2] px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1A1A] hover:bg-[#333] disabled:bg-[#AAA] text-white font-bold py-2.5 text-sm transition-colors"
            >
              {loading ? "가입 중..." : "회원가입"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#888]">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-[#E53935] font-semibold hover:underline">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
