import fs from 'fs';

export function logManager(req, res, next) {
    try {
        fs.appendFile("log.txt", `\n${Date.now()} : ${req.ip} : ${req.method} : ${req.path}`, (err) => {
            if (err) {
                console.error('Error writing to log file:', err);
            }
            next(); // Call next() inside the callback to ensure it's called after the file operation completes
        });
    } catch (error) {
        console.error('Error in logManager middleware:', error);
        next(error); // Pass any error to the next middleware
    }
}
