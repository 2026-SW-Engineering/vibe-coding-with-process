"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api, type Order } from "@/lib/api";
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.orders.list().then(data => { setOrders(data); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Navbar />
      <div className="max-w-[900px] mx-auto px-4 py-6">
        <h1 className="text-lg font-bold text-[#1A1A1A] mb-4">주문내역</h1>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white h-28 border border-[#E8E8E8] animate-pulse" />)}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24 bg-white border border-[#E8E8E8]">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-base font-semibold text-[#555] mb-1">주문 내역이 없습니다</p>
            <button onClick={() => router.push("/")} className="mt-5 bg-[#1A1A1A] text-white text-sm font-bold px-6 py-2.5">쇼핑하러 가기</button>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(order => {
              const st = STATUS_MAP[order.status] || { label: order.status, color: "text-[#555] bg-[#F5F5F5]" };
              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="bg-white border border-[#E8E8E8] hover:border-[#BBBBBB] p-4 transition-all cursor-pointer">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 ${st.color}`}>{st.label}</span>
                        <p className="text-xs text-[#888] mt-1">
                          {new Date(order.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          {" · "}주문번호 #{order.id}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-[#1A1A1A]">₩{order.total_amount.toLocaleString()}</p>
                    </div>
                    <div className="text-xs text-[#555] space-y-0.5">
                      {order.items.slice(0, 2).map(item => (
                        <p key={item.id} className="truncate">· {item.product_name} × {item.quantity}개</p>
                      ))}
                      {order.items.length > 2 && <p className="text-[#999]">외 {order.items.length - 2}개 상품</p>}
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
