# Order Lifecycle

CREATED
   |
   ↓
SEARCHING_DRIVER
   |
   ↓
ASSIGNED
   |
   ↓
PICKED_UP
   |
   ↓
IN_TRANSIT
   |
   ↓
DELIVERED


Alternative paths:

SEARCHING_DRIVER
      |
      ↓
  NO DRIVER
      |
      ↓
RETRY / REASSIGN


ASSIGNED
    |
    ↓
DRIVER REJECTS
    |
    ↓
SEARCHING_DRIVER


ASSIGNED
    |
    ↓
ASSIGNMENT EXPIRES
    |
    ↓
SEARCHING_DRIVER


Any valid state
      |
      ↓
  CANCELLED