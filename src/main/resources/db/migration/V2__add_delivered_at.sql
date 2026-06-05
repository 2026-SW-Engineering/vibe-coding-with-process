-- 7일 환불 기한 계산을 위해 배송완료 시점을 별도 컬럼으로 기록
ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMP;
