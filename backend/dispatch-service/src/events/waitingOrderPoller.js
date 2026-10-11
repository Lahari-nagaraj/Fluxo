
const { redisClient } = require("../clients/redisClient");
const { dispatchOrder } = require("../services/dispatchService");

const POLL_INTERVAL_MS = 5000;

let pollTimer = null;
let polling = false;

async function processWaitingOrders() {
    if (polling) {
        return;
    }

    polling = true;

    try {
        const waitingSetKeys = [];

        for await (const key of redisClient.scanIterator({
            MATCH: "dispatch:waiting:*",
            COUNT: 100,
        })) {
            waitingSetKeys.push(key);
        }

        for (const key of waitingSetKeys) {
            const zoneId = key.slice("dispatch:waiting:".length);
            const orderIds = await redisClient.sMembers(key);

            for (const orderId of orderIds) {
                try {
                    const result = await dispatchOrder(orderId);

                    if (
                        result?.status === "ASSIGNED" ||
                        result?.status === "ALREADY_ASSIGNED" ||
                        result?.status === "SKIPPED"
                    ) {
                        console.log(
                            `Waiting-order poll processed ${orderId}: ${result.status}`
                        );
                    }
                } catch (error) {
                    console.error(
                        `Waiting-order poll failed for ${orderId} in ${zoneId}:`,
                        error.message
                    );
                }
            }
        }
    } catch (error) {
        console.error(
            "Waiting-order poll failed:",
            error.message
        );
    } finally {
        polling = false;
    }
}

function startWaitingOrderPoller() {
    if (pollTimer) {
        return;
    }

    console.log(
        `Waiting-order poller started (every ${POLL_INTERVAL_MS / 1000} seconds)`
    );

    // Process existing waiting orders immediately.
    void processWaitingOrders();

    pollTimer = setInterval(() => {
        void processWaitingOrders();
    }, POLL_INTERVAL_MS);
}

module.exports = {
    startWaitingOrderPoller,
};
