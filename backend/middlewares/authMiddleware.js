import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

/* export const authenticateToken = (req, res, next) => {
    const token = req.header("Authorization");

    if (!token) {
        res.status(401).json({ status: 401, message: "Access Denied. No Token Provided." });
        return;
    }

    try {
        const decoded = jwt.verify(token, "your_secret_key");
        req.user = decoded; // Attach user data to request
        next(); // Proceed to next middleware/route
    } catch (error) {
        res.status(403).json({ status: 403, message: "Invalid Token" });
    }
}; */

//new code

/* export const authenticateToken = (req, res, next) => {
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

    if (!token) {
        return res.status(401).json({ status: 401, message: "Access Denied. No Token Provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_secret_key");
        req.user = decoded; // Attach user data to request
        next();
    } catch (error) {
        console.error("JWT verification failed:", error);
        res.status(403).json({ status: 403, message: "Invalid Token" });
    }
}; */

// latest one
export const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");

  // ✅ If no token, just skip authentication and continue (user stays unauthenticated)
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, "your_secret_key");
    req.user = decoded; // attach user data to req
    next();
  } catch (error) {
    console.log("Invalid token:", error.message);
    req.user = null; // still continue — don’t block the request
    next();
  }
};

export const isAdmin = (req, res, next) => {
  const userRole = req.user?.role?.toLowerCase?.();
  console.log("User Role:", userRole); // Debugging line
  if (!userRole || userRole !== "admin") {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
};

export const isMember = (req, res, next) => {
  if (!req.user || req.user.role !== "member") {
    res
      .status(403)
      .json({ status: 403, message: "Access Denied. Members Only." });
    return;
  }
  next();
};

export const isSeller = (req, res, next) => {
  if (!req.user || req.user.role !== "isBusinessMember") {
    res
      .status(403)
      .json({ status: 403, message: "Access Denied. Seller  Only." });
    return;
  }
  next();
};
