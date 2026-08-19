# ThreadMarket — System Design Document

---

## 1. Architecture Overview

**Style**: Modular Monolith  
**Communication**: In-process function calls (sync) + Event Bus for async flows  
**Frontend**: Next.js (SSR for SEO) + React Native (mobile)  
**Deployment**: Single Docker container (MVP), split into services when needed  
**Storage**: PostgreSQL + MongoDB + Redis

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│      Web (Next.js)         Mobile (RN)        Delivery App       │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS/WSS
┌────────────────────────────▼─────────────────────────────────────┐
│                      API Gateway (Same Process)                   │
│                      Express · Rate Limit · CORS                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                      Modular Monolith                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                     Shared Kernel                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │    │
│  │  │ Auth     │  │ Validate │  │ Error    │  │ Types   │ │    │
│  │  │ Middleware│  │ (Zod)    │  │ Handler  │  │         │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │   Auth   │  │  Brand   │  │ Product  │  │  Order   │         │
│  │ Module   │  │ Module   │  │ Module   │  │ Module   │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Payment  │  │Delivery  │  │  Chat    │  │Notif.   │         │
│  │ Module   │  │ Module   │  │ Module   │  │ Module   │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Search   │  │ Ranking  │  │ Review   │  │  Admin   │         │
│  │ Module   │  │ Module   │  │ Module   │  │ Module   │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Wallet   │  │ Dispute  │  │Moderation│  │  Fraud   │         │
│  │ Module   │  │ Module   │  │ Module   │  │ Module   │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  Internal Event Bus                       │    │
│  │       (order.placed, payment.confirmed, delivery.*)       │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                         Data Layer                                │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   PostgreSQL 16   │  │   MongoDB 7   │  │     Redis 7      │    │
│  │  (Orders, Users,  │  │ (Catalog,    │  │ (Cache, Session, │    │
│  │   Finance, Brands)│  │  Chat,       │  │  Cart, Ranking)  │    │
│  │                   │  │  Categories) │  │                  │    │
│  └──────────────────┘  └──────────────┘  └──────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    MinIO/S3                               │    │
│  │              (Product images, verification docs)          │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Breakdown

### 2.1 Auth Module
- **Role**: Authentication, authorization, OTP, token management
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | POST | `/api/v1/auth/register` | Register (phone + password) |
  | POST | `/api/v1/auth/login` | Login |
  | POST | `/api/v1/auth/verify-otp` | Verify phone |
  | POST | `/api/v1/auth/refresh` | Refresh access token |
  | POST | `/api/v1/auth/logout` | Invalidate session |
- **Storage**: PostgreSQL (`users`, `refresh_tokens`, `otp_codes`)
- **Notes**: SMS OTP primary, JWT access + refresh tokens, bcrypt password hashing

### 2.2 Brand Module
- **Role**: Brand CRUD, verification workflow, subscription tiers
- **Endpoints**:
  | Method | Path | Description | Auth |
  |--------|------|-------------|------|
  | GET | `/api/v1/brands` | List brands (public, ranked) | ✗ |
  | GET | `/api/v1/brands/:id` | Brand profile | ✗ |
  | POST | `/api/v1/brands` | Register brand | Brand |
  | POST | `/api/v1/brands/:id/verify` | Submit verification docs | Admin |
- **Storage**: PostgreSQL (`brands`, `brand_documents`, `brand_subscriptions`)
- **Notes**: Multi-tier verification (Pending → Basic → Trusted), document upload to S3

### 2.3 Product Module
- **Role**: Product CRUD, categories, variants, inventory, bulk CSV
- **Endpoints**:
  | Method | Path | Description | Auth |
  |--------|------|-------------|------|
  | GET | `/api/v1/products` | List products (filtered, paginated) | ✗ |
  | GET | `/api/v1/products/:id` | Product detail with variants | ✗ |
  | POST | `/api/v1/products` | Create product | Brand |
  | PUT | `/api/v1/products/:id` | Update product | Brand |
  | DELETE | `/api/v1/products/:id` | Soft-delete product | Brand |
  | POST | `/api/v1/products/bulk-upload` | CSV bulk upload | Brand |
- **Storage**: PostgreSQL (inventory, SKU, pricing) + MongoDB (catalog, flexible variants)
- **Notes**: Variants (size/color) with per-variant stock, soft-delete, low-stock alerts

### 2.4 Cart Module
- **Role**: Multi-brand cart management
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/cart` | Get current cart |
  | POST | `/api/v1/cart/items` | Add item to cart |
  | DELETE | `/api/v1/cart/items/:id` | Remove item |
  | POST | `/api/v1/cart/checkout` | Checkout → create order |
- **Storage**: Redis (active carts, fast read/write) + PostgreSQL (persisted carts)
- **Notes**: Supports items from multiple brands → split into per-brand sub-orders at checkout

### 2.5 Order Module
- **Role**: Order lifecycle, sub-order splitting, status management
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/orders` | List user's orders |
  | POST | `/api/v1/orders` | Create order (from cart) |
  | GET | `/api/v1/orders/:id` | Order detail + sub-orders |
  | PUT | `/api/v1/orders/:id/status` | Update order status |
  | POST | `/api/v1/orders/:id/cancel` | Cancel order |
- **Storage**: PostgreSQL (`orders`, `sub_orders`, `order_items`, `order_status_history`)
- **Notes**: Order → Sub-Order per brand, each sub-order has its own delivery and status tracking

### 2.6 Payment Module
- **Role**: Stripe (intl), Paymob (local), COD, Fawry, installments, wallet
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | POST | `/api/v1/payments/charge` | Initiate payment |
  | POST | `/api/v1/payments/callback/stripe` | Stripe webhook |
  | POST | `/api/v1/payments/callback/paymob` | Paymob webhook |
  | POST | `/api/v1/payments/refund` | Initiate refund |
  | GET | `/api/v1/payments/payouts/brands/:id` | Brand payout history |
- **Storage**: PostgreSQL (`transactions`, `payment_methods`, `payouts`)
- **Notes**: COD reconciliation, payout engine for brands, webhook signature verification

### 2.7 Delivery Module
- **Role**: Delivery company onboarding, order dispatch, courier assignment
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/delivery/companies` | List delivery companies |
  | POST | `/api/v1/delivery/dispatch` | Dispatch order to delivery co. |
  | PUT | `/api/v1/delivery/assignments/:id/status` | Update delivery status |
  | GET | `/api/v1/delivery/tracking/:subOrderId` | Live tracking |
  | GET | `/api/v1/delivery/zones` | List zones with fees |
- **Storage**: PostgreSQL (`delivery_companies`, `couriers`, `delivery_assignments`, `delivery_zones`)
- **Notes**: Fee calculation by governorate/zone/weight, auto-assignment rules engine

### 2.8 Chat Module
- **Role**: Real-time chat between user ↔ brand
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/chat/conversations` | List conversations |
  | POST | `/api/v1/chat/conversations` | Create conversation |
  | WS | `/ws` | WebSocket for real-time messaging |
- **Storage**: MongoDB (chat history, flexible schema)
- **Notes**: Flagged message moderation, Socket.io for real-time

### 2.9 Notification Module
- **Role**: Push, WhatsApp, SMS, Email
- **Events consumed**: `order.*`, `payment.*`, `delivery.*`, `chat.*`
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/notifications` | User notifications |
  | PUT | `/api/v1/notifications/:id/read` | Mark as read |
- **Storage**: PostgreSQL (`notifications`, `notification_templates`)
- **Notes**: WhatsApp-first for Egypt, SMS OTP fallback, per-user preferences

### 2.10 Search Module
- **Role**: Full-text search for products, brands, categories
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/search/products?q=` | Search products |
  | GET | `/api/v1/search/brands?q=` | Search brands |
- **Storage**: Elasticsearch (indexed from Product/Brand modules via events)
- **Notes**: Arabic stemmer support, faceted search (category, price, rating, verified)

### 2.11 Ranking Module
- **Role**: Brand ranking score calculation
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/ranking/brands` | Ranked brand list |
  | GET | `/api/v1/ranking/score/:brandId` | Brand individual score |
- **Storage**: PostgreSQL (ranking config, weights) + Redis (cached scores)
- **Notes**: Daily scheduled job recalculates scores

### 2.12 Review Module
- **Role**: Product & brand ratings and reviews
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/reviews/products/:id` | Product reviews |
  | GET | `/api/v1/reviews/brands/:id` | Brand reviews |
  | POST | `/api/v1/reviews` | Create review |
- **Storage**: PostgreSQL (`reviews`, `review_images`)
- **Notes**: Verified purchase badge, photo evidence in disputes

### 2.13 Admin Module
- **Role**: Admin dashboard, reports, sub-admin management
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/admin/dashboard` | Platform metrics |
  | GET | `/api/v1/admin/brands/pending` | Pending verification queue |
  | POST | `/api/v1/admin/brands/:id/approve` | Approve/reject brand |
  | GET | `/api/v1/admin/reports/gmv` | GMV report |
  | GET | `/api/v1/admin/reports/delivery-sla` | Delivery SLA report |
  | PUT | `/api/v1/admin/ranking/weights` | Adjust ranking weights |
- **Storage**: PostgreSQL (materialized views, admin audit log)
- **Notes**: Role-based sub-admins (finance, support, operations)

### 2.14 Wallet Module
- **Role**: In-app wallet for refunds, cashback, loyalty points
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/wallet/balance` | Wallet balance |
  | GET | `/api/v1/wallet/transactions` | Transaction history |
  | POST | `/api/v1/wallet/refund` | Refund to wallet |
- **Storage**: PostgreSQL (`wallets`, `wallet_transactions`)
- **Notes**: Instant refund-to-wallet, loyalty points earn/burn

### 2.15 Dispute Module
- **Role**: Order disputes, chat abuse reports, fake product reports
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/disputes` | List disputes |
  | POST | `/api/v1/disputes` | Create dispute |
  | PUT | `/api/v1/disputes/:id/resolve` | Resolve dispute |
- **Storage**: PostgreSQL (`disputes`, `dispute_evidence`, `dispute_messages`)
- **Notes**: Photo/video evidence, admin resolution workflow

### 2.16 Moderation Module
- **Role**: Flagged content moderation
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/moderation/queue` | Moderation queue |
  | POST | `/api/v1/moderation/flag` | Flag content |
  | PUT | `/api/v1/moderation/review/:id` | Review flagged item |
- **Storage**: PostgreSQL (moderation queue, flagged items)
- **Notes**: AI-assisted moderation (image via AWS Rekognition), manual review fallback

### 2.17 Fraud Module
- **Role**: Fraud detection, COD trust score, abnormal patterns
- **Endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/v1/fraud/score/:userId` | Fraud risk score |
  | POST | `/api/v1/fraud/flag` | Flag user for review |
- **Storage**: PostgreSQL + Redis (real-time counters)
- **Notes**: Rule-based + ML scoring, COD refusal rate tracking, card-testing detection

---

## 3. Data Model (Core Tables — PostgreSQL)

### 3.1 Users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    full_name_ar VARCHAR(100) NOT NULL,
    full_name_en VARCHAR(100),
    role ENUM('admin', 'sub_admin', 'brand', 'end_user', 'delivery_company', 'courier'),
    is_verified BOOLEAN DEFAULT FALSE,
    preferred_language ENUM('ar', 'en') DEFAULT 'ar',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Brands
```sql
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    legal_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    commercial_registration VARCHAR(100),
    tax_id VARCHAR(100),
    owner_national_id VARCHAR(100),
    bank_iban VARCHAR(50),
    verification_status ENUM('pending', 'basic_verified', 'trusted_verified') DEFAULT 'pending',
    subscription_tier ENUM('starter', 'growth', 'enterprise') DEFAULT 'starter',
    commission_rate DECIMAL(5,2),
    rating DECIMAL(2,1) DEFAULT 0,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Products (MongoDB Document)
```json
{
  "_id": ObjectId,
  "brand_id": UUID,
  "name_ar": "قميص قطني",
  "name_en": "Cotton Shirt",
  "description_ar": "...",
  "description_en": "...",
  "category_ids": [ObjectId, ObjectId],
  "variants": [
    {
      "sku": "BRD-SHIRT-BLK-L",
      "size": "L",
      "color": "Black",
      "price": 450.00,
      "stock": 50,
      "images": ["url1", "url2"],
      "is_active": true
    }
  ],
  "tags": ["casual", "summer"],
  "is_active": true,
  "created_at": ISODate
}
```

### 3.4 Orders
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2),
    payment_status ENUM('unpaid', 'paid', 'refunded', 'partial_refund') DEFAULT 'unpaid',
    payment_method ENUM('card_stripe', 'card_paymob', 'wallet', 'cod', 'fawry', 'installment'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sub_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    brand_id UUID REFERENCES brands(id),
    status ENUM('pending', 'accepted', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'returned', 'cancelled'),
    delivery_fee DECIMAL(10,2),
    cod_amount DECIMAL(10,2),
    brand_earnings DECIMAL(10,2),
    platform_commission DECIMAL(10,2),
    delivery_company_id UUID REFERENCES delivery_companies(id),
    courier_id UUID REFERENCES couriers(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.5 Delivery Zones
```sql
CREATE TABLE delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    governorate VARCHAR(100) NOT NULL,
    base_fee DECIMAL(10,2) NOT NULL,
    per_km_fee DECIMAL(5,2) DEFAULT 0,
    estimated_days_min INT,
    estimated_days_max INT,
    is_active BOOLEAN DEFAULT TRUE
);
```

### 3.6 Wallet
```sql
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) UNIQUE,
    balance DECIMAL(10,2) DEFAULT 0,
    loyalty_points INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES wallets(id),
    type ENUM('credit', 'debit'),
    amount DECIMAL(10,2),
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.7 Disputes
```sql
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    raised_by UUID REFERENCES users(id),
    reason ENUM('product_not_received', 'damaged', 'wrong_item', 'quality', 'chat_abuse', 'fake_product', 'other'),
    status ENUM('open', 'investigating', 'resolved', 'dismissed') DEFAULT 'open',
    resolution TEXT,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Module Communication

### 4.1 In-Process Calls (Sync)
Modules are in the same process, so they call each other directly:

```typescript
// order/service.ts
import { walletService } from '../wallet/wallet.service';

export class OrderService {
  async completeOrder(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    // Direct in-process call — no HTTP, no queue
    await walletService.credit(order.userId, order.totalAmount * 0.01);
    await notificationService.send({
      userId: order.userId,
      type: 'order.completed',
      data: { orderId },
    });
  }
}
```

### 4.2 Event Bus (Async)
For cross-module concerns that don't need immediate response:

```typescript
// shared/event-bus.ts
type EventHandler = (payload: any) => Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  async emit(event: string, payload: any) {
    const handlers = this.handlers.get(event) || [];
    await Promise.all(handlers.map((h) => h(payload)));
  }
}

export const eventBus = new EventBus();
```

### 4.3 Key Event Flows

#### Order Placement
```
Cart Module → Order Module → Payment Module
                                  │
                         ┌────────▼────────┐
                         │  Payment OK?    │
                         └──┬──────────┬───┘
                         No │          │ Yes
                            ▼          ▼
                     Order Cancelled  Order Confirmed
                                      │
                               ┌──────▼──────┐
                               │  Event Bus   │
                               └──┬───┬───┬──┘
                                  │   │   │
                         ┌────────┘   │   └────────┐
                         ▼            ▼            ▼
                  Notification   Delivery      Brand
                  Module         Module        Module
```

#### Delivery Lifecycle
```
Delivery Module dispatches → Delivery Company API
       │
       ▼
Courier assigned (auto/manual)
       │
       ▼
Picked up → status: "picked_up"
       │
       ▼
In transit → GPS tracking
       │
       ▼
Delivered → OTP + Photo confirmation
       │
       ▼
COD collected → triggers reconciliation
       │
       ▼
Payment Module: mark COD as collected → brand payout
```

---

## 5. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Node.js + TypeScript | Type safety, shared types with frontend |
| **Framework** | Express 5 | Lightweight, widely adopted |
| **ORM (SQL)** | Prisma | Type-safe queries, migrations, excellent DX |
| **ODM (NoSQL)** | Mongoose 9 | Flexible schema for product catalog/chat |
| **Cache** | Redis 7 | Session, cart, ranking cache, pub/sub |
| **Validation** | Zod | Runtime validation + TypeScript type inference |
| **Auth** | JWT (access + refresh) | Stateless auth, 15-min access, 7-day refresh |
| **Real-time** | Socket.io | Chat, live tracking |
| **Object Storage** | MinIO / S3 | Product images, verification docs |
| **Container** | Docker | Consistent dev/prod environment |

---

## 6. Security

- **JWT with refresh tokens** — short-lived access (15 min), long-lived refresh (7 days)
- **RBAC** — `authenticate` + `authorize('admin', 'brand')` middleware per route
- **Rate Limiting** — 100 req/15min per IP on `/api`
- **Helmet** — Security headers (XSS, CSP, etc.)
- **Zod validation** — All inputs validated before reaching business logic
- **bcrypt** — Password hashing with 12 salt rounds
- **Webhook verification** — HMAC signature validation for Stripe/Paymob

---

## 7. Scaling Strategy

| Phase | Users | Orders/mo | Architecture |
|-------|-------|-----------|--------------|
| **MVP** | 1K | 500 | Modular Monolith + single PG + Redis |
| **Growth** | 50K | 25K | Extract hot modules (Order, Payment) as services |
| **Scale** | 500K | 250K | Kubernetes, read replicas, Elasticsearch |
| **Enterprise** | 2M+ | 1M+ | Multi-region, CQRS, data lake |

### Extraction Path
When a module needs to become its own service:
```
1. Copy module code to new repo
2. Add HTTP/API layer
3. Replace in-process calls with HTTP client
4. Deploy independently
5. Update EventBus to use RabbitMQ
```

---
