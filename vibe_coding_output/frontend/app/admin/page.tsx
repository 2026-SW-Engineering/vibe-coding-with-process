"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api, type AdminOrder, type RefundItem, type Product } from "@/lib/api";
import { isAdmin, isLoggedIn } from "@/lib/auth";

const STATUS_LABELS: Record<string, string> = {
  paid: "결제완료", preparing: "배송준비", shipping: "배송중",
  delivered: "배송완료", cancelled: "취소완료",
  refund_requested: "환불요청", partially_refunded: "부분환불",
};
const STATUS_COLORS: Record<string, string> = {
  paid: "text-[#1565C0] bg-[#E3F2FD]",
  preparing: "text-[#E65100] bg-[#FFF3E0]",
  shipping: "text-[#BF360C] bg-[#FBE9E7]",
  delivered: "text-[#2E7D32] bg-[#E8F5E9]",
  cancelled: "text-[#666] bg-[#F5F5F5]",
  refund_requested: "text-[#6A1B9A] bg-[#F3E5F5]",
  partially_refunded: "text-[#00695C] bg-[#E0F2F1]",
};

type TabType = "orders" | "refunds" | "products";

export default function AdminPage() {
  const [tab, setTab] = useState<TabType>("orders");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrice, setEditingPrice] = useState<{ id: number; value: string } | null>(null);
  const [toast, setToast] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn() || !isAdmin()) { router.push("/"); return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [o, r, p] = await Promise.all([api.admin.orders(), api.admin.refunds(), api.products.list()]);
      setOrders(o); setRefunds(r); setProducts(p);
    } finally { setLoading(false); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const handle = (fn: () => Promise<unknown>, msg: string) => async () => {
    try { await fn(); showToast(msg); loadAll(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "오류가 발생했습니다"); }
  };

  const handleUpdatePrice = async (productId: number) => {
    if (!editingPrice || editingPrice.id !== productId) return;
    const price = parseFloat(editingPrice.value);
    if (isNaN(price) || price <= 0) { showToast("올바른 가격을 입력하세요"); return; }
    try { await api.admin.updatePrice(productId, price); showToast("가격이 업데이트되었습니다"); setEditingPrice(null); loadAll(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "오류가 발생했습니다"); }
  };

  const tabs: [TabType, string][] = [["orders", "주문 관리"], ["refunds", "환불 관리"], ["products", "상품 관리"]];

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Navbar />
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-5">
          <h1 className="text-lg font-bold text-[#1A1A1A]">관리자</h1>
          <span className="bg-[#E53935] text-white text-[10px] font-bold px-2 py-0.5">ADMIN</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E0E0E0] mb-5">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                tab === key ? "border-[#E53935] text-[#E53935]" : "border-transparent text-[#666] hover:text-[#1A1A1A]"
              }`}>
              {label}
              {key === "refunds" && refunds.length > 0 && (
                <span className="ml-1.5 bg-[#E53935] text-white text-[10px] px-1.5 py-0.5 rounded-full">{refunds.length}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="bg-white h-12 border border-[#E8E8E8] animate-pulse" />)}</div>
        ) : (
          <>
            {/* Orders Tab */}
            {tab === "orders" && (
              <div className="bg-white border border-[#E8E8E8] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F8F8F8] border-b border-[#EBEBEB]">
                      <tr>{["주문번호","고객","상태","금액","상품","주문일","처리"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[#555] font-semibold">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F5]">
                      {orders.map(o => (
                        <tr key={o.id} className="hover:bg-[#FAFAFA]">
                          <td className="px-4 py-3 font-bold text-[#444]">#{o.id}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#1A1A1A]">{o.user_name}</p>
                            <p className="text-[#999]">{o.user_email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 ${STATUS_COLORS[o.status] || "text-[#555] bg-[#F5F5F5]"}`}>
                              {STATUS_LABELS[o.status] || o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-[#1A1A1A]">₩{o.total_amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-[#555]">{o.items_count}개</td>
                          <td className="px-4 py-3 text-[#999]">{new Date(o.created_at).toLocaleDateString("ko-KR")}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {o.status === "paid" && (
                                <button onClick={handle(() => api.admin.ship(o.id), "출고 처리되었습니다")}
                                  className="border border-[#E65100] text-[#E65100] text-[10px] font-bold px-2.5 py-1 hover:bg-[#FFF3E0]">출고</button>
                              )}
                              {["preparing", "shipping"].includes(o.status) && (
                                <button onClick={handle(() => api.admin.deliver(o.id), "배송완료 처리되었습니다")}
                                  className="border border-[#2E7D32] text-[#2E7D32] text-[10px] font-bold px-2.5 py-1 hover:bg-[#E8F5E9]">배송완료</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Refunds Tab */}
            {tab === "refunds" && (
              <div className="bg-white border border-[#E8E8E8] overflow-hidden">
                {refunds.length === 0 ? (
                  <div className="text-center py-16 text-[#999]">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-sm font-medium">대기 중인 환불 요청이 없습니다</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#F8F8F8] border-b border-[#EBEBEB]">
                        <tr>{["환불#","주문#","고객","상품","수량","환불금액","요청일","처리"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[#555] font-semibold">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F5F5]">
                        {refunds.map(r => (
                          <tr key={r.id} className="hover:bg-[#FAFAFA]">
                            <td className="px-4 py-3 font-bold text-[#444]">#{r.id}</td>
                            <td className="px-4 py-3 text-[#555]">#{r.order_id}</td>
                            <td className="px-4 py-3 text-[#555]">{r.user_email}</td>
                            <td className="px-4 py-3 text-[#1A1A1A] font-medium">{r.product_name}</td>
                            <td className="px-4 py-3 text-[#555]">{r.quantity}개</td>
                            <td className="px-4 py-3 font-bold text-[#1A1A1A]">₩{r.refund_amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-[#999]">{new Date(r.created_at).toLocaleDateString("ko-KR")}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <button onClick={handle(() => api.admin.approveRefund(r.id), "환불이 승인되었습니다")}
                                  className="border border-[#2E7D32] text-[#2E7D32] text-[10px] font-bold px-2.5 py-1 hover:bg-[#E8F5E9]">승인</button>
                                <button onClick={handle(() => api.admin.rejectRefund(r.id), "환불이 거부되었습니다")}
                                  className="border border-[#E53935] text-[#E53935] text-[10px] font-bold px-2.5 py-1 hover:bg-[#FFF5F5]">거부</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Products Tab */}
            {tab === "products" && (
              <div className="bg-white border border-[#E8E8E8] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F8F8F8] border-b border-[#EBEBEB]">
                      <tr>{["ID","상품명","카테고리","현재가격","재고","수정"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[#555] font-semibold">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F5]">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-[#FAFAFA]">
                          <td className="px-4 py-3 text-[#999]">#{p.id}</td>
                          <td className="px-4 py-3 font-medium text-[#1A1A1A] max-w-[200px] truncate">{p.name}</td>
                          <td className="px-4 py-3">
                            <span className="bg-[#F0F0F0] text-[#555] text-[10px] px-2 py-0.5 font-medium">{p.category}</span>
                          </td>
                          <td className="px-4 py-3">
                            {editingPrice?.id === p.id ? (
                              <input value={editingPrice.value} onChange={e => setEditingPrice({ id: p.id, value: e.target.value })}
                                onKeyDown={e => e.key === "Enter" && handleUpdatePrice(p.id)}
                                className="w-28 px-2 py-1 border border-[#1A1A1A] text-xs outline-none" autoFocus />
                            ) : (
                              <span className="font-bold text-[#1A1A1A]">₩{p.price.toLocaleString()}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${p.stock === 0 ? "text-[#E53935]" : p.stock <= 5 ? "text-[#E65100]" : "text-[#2E7D32]"}`}>
                              {p.stock}개
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {editingPrice?.id === p.id ? (
                              <div className="flex gap-1">
                                <button onClick={() => handleUpdatePrice(p.id)} className="border border-[#1A1A1A] text-[#1A1A1A] text-[10px] font-bold px-2.5 py-1 hover:bg-[#1A1A1A] hover:text-white">저장</button>
                                <button onClick={() => setEditingPrice(null)} className="border border-[#D8D8D8] text-[#555] text-[10px] font-bold px-2.5 py-1 hover:bg-[#F5F5F5]">취소</button>
                              </div>
                            ) : (
                              <button onClick={() => setEditingPrice({ id: p.id, value: String(p.price) })}
                                className="border border-[#D8D8D8] text-[#555] text-[10px] font-bold px-2.5 py-1 hover:border-[#999]">가격 수정</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white px-5 py-3 text-xs shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
