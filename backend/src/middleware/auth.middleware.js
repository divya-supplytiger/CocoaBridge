import { requireAuth, clerkClient } from "@clerk/express";
import { UserRole } from "@prisma/client";
import prisma from "../config/db.js";
import { ENV } from "../config/env.js";

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

      let user = await prisma.user.findUnique({ where: { clerkId } });

      // Race condition guard: Inngest may not have synced the user yet on first login.
      // Lazily create them from the Clerk API so the first request doesn't 401.
      if (!user) {
        try {
          const clerkUser = await clerkClient.users.getUser(clerkId);
          const emailAddresses = clerkUser.emailAddresses ?? [];
          const primaryEmail =
            emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
            ?? emailAddresses[0];
          const email = primaryEmail?.emailAddress ?? null;
          if (email) {
            const firstName = clerkUser.firstName ?? null;
            const lastName = clerkUser.lastName ?? null;
            const name = [firstName, lastName].filter(Boolean).join(" ").trim() || "Unnamed User";
            const imageUrl = clerkUser.imageUrl ?? null;
            const role = ENV.ADMIN_EMAILS.includes(email.toLowerCase()) ? UserRole.ADMIN : UserRole.USER;
            user = await prisma.user.upsert({
              where: { clerkId },
              create: { clerkId, email, name, imageUrl, role },
              update: { email, name, imageUrl },
            });
          }
        } catch (syncErr) {
          console.error("protectRoute: failed to lazily create user", syncErr?.message);
        }
      }

      if (!user) {
        return res.status(401).json({ message: "Unauthorized: User not found" });
      }

      if (!user.isActive) {
        return res.status(403).json({
          message: "Forbidden: User is inactive",
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

// Allows READ_ONLY and ADMIN roles; blocks USER role from data endpoints
export const readOnlyOrAbove = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: User not found" });
  }

  if (req.user.role === UserRole.USER) {
    return res.status(403).json({ message: "Forbidden: Insufficient access level" });
  }
  next();
};
