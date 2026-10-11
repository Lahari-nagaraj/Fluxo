# Domain Events

## Order Events

OrderCreated

OrderCancelled

OrderStatusChanged

## Driver Events

DriverRegistered

DriverAvailable

DriverUnavailable

DriverLocationUpdated

DriverHeartbeatExpired

## Dispatch Recovery

The Order Service publishes `OrderCreated` events on `orders`, and the
Dispatch Service consumes them. When a driver cannot be assigned because no
fresh location is cached, dispatch stores the order in the Redis set
`dispatch:waiting:<pickup-zone-id>`.

The Driver Service publishes `DriverAvailable` events on `drivers`. The
Dispatch Service retries waiting orders for the driver's current zone when it
receives one, scans persisted waiting sets when it starts, and rescans them
every 10 seconds. The location cache remains subject to its 60-second TTL;
only a fresh cached location in the pickup zone is eligible for assignment.

## Assignment Events

AssignmentRequested

DriverAssigned

DriverAccepted

DriverRejected

AssignmentExpired

DriverReassigned

## Delivery Events

DeliveryStarted

DeliveryPickedUp

DeliveryCompleted

DeliveryFailed