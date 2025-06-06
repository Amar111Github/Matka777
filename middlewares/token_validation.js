import jwt from "jsonwebtoken";


export const verifyJWT = (req, res, next) => {
    let token = req.get("authorization");
    if (token) {
        // Removing Bearer from string
        token = token.slice(7);
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return res.json({
                    status: 0,
                    message: "Invalid Token..."
                });
            } else {
                req.decoded = decoded;
                next();
            }
        });
    } else {
        return res.json({
            status: 0,
            message: "Access Denied! Unauthorized User"
        });
    }
}