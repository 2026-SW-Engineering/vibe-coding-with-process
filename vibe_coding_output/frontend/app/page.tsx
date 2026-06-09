"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import { api, type Product } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const CATEGORIES = ["전체", "전자기기", "의류", "식품", "뷰티", "홈/리빙"];

const BANNERS = [
  { bg: "#1A1A2E", text: "프리미엄 전자기기", sub: "최대 30% 할인", label: "전자기기" },
  { bg: "#1B4332", text: "신선식품 특가전", sub: "오늘만 이 가격", label: "식품" },
  { bg: "#3E1C00", text: "가을 의류 컬렉션", sub: "신상 입고 완료", label: "의류" },
];

export default function HomePage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState(searchParams.get("category") || "전체");
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [bannerIdx, setBannerIdx] = useState(0);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.products.list({
        category: category !== "전체" ? category : undefined,
        search: search || undefined,
      });
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  const loadCartCount = useCallback(async () => {
    if (!isLoggedIn()) return;
    try {
      const cart = await api.cart.get();
      setCartCount(cart.count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadCartCount(); }, [loadCartCount]);

  useEffect(() => {
    const id = setInterval(() => setBannerIdx(i => (i + 1) % BANNERS.length), 4000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleAddToCart = async (product: Product) => {
    if (!isLoggedIn()) { showToast("로그인이 필요합니다"); return; }
    setAddingId(product.id);
    try {
      await api.cart.add(product.id, 1);
      setCartCount(prev => prev + 1);
      showToast(`'${product.name}'을(를) 장바구니에 담았습니다`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "오류가 발생했습니다");
    } finally {
      setAddingId(null);
    }
  };

  const banner = BANNERS[bannerIdx];

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Navbar
        cartCount={cartCount}
        onSearch={q => setSearch(q)}
        searchValue={search}
      />

      {/* Banner */}
      <div
        className="h-36 flex items-center justify-center transition-all duration-700"
        style={{ backgroundColor: banner.bg }}
      >
        <div className="text-center text-white">
          <p className="text-[11px] font-medium tracking-widest text-white/60 uppercase mb-1">{banner.label}</p>
          <h2 className="text-2xl font-bold">{banner.text}</h2>
          <p className="text-white/70 text-sm mt-1">{banner.sub}</p>
        </div>
        <div className="absolute right-8 flex gap-1">
          {BANNERS.map((_, i) => (
            <button key={i} onClick={() => setBannerIdx(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === bannerIdx ? "bg-white w-4" : "bg-white/40"}`} />
          ))}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 py-5">
        {/* Category + sort bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
                  category === cat
                    ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                    : "bg-white text-[#444] border-[#D8D8D8] hover:border-[#999]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#888] flex-shrink-0 ml-3">
            총 <strong className="text-[#1A1A1A]">{products.length}</strong>개 상품
          </p>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#E8E8E8] animate-pulse">
                <div className="aspect-square bg-[#F0F0F0]" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-[#F0F0F0] rounded" />
                  <div className="h-3 bg-[#F0F0F0] rounded w-4/5" />
                  <div className="h-4 bg-[#F0F0F0] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24 text-[#888]">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-base font-medium text-[#555]">검색 결과가 없습니다</p>
            <p className="text-sm mt-1">다른 검색어나 카테고리를 선택해보세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                loading={addingId === product.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white px-5 py-3 text-xs shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
