import prisma from "../config/db.js";
import { ADMIN_EMAILS } from "../config/env.js";

// Seed initial users into the database with admin roles
const seedUsers = async () => {
  try {
    for (const email of ADMIN_EMAILS) {
      const normalizedEmail = email.trim().toLowerCase();

      await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {
          role: "ADMIN",
          isActive: true,
        },
        create: {
          email: normalizedEmail,
          // Placeholder clerkId will be replaced on first login when you sync Clerk -> DB
          clerkId: `pending-${normalizedEmail}`,
          role: "ADMIN",
          isActive: true,
        },
      });

      console.log(`Seeded admin: ${normalizedEmail}`);
    }
  } catch (error) {
    console.error("Error seeding users:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedUsers().then(() => {
  console.log("User seeding complete.");
  process.exit(0);
});
