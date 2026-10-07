const app = require("./app");
const config = require("./config/config");

app.listen(config.port, () => {
    console.log(
        `Dispatch service running on port ${config.port}`
    );
});