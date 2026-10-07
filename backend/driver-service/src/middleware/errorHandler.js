function errorHandler(error, req, res, next) {
    console.error(error);

    let statusCode = error.statusCode || 500;

    if (error.code === "23505") {
        statusCode = 409;
    }

    res.status(statusCode).json({
        success: false,
        error: error.message || "Internal server error",
    });
}

module.exports = errorHandler;