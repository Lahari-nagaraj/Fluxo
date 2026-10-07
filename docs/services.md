# Service Responsibilities

## API Gateway

Responsibilities:

- Entry point for clients
- Request routing
- Authentication later
- Rate limiting later
- Load balancing later

The API Gateway should NOT contain business logic.

---

## Order Service

Responsibilities:

- Create orders
- Retrieve orders
- Update order state
- Maintain order lifecycle
- Publish order-related events later

Owns:

- Order data

---

## Driver Service

Responsibilities:

- Register drivers
- Retrieve drivers
- Manage driver availability
- Manage driver status
- Track driver heartbeat

Owns:

- Driver data

---

## Location Service

Responsibilities:

- Receive driver location updates
- Maintain latest driver location
- Provide nearby-driver queries
- Stream location updates to clients

Owns:

- Dynamic location state

---

## Dispatch Service

Responsibilities:

- Find candidate drivers
- Rank candidate drivers
- Assign drivers
- Handle assignment expiration
- Trigger reassignment

This is the core decision-making service.

---

## Notification Service

Responsibilities:

- Driver assignment notifications
- Order status notifications
- Delivery notifications

This service should remain independent from core order processing.

---

# Service Ownership Principle

Each service owns its own business data.

Services should communicate through APIs or asynchronous events rather than directly modifying another service's database.