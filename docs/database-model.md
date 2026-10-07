# Database Model

## drivers

- driver_id
- name
- phone
- vehicle_type
- capacity
- status
- zone_id
- created_at
- updated_at

---

## orders

- order_id
- customer_id
- pickup_latitude
- pickup_longitude
- delivery_latitude
- delivery_longitude
- priority
- status
- created_at
- updated_at

---

## deliveries

- delivery_id
- order_id
- driver_id
- status
- started_at
- completed_at
- created_at
- updated_at

---

## assignments

- assignment_id
- order_id
- driver_id
- status
- assigned_at
- accepted_at
- expires_at
- created_at
- updated_at

---

## zones

- zone_id
- name
- boundary
- created_at
- updated_at