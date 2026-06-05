"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api, type Order } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  paid:               { label: "결제완료",   color: "bg-blue-100 text-blue-700" },
  preparing:          { label: "배송준비",   color: "bg-amber-100 text-amber-700" },
  shipping:           { label: "배송중",     color: "bg-orange-100 text-orange-700" },
  delivered:          { label: "배송완료",   color: "bg-emerald-100 text-emerald-700" },
  cancelled:          { label: "취소완료",   color: "bg-slate-100 text-slate-500" },
  refund_requested:   { label: "환불요청",   color: "bg-purple-100 text-purple-700" },
  partially_refunded: { label: "부분환불",   color: "bg-teal-100 text-teal-700" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.orders.list().then(data => { setOrders(data); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">주문내역</h1>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="bg-white h-32 rounded-2xl animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">📦</p>
            <p className="text-xl font-semibold text-slate-600 mb-2">주문 내역이 없습니다</p>
            <button onClick={() => router.push("/")} className="bg-indigo-600 text-white px-6 py-3 rounded-full font-medium mt-4">
              쇼핑하러 가기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const st = STATUS_MAP[order.status] || { label: order.status, color: "bg-slate-100 text-slate-600" };
              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-800">주문 #{order.id}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(order.created_at).toLocaleDateString("ko-KR", {
                            year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="text-sm text-slate-600 mb-3">
                      {order.items.slice(0, 2).map(item => (
                        <p key={item.id} className="truncate">• {item.product_name} × {item.quantity}</p>
                      ))}
                      {order.items.length > 2 && <p className="text-slate-400">외 {order.items.length - 2}개</p>}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                      <span className="text-sm text-slate-500">상품 {order.items_count}개</span>
                      <span className="font-bold text-indigo-600">₩{order.total_amount.toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
