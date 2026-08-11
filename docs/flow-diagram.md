# Speedhawk Audit Flow

```mermaid
flowchart TB
    subgraph row1[ ]
        direction LR
        User -->|submits a URL| Frontend -->|sends it to the server| API
    end
    subgraph row2[ ]
        direction LR
        Queue -->|worker picks up the job| Worker -->|status → running| Check{audit<br/>succeeds?}
    end
    API -->|creates audit, status: pending<br/>queues job| Queue
    Check -->|yes: status → complete| Database[(Database)]
    Check -->|no: status → failed| Database
    Database -.->|results or error| Frontend
    Frontend -.->|shows the report| User

    style row1 fill:none,stroke:none
    style row2 fill:none,stroke:none
```

Carries the audit's status along the same loop: `pending` when queued, `running` once picked up, then it forks into `complete` or `failed`.

┌──────────┐   POST /api/audits    ┌──────────┐   enqueue job     ┌───────────┐
│  CLIENT  │ ────────────────────► │  SERVER  │ ───────────────►  │   REDIS   │
│  React   │                       │ Express  │   (BullMQ queue)  │  (queue)  │
│  + Vite  │ ◄──── poll GET ───────│          │                   └─────┬─────┘
└──────────┘   /api/audits/:id     └────┬─────┘                         │ pulls job
                                        │                          ┌────▼──────┐
                                     writes/reads                  │  WORKER   │
                                        │                          │ Lighthouse│
                                   ┌────▼─────┐                    │ Puppeteer │
                                   │ POSTGRES │ ◄──── writes ───── │  Gemini   │
                                   └──────────┘   results          └───────────┘
