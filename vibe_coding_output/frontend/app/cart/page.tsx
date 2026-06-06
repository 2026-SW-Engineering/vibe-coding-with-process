"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api, type CartItem } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
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
      setSelected(new Set(cart.items.map(i => i.id)));
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const handleQuantityChange = async (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) { await handleRemove(item.id); return; }
    if (newQty > item.product.stock) { showToast("재고가 부족합니다"); return; }
    try { await api.cart.update(item.id, newQty); loadCart(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "오류가 발생했습니다"); }
  };

  const handleRemove = async (itemId: number) => {
    try { await api.cart.remove(itemId); loadCart(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "오류가 발생했습니다"); }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleAll = () => {
    setSelected(selected.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  };

  const selectedItems = items.filter(i => selected.has(i.id));
  const selectedTotal = selectedItems.reduce((s, i) => s + i.subtotal, 0);

  const handleOrder = async (paymentSuccess: boolean) => {
    setProcessing(true);
    setCheckoutOpen(false);
    try {
      const result = await api.orders.create(selectedItems.map(i => i.id), paymentSuccess);
      if (paymentSuccess) router.push(`/orders/${result.order_id}?success=1`);
      else { showToast("결제가 실패했습니다. 다시 시도해주세요."); loadCart(); }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "주문에 실패했습니다");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Navbar cartCount={items.length} />
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <h1 className="text-lg font-bold text-[#1A1A1A] mb-4">장바구니</h1>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white h-24 border border-[#E8E8E8] animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 bg-white border border-[#E8E8E8]">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-base font-semibold text-[#555] mb-1">장바구니가 비었습니다</p>
            <p className="text-sm text-[#999] mb-5">마음에 드는 상품을 담아보세요</p>
            <button onClick={() => router.push("/")} className="bg-[#1A1A1A] text-white text-sm font-bold px-6 py-2.5">쇼핑 계속하기</button>
          </div>
        ) : (
          <div className="flex gap-5 items-start">
            {/* Items */}
            <div className="flex-1">
              {/* Select all */}
              <div className="bg-white border border-[#E8E8E8] px-4 py-3 flex items-center gap-3 mb-0.5">
                <input type="checkbox" checked={selected.size === items.length} onChange={toggleAll} className="w-4 h-4 accent-[#1A1A1A] cursor-pointer" />
                <span className="text-xs text-[#555] font-medium">전체선택 ({selected.size}/{items.length})</span>
              </div>

              {items.map(item => (
                <div key={item.id} className="bg-white border border-[#E8E8E8] border-t-0 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 accent-[#1A1A1A] cursor-pointer flex-shrink-0" />
                    <div className="w-16 h-16 bg-[#F8F8F8] border border-[#EBEBEB] flex items-center justify-center text-2xl flex-shrink-0">🛍️</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A] truncate">{item.product.name}</p>
                      <p className="text-xs text-[#888] mt-0.5">{item.product.category}</p>
                      <p className="text-sm font-bold text-[#1A1A1A] mt-1">₩{item.product.price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center border border-[#D8D8D8]">
                        <button onClick={() => handleQuantityChange(item, -1)} className="w-7 h-7 text-[#555] hover:bg-[#F5F5F5] text-lg leading-none">−</button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => handleQuantityChange(item, 1)} className="w-7 h-7 text-[#555] hover:bg-[#F5F5F5] text-lg leading-none">+</button>
                      </div>
                      <p className="w-24 text-right text-sm font-bold text-[#1A1A1A]">₩{item.subtotal.toLocaleString()}</p>
                      <button onClick={() => handleRemove(item.id)} className="text-[#CCC] hover:text-[#888] ml-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white border border-[#E8E8E8] p-5 sticky top-24">
                <h3 className="text-sm font-bold text-[#1A1A1A] mb-4 pb-3 border-b border-[#F0F0F0]">결제 정보</h3>
                <div className="space-y-2 text-xs text-[#555] mb-4">
                  <div className="flex justify-between"><span>상품금액</span><span>₩{selectedTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>배송비</span><span className="text-[#2E7D32]">무료</span></div>
                </div>
                <div className="border-t border-[#F0F0F0] pt-3 flex justify-between font-bold text-sm text-[#1A1A1A] mb-4">
                  <span>총 결제금액</span>
                  <span className="text-[#E53935]">₩{selectedTotal.toLocaleString()}</span>
                </div>
                <button
                  disabled={selectedItems.length === 0 || processing}
                  onClick={() => setCheckoutOpen(true)}
                  className="w-full bg-[#E53935] hover:bg-[#C62828] disabled:bg-[#DDD] disabled:text-[#AAA] text-white font-bold py-3 text-sm transition-colors"
                >
                  {processing ? "처리 중..." : `구매하기 (${selectedItems.length}개)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-7 max-w-sm w-full shadow-xl">
            <h2 className="text-base font-bold text-[#1A1A1A] mb-1">결제 시뮬레이션</h2>
            <p className="text-xs text-[#888] mb-5">결제 결과를 직접 선택합니다 (실제 결제 없음)</p>
            <div className="bg-[#F8F8F8] border border-[#EBEBEB] rounded px-4 py-3 mb-5 flex justify-between text-sm">
              <span className="text-[#555]">결제 금액</span>
              <span className="font-bold text-[#1A1A1A]">₩{selectedTotal.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCheckoutOpen(false)} className="flex-1 border border-[#D8D8D8] text-[#555] text-sm font-medium py-2.5 hover:bg-[#F5F5F5]">취소</button>
              <button onClick={() => handleOrder(false)} className="flex-1 border border-[#E53935] text-[#E53935] text-sm font-bold py-2.5 hover:bg-[#FFF5F5]">결제 실패</button>
              <button onClick={() => handleOrder(true)} className="flex-1 bg-[#E53935] text-white text-sm font-bold py-2.5 hover:bg-[#C62828]">결제 성공</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white px-5 py-3 text-xs shadow-lg z-50 whitespace-nowrap">{toast}</div>
      )}
    </div>
  );
}
