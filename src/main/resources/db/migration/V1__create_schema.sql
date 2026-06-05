CREATE TABLE users (
    user_id    BIGSERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name       VARCHAR(100) NOT NULL,
    role       VARCHAR(20)  NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    product_id    BIGSERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    current_price INTEGER      NOT NULL,
    stock         INTEGER      NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT products_stock_non_negative CHECK (stock >= 0)
);

-- 회원 1명 = 카트 1개 (UNIQUE 제약으로 보장)
CREATE TABLE carts (
    cart_id    BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL UNIQUE REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart_items (
    cart_item_id    BIGSERIAL PRIMARY KEY,
    cart_id         BIGINT    NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
    product_id      BIGINT    NOT NULL REFERENCES products(product_id),
    quantity        INTEGER   NOT NULL,
    price_at_add_time INTEGER NOT NULL,
    added_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    order_id     BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(user_id),
    total_amount INTEGER      NOT NULL,
    status       VARCHAR(30)  NOT NULL,
    address      VARCHAR(500),
    phone        VARCHAR(20),
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    order_item_id   BIGSERIAL   PRIMARY KEY,
    order_id        BIGINT      NOT NULL REFERENCES orders(order_id),
    product_id      BIGINT      NOT NULL REFERENCES products(product_id),
    quantity        INTEGER     NOT NULL,
    confirmed_price INTEGER     NOT NULL,
    item_status     VARCHAR(20) NOT NULL DEFAULT 'ORDERED',
    created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 주문 1개당 결제 1건 (UNIQUE 제약)
CREATE TABLE payments (
    payment_id     BIGSERIAL   PRIMARY KEY,
    order_id       BIGINT      NOT NULL UNIQUE REFERENCES orders(order_id),
    amount         INTEGER     NOT NULL,
    status         VARCHAR(20) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'mock',
    paid_at        TIMESTAMP
);

-- Refund는 부분환불 전용 (full_cancel 제거)
CREATE TABLE refunds (
    refund_id    BIGSERIAL    PRIMARY KEY,
    order_id     BIGINT       NOT NULL REFERENCES orders(order_id),
    user_id      BIGINT       NOT NULL REFERENCES users(user_id),
    refund_amount INTEGER     NOT NULL DEFAULT 0,
    type         VARCHAR(30)  NOT NULL DEFAULT 'partial_refund',
    status       VARCHAR(20)  NOT NULL,
    reason       VARCHAR(500),
    requested_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE TABLE refund_items (
    refund_item_id   BIGSERIAL PRIMARY KEY,
    refund_id        BIGINT    NOT NULL REFERENCES refunds(refund_id),
    order_item_id    BIGINT    NOT NULL REFERENCES order_items(order_item_id),
    quantity_to_refund INTEGER NOT NULL,
    refund_amount    INTEGER   NOT NULL
);
