"use client";
import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import ChatBot from "@/components/ChatBot";
import { api, type Product } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const CATEGORIES = ["전체", "전자기기", "의류", "식품", "뷰티", "홈/리빙"];

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("전체");
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.products.list({ category: category !== "전체" ? category : undefined, search: search || undefined });
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
    const timer = setTimeout(() => loadProducts(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleAddToCart = async (product: Product) => {
    if (!isLoggedIn()) {
      showToast("로그인이 필요합니다");
      return;
    }
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

  const handleAskAI = (product: Product) => {
    setChatMessage(`'${product.name}' 상품 자세히 설명해줘. 어떤 사람에게 좋을까?`);
    setChatOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar cartCount={cartCount} />

      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-14 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">AI가 딱 맞는 상품을 추천해드려요</h1>
          <p className="text-indigo-100 text-lg mb-6">채팅으로 원하는 상품을 물어보세요</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setChatOpen(true)}
              className="bg-white text-indigo-600 font-bold px-6 py-3 rounded-full hover:bg-indigo-50 transition-colors flex items-center gap-2"
            >
              🤖 AI 추천 받기
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md mx-auto">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="상품 검색..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-full font-medium text-sm transition-all ${
                category === cat
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-64 animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-lg font-medium">검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                onAskAI={handleAskAI}
                loading={addingId === product.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Chat Button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-2xl transition-all hover:scale-110 z-30"
        title="AI 쇼핑 어시스턴트"
      >
        🤖
      </button>

      {/* ChatBot */}
      <ChatBot
        isOpen={chatOpen}
        onClose={() => { setChatOpen(false); setChatMessage(""); }}
        initialMessage={chatMessage}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-lg text-sm z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
