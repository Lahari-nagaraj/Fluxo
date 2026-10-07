# Initial Architecture

                    ┌──────────────────┐
                    │     Client       │
                    │   Web Frontend   │
                    └────────┬─────────┘
                             │
                             ↓
                    ┌──────────────────┐
                    │   API Gateway    │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ↓                  ↓                  ↓
 ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
 │ Order Service  │ │ Driver Service │ │Location Service│
 └────────────────┘ └────────────────┘ └────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ↓
                    ┌──────────────────┐
                    │ Dispatch Service │
                    └──────────────────┘

Additional services such as Kafka, Redis, geographic workers,
monitoring and Kubernetes will be introduced incrementally.