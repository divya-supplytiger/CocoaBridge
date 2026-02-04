import { requireAuth } from "@clerk/express";
import { UserRole } from "@prisma/client";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth().userId;
      if (!clerkId) {
        return res.status(401).json({
          message: "Unauthorized: Invalid token",
        });
      }

      const user = await req.prisma.user.findUnique({
        where: { clerkId },
      });
      if (!user) {
        return res.status(401).json({
          message: "Unauthorized: User not found",
        });
      }

      // attach user to request object
      req.user = user; // Attach user to request object

      // call next middleware
      next();
    } catch (error) {
      console.error("Error in protectRoute middleware:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
];

export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: User not found" });
  }

  // check if user is admin
  if (req.user.role !== UserRole.ADMIN) {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
};
