"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api, type CartItem } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadCart();
  }, []);

  const loadCart = async () => {
    setLoading(true);
    try {
      const cart = await api.cart.get();
      setItems(cart.items);
      setTotal(cart.total);
      setSelected(new Set(cart.items.map(i => i.id)));
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleQuantityChange = async (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await handleRemove(item.id);
      return;
    }
    if (newQty > item.product.stock) {
      showToast("재고가 부족합니다");
      return;
    }
    try {
      await api.cart.update(item.id, newQty);
      loadCart();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "오류가 발생했습니다");
    }
  };

  const handleRemove = async (itemId: number) => {
    try {
      await api.cart.remove(itemId);
      loadCart();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "오류가 발생했습니다");
    }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = items.filter(i => selected.has(i.id));
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.subtotal, 0);

  const handleOrder = async (paymentSuccess: boolean) => {
    setProcessing(true);
    setCheckoutOpen(false);
    try {
      const ids = selectedItems.map(i => i.id);
      const result = await api.orders.create(ids, paymentSuccess);
      if (paymentSuccess) {
        router.push(`/orders/${result.order_id}?success=1`);
      } else {
        showToast("결제가 실패했습니다. 다시 시도해주세요.");
        loadCart();
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "주문에 실패했습니다");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar cartCount={items.length} />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">장바구니</h1>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="bg-white h-24 rounded-2xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">🛒</p>
            <p className="text-xl font-semibold text-slate-600 mb-2">장바구니가 비었습니다</p>
            <p className="text-slate-400 mb-6">마음에 드는 상품을 담아보세요</p>
            <button onClick={() => router.push("/")} className="bg-indigo-600 text-white px-6 py-3 rounded-full font-medium">
              쇼핑 계속하기
            </button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-5 h-5 mt-1 accent-indigo-600 cursor-pointer"
                    />
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      🛍️
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{item.product.name}</p>
                      <p className="text-sm text-slate-500">{item.product.category}</p>
                      <p className="text-indigo-600 font-bold mt-1">₩{item.product.price.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => handleRemove(item.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleQuantityChange(item, -1)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-600 transition-colors">−</button>
                        <span className="w-6 text-center font-semibold">{item.quantity}</span>
                        <button onClick={() => handleQuantityChange(item, 1)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-600 transition-colors">+</button>
                      </div>
                      <p className="font-bold text-slate-800">₩{item.subtotal.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:w-72">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm sticky top-20">
                <h3 className="font-bold text-slate-800 mb-4">주문 요약</h3>
                <div className="space-y-2 text-sm text-slate-600 mb-4">
                  <div className="flex justify-between">
                    <span>선택 상품 ({selectedItems.length}개)</span>
                    <span>₩{selectedTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>배송비</span>
                    <span className="text-emerald-600 font-medium">무료</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-slate-800 text-base">
                    <span>총 결제금액</span>
                    <span className="text-indigo-600">₩{selectedTotal.toLocaleString()}</span>
                  </div>
                </div>
                <button
                  disabled={selectedItems.length === 0 || processing}
                  onClick={() => setCheckoutOpen(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  {processing ? "처리 중..." : `주문하기 (${selectedItems.length}개)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800 mb-2">결제 시뮬레이션</h2>
            <p className="text-slate-500 text-sm mb-6">
              결제 결과를 선택하세요 (실제 결제는 없습니다)
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-6 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>결제 금액</span>
                <span className="font-bold text-slate-800">₩{selectedTotal.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCheckoutOpen(false)}
                className="flex-1 bg-slate-100 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleOrder(false)}
                className="flex-1 bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
              >
                결제 실패
              </button>
              <button
                onClick={() => handleOrder(true)}
                className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
              >
                결제 성공
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
