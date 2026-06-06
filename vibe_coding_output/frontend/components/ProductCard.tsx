"use client";
import { type Product } from "@/lib/api";

const CATEGORY_ICON: Record<string, string> = {
  전자기기: "💻",
  의류: "👕",
  식품: "🥦",
  뷰티: "💄",
  "홈/리빙": "🏠",
};

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map(i => (
          <svg key={i} className={`w-3 h-3 ${i <= Math.round(score) ? "text-[#FFA000]" : "text-[#DDD]"}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-[11px] text-[#888]">{score.toFixed(1)}</span>
    </div>
  );
}

interface Props {
  product: Product;
  onAddToCart?: (product: Product) => void;
  loading?: boolean;
}

const FAKE_RATINGS: Record<number, number> = {};
function getRating(id: number) {
  if (!FAKE_RATINGS[id]) FAKE_RATINGS[id] = Math.round((3.8 + (id % 12) * 0.1) * 10) / 10;
  return Math.min(FAKE_RATINGS[id], 5.0);
}
const FAKE_REVIEWS = [128, 342, 57, 891, 203, 445, 67, 1203, 89, 567, 234, 78, 456, 123, 789, 321];

export default function ProductCard({ product, onAddToCart, loading }: Props) {
  const icon = CATEGORY_ICON[product.category] || "🛒";
  const rating = getRating(product.id);
  const reviewCount = FAKE_REVIEWS[(product.id - 1) % FAKE_REVIEWS.length];

  return (
    <div className="bg-white border border-[#E8E8E8] hover:border-[#BBBBBB] hover:shadow-sm transition-all duration-150 cursor-pointer group">
      {/* Image area */}
      <div className="relative bg-[#F8F8F8] aspect-square flex items-center justify-center overflow-hidden">
        <span className="text-5xl group-hover:scale-105 transition-transform duration-200">{icon}</span>
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <span className="bg-[#555] text-white text-xs font-bold px-3 py-1">품절</span>
          </div>
        )}
        {product.stock > 0 && product.stock <= 5 && (
          <span className="absolute top-2 left-2 bg-[#E53935] text-white text-[10px] font-bold px-1.5 py-0.5">
            잔여 {product.stock}개
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[#555] text-[11px] mb-0.5">{product.category}</p>
        <p className="text-[#1A1A1A] text-sm font-medium line-clamp-2 leading-snug mb-1.5 min-h-[2.6em]">
          {product.name}
        </p>
        <StarRating score={rating} />
        <p className="text-[11px] text-[#999] mb-2">({reviewCount.toLocaleString()})</p>

        <p className="text-base font-bold text-[#1A1A1A]">
          ₩{product.price.toLocaleString()}
        </p>
        <p className="text-[11px] text-[#2E7D32] font-medium mt-0.5">무료배송</p>

        <button
          onClick={() => onAddToCart?.(product)}
          disabled={product.stock === 0 || loading}
          className="mt-3 w-full border border-[#1A1A1A] text-[#1A1A1A] text-xs font-semibold py-2 hover:bg-[#1A1A1A] hover:text-white disabled:border-[#DDD] disabled:text-[#AAA] disabled:cursor-not-allowed transition-colors"
        >
          {product.stock === 0 ? "품절" : loading ? "담는 중..." : "장바구니 담기"}
        </button>
      </div>
    </div>
  );
}
