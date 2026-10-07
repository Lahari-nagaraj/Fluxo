const { generateDrivers } =
    require("./generators/driverGenerator");

const {
    startLocationSimulation,
} = require("./generators/locationSimulator");

const {
    startOrderSimulation,
} = require("./orderSimulator");

async function startSimulator() {
    console.log("=================================");
    console.log("🚀 Delivery Simulator Starting");
    console.log("=================================");

    try {
        const drivers =
            await generateDrivers();

        console.log(
            `\n✅ ${drivers.length} drivers created`
        );

        console.log(
            "\n📍 Starting location simulation..."
        );

        startLocationSimulation(drivers);

        console.log(
            "📦 Starting order simulation..."
        );

        startOrderSimulation(drivers);

        console.log(
            "\n🔥 Simulator is running\n"
        );
    } catch (error) {
        console.error(
            "Simulator startup failed:",
            error.response?.data ||
            error.message
        );

        process.exit(1);
    }
}

startSimulator();