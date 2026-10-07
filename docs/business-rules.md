# Business Rules

## Driver Assignment

1. Only AVAILABLE drivers can receive a new assignment.
2. A driver can have only one active delivery at a time.
3. A driver cannot be assigned to multiple active orders.
4. An assignment must have an expiration time.
5. If a driver does not accept the assignment before expiration, the assignment expires.
6. An expired assignment can be reassigned to another driver.

## Driver Location

1. Drivers periodically send location updates.
2. The latest known location is used for dispatch.
3. Location data may be eventually consistent.
4. A driver with an expired heartbeat is considered unavailable.

## Order

1. Every order starts in CREATED state.
2. An order moves to SEARCHING_DRIVER when dispatch begins.
3. An order can have only one active assignment.
4. A delivered order cannot be reassigned.
5. A cancelled order cannot be assigned.

## Dispatch

1. Dispatch first searches the driver's local geographic zone.
2. If no suitable driver exists, neighboring zones may be searched.
3. Driver selection is based on a scoring algorithm.
4. The scoring algorithm may consider:
   - distance
   - estimated arrival time
   - driver workload
   - driver availability
   - order priority

## Consistency

Strong consistency is preferred for:

- Active order assignment
- Driver assignment state
- Delivery state transitions

Eventual consistency is acceptable for:

- Driver location
- Analytics
- Metrics
- Notifications