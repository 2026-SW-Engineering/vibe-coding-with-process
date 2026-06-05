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
  paid: "bg-blue-100 text-blue-700",
  preparing: "bg-amber-100 text-amber-700",
  shipping: "bg-orange-100 text-orange-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
  refund_requested: "bg-purple-100 text-purple-700",
  partially_refunded: "bg-teal-100 text-teal-700",
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
      setOrders(o);
      setRefunds(r);
      setProducts(p);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleShip = async (orderId: number) => {
    try {
      await api.admin.ship(orderId);
      showToast("출고 처리되었습니다");
      loadAll();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "오류가 발생했습니다");
    }
  };

  const handleDeliver = async (orderId: number) => {
    try {
      await api.admin.deliver(orderId);
      showToast("배송완료 처리되었습니다");
      loadAll();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "오류가 발생했습니다");
    }
  };

  const handleApproveRefund = async (id: number) => {
    try {
      await api.admin.approveRefund(id);
      showToast("환불이 승인되었습니다");
      loadAll();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "오류가 발생했습니다");
    }
  };

  const handleRejectRefund = async (id: number) => {
    try {
      await api.admin.rejectRefund(id);
      showToast("환불이 거부되었습니다");
      loadAll();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "오류가 발생했습니다");
    }
  };

  const handleUpdatePrice = async (productId: number) => {
    if (!editingPrice || editingPrice.id !== productId) return;
    const price = parseFloat(editingPrice.value);
    if (isNaN(price) || price <= 0) { showToast("올바른 가격을 입력하세요"); return; }
    try {
      await api.admin.updatePrice(productId, price);
      showToast("가격이 업데이트되었습니다");
      setEditingPrice(null);
      loadAll();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "오류가 발생했습니다");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">관리자 페이지</h1>
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">ADMIN</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-200 p-1 rounded-xl w-fit mb-6">
          {([["orders", "주문 관리"], ["refunds", "환불 관리"], ["products", "상품 관리"]] as [TabType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${tab === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {label}
              {key === "refunds" && refunds.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{refunds.length}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="bg-white h-16 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Orders Tab */}
            {tab === "orders" && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["주문 #", "고객", "상태", "금액", "상품수", "주문일", "액션"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-slate-500 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {orders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-700">#{order.id}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{order.user_name}</p>
                            <p className="text-slate-400 text-xs">{order.user_email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600"}`}>
                              {STATUS_LABELS[order.status] || order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">₩{order.total_amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-slate-600">{order.items_count}개</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {new Date(order.created_at).toLocaleDateString("ko-KR")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              {order.status === "paid" && (
                                <button onClick={() => handleShip(order.id)} className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-200 transition-colors">
                                  출고
                                </button>
                              )}
                              {["preparing", "shipping"].includes(order.status) && (
                                <button onClick={() => handleDeliver(order.id)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors">
                                  배송완료
                                </button>
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
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {refunds.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <p className="text-4xl mb-2">✅</p>
                    <p className="font-medium">대기 중인 환불 요청이 없습니다</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {["환불 #", "주문 #", "고객", "상품", "수량", "환불금액", "요청일", "액션"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-slate-500 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {refunds.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-slate-700">#{r.id}</td>
                            <td className="px-4 py-3 text-slate-600">#{r.order_id}</td>
                            <td className="px-4 py-3 text-slate-600">{r.user_email}</td>
                            <td className="px-4 py-3 text-slate-800">{r.product_name}</td>
                            <td className="px-4 py-3 text-slate-600">{r.quantity}개</td>
                            <td className="px-4 py-3 font-bold text-slate-800">₩{r.refund_amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs">
                              {new Date(r.created_at).toLocaleDateString("ko-KR")}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5">
                                <button onClick={() => handleApproveRefund(r.id)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors">
                                  승인
                                </button>
                                <button onClick={() => handleRejectRefund(r.id)} className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 transition-colors">
                                  거부
                                </button>
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
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["ID", "상품명", "카테고리", "가격", "재고", "액션"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-slate-500 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-400">#{p.id}</td>
                          <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">{p.name}</td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">{p.category}</span>
                          </td>
                          <td className="px-4 py-3">
                            {editingPrice?.id === p.id ? (
                              <input
                                value={editingPrice.value}
                                onChange={e => setEditingPrice({ id: p.id, value: e.target.value })}
                                onKeyDown={e => e.key === "Enter" && handleUpdatePrice(p.id)}
                                className="w-28 px-2 py-1 border border-indigo-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
                                autoFocus
                              />
                            ) : (
                              <span className="font-bold text-indigo-600">₩{p.price.toLocaleString()}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${p.stock === 0 ? "text-red-500" : p.stock <= 5 ? "text-amber-500" : "text-emerald-600"}`}>
                              {p.stock}개
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {editingPrice?.id === p.id ? (
                              <div className="flex gap-1.5">
                                <button onClick={() => handleUpdatePrice(p.id)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors">
                                  저장
                                </button>
                                <button onClick={() => setEditingPrice(null)} className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingPrice({ id: p.id, value: String(p.price) })}
                                className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                              >
                                가격 수정
                              </button>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
