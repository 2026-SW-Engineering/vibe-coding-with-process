import { getToken } from "./auth";

const BASE = "http://localhost:8000";

async function req<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "요청에 실패했습니다" }));
    throw new Error(err.detail || "요청에 실패했습니다");
  }
  return res.json();
}

export const api = {
  auth: {
    register: (data: { email: string; name: string; password: string }) =>
      req("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      req<{ access_token: string; user: { id: number; email: string; name: string; role: string } }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify(data) }
      ),
    me: () => req("/api/auth/me"),
  },

  products: {
    list: (params?: { category?: string; search?: string }) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v))
      ).toString();
      return req<Product[]>(`/api/products${qs ? "?" + qs : ""}`);
    },
    get: (id: number) => req<Product>(`/api/products/${id}`),
  },

  cart: {
    get: () => req<CartResponse>("/api/cart"),
    add: (product_id: number, quantity: number) =>
      req("/api/cart", { method: "POST", body: JSON.stringify({ product_id, quantity }) }),
    update: (item_id: number, quantity: number) =>
      req(`/api/cart/${item_id}`, { method: "PUT", body: JSON.stringify({ quantity }) }),
    remove: (item_id: number) => req(`/api/cart/${item_id}`, { method: "DELETE" }),
    clear: () => req("/api/cart", { method: "DELETE" }),
  },

  orders: {
    create: (cart_item_ids: number[], payment_success: boolean) =>
      req<{ message: string; order_id: number; status: string }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ cart_item_ids, payment_success }),
      }),
    list: () => req<Order[]>("/api/orders"),
    get: (id: number) => req<OrderDetail>(`/api/orders/${id}`),
    cancel: (id: number) => req(`/api/orders/${id}/cancel`, { method: "POST" }),
    refundRequest: (id: number, items: { order_item_id: number; quantity: number }[]) =>
      req(`/api/orders/${id}/refund-request`, { method: "POST", body: JSON.stringify({ items }) }),
  },

  admin: {
    orders: () => req<AdminOrder[]>("/api/admin/orders"),
    ship: (id: number) => req(`/api/admin/orders/${id}/ship`, { method: "POST" }),
    deliver: (id: number) => req(`/api/admin/orders/${id}/deliver`, { method: "POST" }),
    updatePrice: (id: number, price: number) =>
      req(`/api/admin/products/${id}/price`, { method: "PUT", body: JSON.stringify({ price }) }),
    refunds: () => req<RefundItem[]>("/api/admin/refunds"),
    approveRefund: (id: number) => req(`/api/admin/refunds/${id}/approve`, { method: "POST" }),
    rejectRefund: (id: number) => req(`/api/admin/refunds/${id}/reject`, { method: "POST" }),
  },

  chat: {
    send: (messages: { role: string; content: string }[], session_id: string) =>
      req<ChatResponse>("/api/chat", { method: "POST", body: JSON.stringify({ messages, session_id }) }),
    usage: (session_id: string) => req<TokenUsage>(`/api/chat/usage/${session_id}`),
  },
};

// Types
export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: string;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  product: Product;
  subtotal: number;
}

export interface CartResponse {
  items: CartItem[];
  total: number;
  count: number;
}

export interface Order {
  id: number;
  status: string;
  total_amount: number;
  created_at: string;
  items_count: number;
  items: { id: number; product_name: string; unit_price: number; quantity: number }[];
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderDetail {
  id: number;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  refund_requests: {
    id: number;
    order_item_id: number;
    quantity: number;
    refund_amount: number;
    status: string;
    created_at: string;
  }[];
}

export interface AdminOrder {
  id: number;
  user_email: string;
  user_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  items_count: number;
}

export interface RefundItem {
  id: number;
  order_id: number;
  product_name: string;
  quantity: number;
  refund_amount: number;
  status: string;
  created_at: string;
  user_email: string;
}

export interface ChatResponse {
  reply: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
}

export interface TokenUsage {
  session_id: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
  estimated_cost_usd: number;
  message_count: number;
}
