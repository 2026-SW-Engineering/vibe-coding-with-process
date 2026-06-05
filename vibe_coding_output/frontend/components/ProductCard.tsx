"use client";
import { type Product } from "@/lib/api";

const CATEGORY_STYLES: Record<string, { bg: string; icon: string }> = {
  전자기기: { bg: "from-blue-400 to-indigo-500", icon: "💻" },
  의류: { bg: "from-purple-400 to-pink-500", icon: "👕" },
  식품: { bg: "from-emerald-400 to-teal-500", icon: "🍎" },
  뷰티: { bg: "from-pink-400 to-rose-500", icon: "✨" },
  "홈/리빙": { bg: "from-orange-400 to-amber-500", icon: "🏠" },
};

interface Props {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onAskAI?: (product: Product) => void;
  loading?: boolean;
}

export default function ProductCard({ product, onAddToCart, onAskAI, loading }: Props) {
  const style = CATEGORY_STYLES[product.category] || { bg: "from-slate-400 to-slate-500", icon: "🛒" };

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group border border-slate-100">
      <div className={`h-44 bg-gradient-to-br ${style.bg} flex items-center justify-center relative`}>
        <span className="text-6xl transform group-hover:scale-110 transition-transform duration-200">
          {style.icon}
        </span>
        <span className="absolute top-3 left-3 bg-white/90 text-xs font-semibold text-slate-600 px-2 py-1 rounded-full">
          {product.category}
        </span>
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-slate-800 font-bold px-3 py-1 rounded-full text-sm">품절</span>
          </div>
        )}
        {product.stock > 0 && product.stock <= 5 && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            잔여 {product.stock}개
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-slate-800 text-sm leading-snug mb-1 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{product.description}</p>
        <p className="text-lg font-bold text-indigo-600 mb-3">
          ₩{product.price.toLocaleString()}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => onAddToCart?.(product)}
            disabled={product.stock === 0 || loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
          >
            {product.stock === 0 ? "품절" : "담기"}
          </button>
          <button
            onClick={() => onAskAI?.(product)}
            title="AI에게 이 상품 물어보기"
            className="flex items-center justify-center w-10 h-9 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl transition-colors"
          >
            🤖
          </button>
        </div>
      </div>
    </div>
  );
}
