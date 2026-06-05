"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api, type OrderDetail } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  paid:               { label: "결제완료",   color: "text-blue-600 bg-blue-50",     icon: "💳" },
  preparing:          { label: "배송준비",   color: "text-amber-600 bg-amber-50",   icon: "📦" },
  shipping:           { label: "배송중",     color: "text-orange-600 bg-orange-50", icon: "🚚" },
  delivered:          { label: "배송완료",   color: "text-emerald-600 bg-emerald-50", icon: "✅" },
  cancelled:          { label: "취소완료",   color: "text-slate-500 bg-slate-50",   icon: "❌" },
  refund_requested:   { label: "환불요청",   color: "text-purple-600 bg-purple-50", icon: "↩️" },
  partially_refunded: { label: "부분환불",   color: "text-teal-600 bg-teal-50",     icon: "🔄" },
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
    try {
      const data = await api.orders.get(Number(id));
      setOrder(data);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleCancel = async () => {
    if (!confirm("정말로 주문을 취소하시겠습니까?")) return;
    setCancelling(true);
    try {
      await api.orders.cancel(Number(id));
      showToast("주문이 취소되었습니다");
      loadOrder();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "취소에 실패했습니다");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="bg-white h-24 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="text-center py-20"><p className="text-xl text-slate-500">주문을 찾을 수 없습니다</p></div>
      </div>
    );
  }

  const st = STATUS_MAP[order.status] || { label: order.status, color: "text-slate-600 bg-slate-50", icon: "📋" };
  const canCancel = ["paid", "preparing"].includes(order.status);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/orders")} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-slate-800">주문 #{order.id}</h1>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${st.color}`}>
            {st.icon} {st.label}
          </span>
        </div>

        <div className="space-y-4">
          {/* Order Items */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-700 mb-4">주문 상품</h2>
            <div className="space-y-3">
              {order.items.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="font-medium text-slate-800">{item.product_name}</p>
                    <p className="text-sm text-slate-400">₩{item.unit_price.toLocaleString()} × {item.quantity}개</p>
                  </div>
                  <p className="font-bold text-slate-800">₩{item.subtotal.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center text-sm text-slate-500 mb-2">
              <span>상품 합계</span>
              <span>₩{order.total_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-500 mb-3">
              <span>배송비</span>
              <span className="text-emerald-600">무료</span>
            </div>
            <div className="flex justify-between items-center font-bold text-lg border-t border-slate-100 pt-3">
              <span>총 결제금액</span>
              <span className="text-indigo-600">₩{order.total_amount.toLocaleString()}</span>
            </div>
          </div>

          {/* Order Info */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-sm text-slate-600">
            <h2 className="font-bold text-slate-700 mb-3">주문 정보</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">주문일시</span>
                <span>{new Date(order.created_at).toLocaleString("ko-KR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">최종 업데이트</span>
                <span>{new Date(order.updated_at).toLocaleString("ko-KR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">주문 상태</span>
                <span className={`font-semibold ${st.color.split(" ")[0]}`}>{st.label}</span>
              </div>
            </div>
          </div>

          {/* Refund Requests */}
          {order.refund_requests.length > 0 && (
            <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
              <h2 className="font-bold text-purple-700 mb-3">환불 요청</h2>
              {order.refund_requests.map(r => (
                <div key={r.id} className="flex justify-between text-sm text-purple-700">
                  <span>환불 요청 #{r.id} ({r.quantity}개)</span>
                  <span className="font-bold">
                    {r.status === "pending" ? "심사중" : r.status === "approved" ? "승인됨" : "거부됨"} — ₩{r.refund_amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl border border-red-200 transition-colors"
            >
              {cancelling ? "취소 처리 중..." : "주문 취소"}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
