"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api, type OrderDetail } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  paid:               { label: "결제완료",   color: "text-[#1565C0] bg-[#E3F2FD]" },
  preparing:          { label: "배송준비",   color: "text-[#E65100] bg-[#FFF3E0]" },
  shipping:           { label: "배송중",     color: "text-[#BF360C] bg-[#FBE9E7]" },
  delivered:          { label: "배송완료",   color: "text-[#2E7D32] bg-[#E8F5E9]" },
  cancelled:          { label: "취소완료",   color: "text-[#666] bg-[#F5F5F5]" },
  refund_requested:   { label: "환불요청",   color: "text-[#6A1B9A] bg-[#F3E5F5]" },
  partially_refunded: { label: "부분환불",   color: "text-[#00695C] bg-[#E0F2F1]" },
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try { setOrder(await api.orders.get(Number(id))); }
    finally { setLoading(false); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleCancel = async () => {
    if (!confirm("주문을 취소하시겠습니까?")) return;
    setCancelling(true);
    try { await api.orders.cancel(Number(id)); showToast("주문이 취소되었습니다"); loadOrder(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "취소에 실패했습니다"); }
    finally { setCancelling(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F5F5F5]"><Navbar />
      <div className="max-w-[800px] mx-auto px-4 py-6 space-y-3">
        {[1,2,3].map(i => <div key={i} className="bg-white h-24 border border-[#E8E8E8] animate-pulse" />)}
      </div>
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-[#F5F5F5]"><Navbar />
      <div className="text-center py-20"><p className="text-[#555]">주문을 찾을 수 없습니다</p></div>
    </div>
  );

  const st = STATUS_MAP[order.status] || { label: order.status, color: "text-[#555] bg-[#F5F5F5]" };
  const canCancel = ["paid", "preparing"].includes(order.status);

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Navbar />
      <div className="max-w-[800px] mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.push("/orders")} className="text-[#888] hover:text-[#444]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[#1A1A1A]">주문 상세</h1>
          <span className={`text-[11px] font-bold px-2 py-0.5 ${st.color}`}>{st.label}</span>
        </div>

        <div className="space-y-3">
          {/* Items */}
          <div className="bg-white border border-[#E8E8E8] p-5">
            <h2 className="text-sm font-bold text-[#1A1A1A] mb-3 pb-2 border-b border-[#F0F0F0]">주문 상품</h2>
            <div className="divide-y divide-[#F5F5F5]">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-[#1A1A1A]">{item.product_name}</p>
                    <p className="text-xs text-[#888] mt-0.5">₩{item.unit_price.toLocaleString()} × {item.quantity}개</p>
                  </div>
                  <p className="font-bold text-[#1A1A1A]">₩{item.subtotal.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white border border-[#E8E8E8] p-5">
            <div className="space-y-1.5 text-xs text-[#555]">
              <div className="flex justify-between"><span>상품 합계</span><span>₩{order.total_amount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>배송비</span><span className="text-[#2E7D32]">무료</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#F0F0F0] flex justify-between text-sm font-bold text-[#1A1A1A]">
              <span>총 결제금액</span>
              <span className="text-[#E53935]">₩{order.total_amount.toLocaleString()}</span>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white border border-[#E8E8E8] p-5 text-xs text-[#555] space-y-1.5">
            <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">주문 정보</h2>
            <div className="flex justify-between"><span className="text-[#999]">주문번호</span><span>#{order.id}</span></div>
            <div className="flex justify-between"><span className="text-[#999]">주문일시</span><span>{new Date(order.created_at).toLocaleString("ko-KR")}</span></div>
            <div className="flex justify-between"><span className="text-[#999]">주문상태</span><span className={`font-semibold px-2 py-0.5 ${st.color}`}>{st.label}</span></div>
          </div>

          {/* Refunds */}
          {order.refund_requests.length > 0 && (
            <div className="bg-[#F3E5F5] border border-[#CE93D8] p-4 text-xs">
              <p className="font-bold text-[#6A1B9A] mb-2">환불 요청 내역</p>
              {order.refund_requests.map(r => (
                <div key={r.id} className="flex justify-between text-[#6A1B9A]">
                  <span>환불 #{r.id} · {r.quantity}개</span>
                  <span className="font-bold">
                    {r.status === "pending" ? "검토중" : r.status === "approved" ? "승인됨" : "거부됨"} — ₩{r.refund_amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {canCancel && (
            <button onClick={handleCancel} disabled={cancelling}
              className="w-full border border-[#D8D8D8] bg-white text-[#555] hover:border-[#E53935] hover:text-[#E53935] font-semibold py-3 text-sm transition-colors">
              {cancelling ? "취소 처리 중..." : "주문 취소"}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white px-5 py-3 text-xs shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
