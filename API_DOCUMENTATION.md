# Cart Service API Documentation

Base URL: `http://localhost:3002`

> [!NOTE]
> All cart endpoints (`/api/cart/*`) require authentication. You must include a valid JWT token in the `Authorization` header or as a cookie.

> [!TIP]
> **Cart Persistence:** Carts are stored in MongoDB and persist across sessions. After a successful checkout, the cart is automatically deleted from the database.

---


## Authentication

All protected endpoints require:
```bash
-H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Health Check

### `GET /health`
Check if the service is running.

**Purpose:** Quick health check for monitoring and load balancers.

```bash
curl http://localhost:3002/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "cart-service"
}
```

---

## Fruit Endpoints (Public - No Auth Required)

### 1. `GET /api/fruits` - Get Fruits (Unified Endpoint)

**Purpose:** Unified endpoint to retrieve fruits with optional filters and pagination. Supports searching, filtering by category, filtering by offers, and getting a specific fruit by ID.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `id` | string | - | Get a specific fruit by MongoDB ObjectId |
| `q` | string | - | Search fruits by name (case-insensitive) |
| `category` | string | - | Filter fruits by category (only in-stock) |
| `hasOffer` | string | `false` | Set to `true` to get fruits with active offers |
| `page` | number | `1` | Page number (1-indexed) |
| `limit` | number | `10` | Page size / number of results per page (max: 50) |
| `sortBy` | string | `name` | Sort field: `price`, `rating`, or `name` |
| `sortOrder` | string | `asc` | Sort direction: `asc` (ascending) or `desc` (descending) |

#### Examples:

**Get all fruits (paginated):**
```bash
curl "http://localhost:3002/api/fruits"
```

**Get first 20 fruits:**
```bash
curl "http://localhost:3002/api/fruits?limit=20"
```

**Get page 2 with 10 items per page:**
```bash
curl "http://localhost:3002/api/fruits?page=2&limit=10"
```

**Get fruit by ID:**
```bash
curl "http://localhost:3002/api/fruits?id=64abc123def456"
```

**Search fruits by name:**
```bash
curl "http://localhost:3002/api/fruits?q=apple"
```

**Get fruits by category:**
```bash
curl "http://localhost:3002/api/fruits?category=Citrus"
```

**Get fruits with active offers:**
```bash
curl "http://localhost:3002/api/fruits?hasOffer=true"
```

**Combine filters with pagination:**
```bash
curl "http://localhost:3002/api/fruits?category=Citrus&page=1&limit=5"
curl "http://localhost:3002/api/fruits?q=apple&hasOffer=true&limit=10"
```

**Sort by price (cheapest first):**
```bash
curl "http://localhost:3002/api/fruits?sortBy=price&sortOrder=asc"
```

**Sort by price (costliest first):**
```bash
curl "http://localhost:3002/api/fruits?sortBy=price&sortOrder=desc"
```

**Sort by rating (highest rated first):**
```bash
curl "http://localhost:3002/api/fruits?sortBy=rating&sortOrder=desc"
```

**Sort by rating (lowest rated first):**
```bash
curl "http://localhost:3002/api/fruits?sortBy=rating&sortOrder=asc"
```

**Sort by price with rating tie-breaker:**
When sorted by price and prices are the same, highest-rated fruits appear first.
```bash
curl "http://localhost:3002/api/fruits?sortBy=price&sortOrder=asc"
```

**Sort by rating with price tie-breaker:**
When sorted by rating and ratings are the same, cheapest fruits appear first.
```bash
curl "http://localhost:3002/api/fruits?sortBy=rating&sortOrder=desc"
```

**Response (list of fruits):**
```json
{
  "success": true,
  "message": "Fruits retrieved successfully",
  "fruits": [
    {
      "_id": "64abc123...",
      "name": "Apple",
      "price": 10,
      "currency": "INR",
      "offerType": "NONE",
      "rating": 4.5,
      "inStock": true,
      "stockQuantity": 100
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasMore": true
  }
}
```

**Response (single fruit by ID):**
```json
{
  "success": true,
  "message": "Fruit retrieved successfully",
  "fruit": {
    "_id": "64abc123...",
    "name": "Apple",
    "price": 10,
    "currency": "INR",
    "offerType": "NONE",
    "rating": 4.5,
    "inStock": true,
    "stockQuantity": 100
  },
  "pagination": {
    "page": 1,
    "limit": 1,
    "total": 1,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

### 2. `POST /api/fruits` - Create New Fruit (Admin)

**Purpose:** Adds a new fruit to the catalog.

```bash
curl -X POST http://localhost:3002/api/fruits \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Apple",
    "price": 10,
    "description": "Fresh red apple",
    "category": "General",
    "stockQuantity": 100,
    "rating": 4.5,
    "offerType": "NONE"
  }'
```

**Offer Types & Calculation Logic:**

The system uses a **progressive cycle logic**. Once the first batch is bought at full offer price, subsequent batches are discounted even further.

| Offer Type | Description | Logic (Price per unit P, Quantity Q) |
|------------|-------------|---------------------------------------|
| `NONE` | No offer | Total = P * Q |
| `BUY_1_GET_1_FREE` | Buy one, get one free | Pay for 1, get 1 free. Groups of 2. |
| `BUY_2_GET_3_FREE` | Buy 2, get 3 free | First 5 items = 2 paid. Every 5 after = 1 paid. |
| `BUY_3_GET_5_FREE` | Buy 3, get 5 free | First 8 items = 3 paid. Every 8 after = 1 paid. |

---

### 3. `PUT /api/fruits/:id` - Update Fruit (Admin)

**Purpose:** Updates an existing fruit's details.

```bash
curl -X PUT http://localhost:3002/api/fruits/64abc123def456 \
  -H "Content-Type: application/json" \
  -d '{"price": 15, "offerType": "BUY_1_GET_1_FREE"}'
```

---

### 4. `PATCH /api/fruits/:id/stock` - Update Stock (Admin)

**Purpose:** Updates only the stock quantity of a fruit.

```bash
curl -X PATCH http://localhost:3002/api/fruits/64abc123def456/stock \
  -H "Content-Type: application/json" \
  -d '{"quantity": 500}'
```

---

### 5. `DELETE /api/fruits/:id` - Delete Fruit (Admin)

**Purpose:** Removes a fruit from the catalog permanently.

```bash
curl -X DELETE http://localhost:3002/api/fruits/64abc123def456
```

---

## Cart Endpoints (Protected - Auth Required)

### 1. `GET /api/cart` - Get User's Cart

**Purpose:** Retrieves the current user's shopping cart with all items and calculated totals.

```bash
curl http://localhost:3002/api/cart \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "cart": {
    "items": [
      {
        "fruitId": "64abc123",
        "name": "Apple",
        "price": 10,
        "quantity": 2, // Paid quantity
        "offerType": "BUY_1_GET_1_FREE",
        "freeItems": 2, // Free promotional items
        "addedAt": "2024-12-23T10:00:00.000Z"
      }
    ],
    "totalItems": 4, // Sum of paid + free
    "totalPrice": 20,
    "discountAmount": 20,
    "finalPrice": 20,
    "updatedAt": "2024-12-23T10:00:00.000Z"
  }
}
```

---

### 2. `POST /api/cart/items` - Add Item to Cart

**Purpose:** Adds a fruit to the user's cart. Requires MongoDB `fruitId`.

```bash
curl -X POST http://localhost:3002/api/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fruitId": "64abc123def456", "quantity": 1}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fruitId` | string | ✅ | MongoDB ObjectId of the fruit |
| `quantity` | number | ✅ | Quantity to add (must be > 0) |

---

### 3. `PUT /api/cart/items/:fruitId` - Update Item Quantity

**Purpose:** Changes the total quantity (paid + free) of an item in the cart. Setting quantity to 0 removes the item.

```bash
curl -X PUT http://localhost:3002/api/cart/items/64abc123def456 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5}'
```

---

### 4. `DELETE /api/cart/items/:fruitId` - Remove Item from Cart

**Purpose:** Completely removes an item from the cart.

```bash
curl -X DELETE http://localhost:3002/api/cart/items/64abc123def456 \
  -H "Authorization: Bearer $TOKEN"
```

---

### 5. `DELETE /api/cart` - Clear Entire Cart

**Purpose:** Removes all items from the user's cart.

```bash
curl -X DELETE http://localhost:3002/api/cart \
  -H "Authorization: Bearer $TOKEN"
```

---

### 6. `POST /api/cart/checkout` - Checkout Cart

**Purpose:** Processes the cart and creates a transaction record.

```bash
curl -X POST http://localhost:3002/api/cart/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod": "UPI", "notes": "Please deliver between 10am-2pm"}'
```

**Payment Methods:** `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `UPI`, `NET_BANKING`, `WALLET`

**Response:**
```json
{
  "success": true,
  "message": "Checkout successful",
  "transaction": {
    "_id": "64abc123def456789",
    "items": [...],
    "totalAmount": 100,
    "finalAmount": 100,
    "paymentMethod": "UPI",
    "status": "COMPLETED"
  }
}
```

---

### 7. `GET /api/cart/transactions` - Get Transaction History

**Purpose:** Retrieves all past transactions for the authenticated user.

```bash
curl http://localhost:3002/api/cart/transactions \
  -H "Authorization: Bearer $TOKEN"
```

---

### 8. `GET /api/cart/transactions/:id` - Get Transaction Details

**Purpose:** Retrieves details of a specific transaction by MongoDB `_id`.

```bash
curl http://localhost:3002/api/cart/transactions/64abc123def456789 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Quick Reference Table

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | ❌ | Health check |
| `/api/fruits` | GET | ❌ | Get fruits (with filters: `id`, `q`, `category`, `hasOffer`, `sortBy`, `sortOrder`) |
| `/api/fruits` | POST | ⚠️ Admin | Create fruit |
| `/api/fruits/:id` | PUT | ⚠️ Admin | Update fruit |
| `/api/fruits/:id/stock` | PATCH | ⚠️ Admin | Update stock |
| `/api/fruits/:id` | DELETE | ⚠️ Admin | Delete fruit |
| `/api/cart` | GET | ✅ | Get user's cart |
| `/api/cart/items` | POST | ✅ | Add to cart |
| `/api/cart/items/:fruitId` | PUT | ✅ | Update quantity |
| `/api/cart/items/:fruitId` | DELETE | ✅ | Remove from cart |
| `/api/cart` | DELETE | ✅ | Clear cart |
| `/api/cart/checkout` | POST | ✅ | Checkout |
| `/api/cart/transactions` | GET | ✅ | Order history |
| `/api/cart/transactions/:id` | GET | ✅ | Order details |

---

## Cart Pricing Examples (Calculation Verification)

### Problem 1: No Offer Applied
- **1 Apple** (Rs. 10) → **Total Rs. 10**
- **2 Apples** → **Total Rs. 20**
- **1 Orange** (Rs. 20) → **Total Rs. 20**
- **2 Oranges** → **Total Rs. 40**

### Problem 2: Buy 1 Get 1 Free Offer (Apples @ Rs. 10)
- **2 Apples** → **Total Rs. 10** (1 Paid + 1 Free)
- **3 Apples** → **Total Rs. 20** (2 Paid + 1 Free)
- **4 Apples** → **Total Rs. 20** (2 Paid + 2 Free)
- **5 Apples** → **Total Rs. 30** (3 Paid + 2 Free)

### Problem 3: Buy 2 Get 3 Free Offer (Oranges @ Rs. 20)
- **5 Oranges** → **Total Rs. 40** (Pay for 2, Get 3 Free)
- **6 Oranges** → **Total Rs. 60** (Pay for 3, Get 3 Free)
- **7-10 Oranges** → **Total Rs. 60** (Pay for 3, Get 4-7 Free)
- **11 Oranges** → **Total Rs. 80** (Pay for 4, Get 7 Free)


