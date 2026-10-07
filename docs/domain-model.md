# Domain Model

## 1. Driver

Represents a delivery driver operating on the platform.

### Attributes

- driverId
- name
- phone
- vehicleType
- capacity
- status
- currentLocation
- zoneId
- lastHeartbeat

### Driver Status

- OFFLINE
- AVAILABLE
- BUSY
- ON_DELIVERY

---

## 2. Order

Represents a delivery request created by a customer.

### Attributes

- orderId
- customerId
- pickupLocation
- deliveryLocation
- priority
- status
- createdAt
- updatedAt

### Order Status

- CREATED
- SEARCHING_DRIVER
- ASSIGNED
- PICKED_UP
- IN_TRANSIT
- DELIVERED
- CANCELLED

---

## 3. Delivery

Represents the actual execution of an order.

### Attributes

- deliveryId
- orderId
- driverId
- pickupLocation
- deliveryLocation
- startedAt
- completedAt
- status

### Delivery Status

- CREATED
- PICKED_UP
- IN_TRANSIT
- COMPLETED
- FAILED

---

## 4. Assignment

Represents the relationship between an order and a driver.

### Attributes

- assignmentId
- orderId
- driverId
- assignedAt
- acceptedAt
- expiresAt
- status

### Assignment Status

- PENDING
- ACCEPTED
- REJECTED
- EXPIRED
- CANCELLED

---

## 5. Location

Represents the latest known position of a driver.

### Attributes

- driverId
- latitude
- longitude
- timestamp
- zoneId

Location data is highly dynamic and will eventually be optimized for fast reads.

---

## 6. Zone

Represents a geographic partition.

### Attributes

- zoneId
- name
- boundary
- neighboringZones

Zones will later be used to partition dispatch workloads.

---

# Relationships

Customer

    |
    | creates
    ↓

Order

    |
    | creates
    ↓

Assignment

    |
    | assigned to
    ↓

Driver

    |
    | performs
    ↓

Delivery

Driver

    |
    | continuously updates
    ↓

Location

Location

    |
    | belongs to
    ↓

Zone