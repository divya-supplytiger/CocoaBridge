import prisma from "../config/db.js";
import { ENV } from "../config/env.js";
import { UserRole } from "@prisma/client";
import {fetchOpportunityDescriptionFromSam} from "./sam.controller.js";
import { stripHTML } from "../utils/extractSAM.js";

const normalizeClerkUserPayload = (event) => {
  const input = Array.isArray(event) ? event[0] : event;
  const data = input?.data ?? input ?? {};

  const clerkId = data?.id ?? null;
  const emailAddresses = Array.isArray(data?.email_addresses)
    ? data.email_addresses
    : Array.isArray(data?.emailAddresses)
      ? data.emailAddresses
      : [];

  const primaryEmailId =
    data?.primary_email_address_id ?? data?.primaryEmailAddressId ?? null;

  const primaryEmailObj =
    emailAddresses.find((entry) => entry?.id === primaryEmailId) ||
    emailAddresses[0] ||
    null;

  const email =
    primaryEmailObj?.email_address ?? primaryEmailObj?.emailAddress ?? null;

  const firstName = data?.first_name ?? data?.firstName ?? null;
  const lastName = data?.last_name ?? data?.lastName ?? null;
  const imageUrl = data?.image_url ?? data?.imageUrl ?? null;
  const name =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Unnamed User";

  return {
    clerkId,
    email,
    name,
    imageUrl,
  };
};

const upsertUserFromClerk = async ({
  clerkId,
  email,
  name,
  imageUrl,
  role,
}) => {
  const existingByClerkId = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (existingByClerkId) {
    return prisma.user.update({
      where: { clerkId },
      data: {
        email,
        name,
        imageUrl,
        role,
      },
    });
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkId,
        email,
        name,
        imageUrl,
        role,
      },
    });
  }

  return prisma.user.create({
    data: {
      clerkId,
      email,
      name,
      imageUrl,
      role,
    },
  });
};

export const createUser = async (event) => {
  try {
    const { clerkId, email, name, imageUrl } = normalizeClerkUserPayload(event);

    if (!clerkId) {
      throw new Error("Missing clerkId in user.created event payload");
    }

    if (!email) {
      console.warn(
        `Skipping user create for clerkId=${clerkId}: no email found in Clerk payload`,
      );
      return;
    }

    const role = ENV.ADMIN_EMAILS.includes(email.toLowerCase())
      ? UserRole.ADMIN
      : UserRole.USER;

    await upsertUserFromClerk({ clerkId, email, name, imageUrl, role });
  } catch (error) {
    console.error("Error syncing user to database:", {
      message: error?.message ?? String(error),
      code: error?.code,
      meta: error?.meta,
    });
    throw error;
  }
};

export const updateUser = async (event) => {
  try {
    const { clerkId, email, name, imageUrl } = normalizeClerkUserPayload(event);

    if (!clerkId) {
      throw new Error("Missing clerkId in user.updated event payload");
    }

    if (!email) {
      console.warn(
        `Skipping user update for clerkId=${clerkId}: no email found in Clerk payload`,
      );
      return;
    }

    const role = ENV.ADMIN_EMAILS.includes(email.toLowerCase())
      ? UserRole.ADMIN
      : UserRole.USER;

    await upsertUserFromClerk({ clerkId, email, name, imageUrl, role });
  } catch (error) {
    console.error("Error updating user in database:", {
      message: error?.message ?? String(error),
      code: error?.code,
      meta: error?.meta,
    });
    throw error;
  }
};

export const deleteUser = async (event) => {
  try {
    const clerkId = event?.data?.id ?? event?.id;
    if (!clerkId) return;

    await prisma.user.delete({
      where: { clerkId },
    });
  } catch (error) {
    if (error?.code === "P2025") {
      return;
    }
    console.error("Error deleting user from database:", {
      message: error?.message ?? String(error),
      code: error?.code,
      meta: error?.meta,
    });
    throw error;
  }
};

export const changeExpiredOpportunitiesToInactive = async () => {
  const now = new Date();
  try {
    const result = await prisma.opportunity.updateMany({
      where: {
        responseDeadline: { lt: now },
        active: true,
      },
      data: { active: false },
    });
    return { message: `Deactivated ${result.count} expired opportunities` };
  } catch (error) {
    console.error("Error deactivating expired opportunities:", {
      message: error?.message ?? "Unknown error",
    });
    throw error;
  }
};

export const runBackfillNullOpportunityDescriptionsFromSam = async ({
  cacheInDB = true,
  limit = 100,
} = {}) => {
  const safeLimit = Math.max(
    1,
    Math.min(Number.parseInt(limit, 10) || 100, 1000),
  );

  const opportunities = await prisma.opportunity.findMany({
    where: {
      noticeId: { not: null },
      OR: [{ description: null }, { description: "" }],
    },
    select: {
      id: true,
      noticeId: true,
      title: true,
    },
    take: safeLimit,
    orderBy: { postedDate: "desc" },
  });

  let fetched = 0;
  let updated = 0;
  let noDescription = 0;
  let failed = 0;
  const failures = [];

  for (const opp of opportunities) {
    if (!opp.noticeId) {
      failed += 1;
      failures.push({
        id: opp.id,
        noticeId: null,
        title: opp.title,
        message: "Missing noticeId",
      });
      continue;
    }

    try {
      const description = await fetchOpportunityDescriptionFromSam(
        opp.noticeId,
      );
      fetched += 1;

      if (!description) {
        noDescription += 1;
        continue;
      }

      const filteredDescription = stripHTML(description);

      if (cacheInDB && filteredDescription) {
        await prisma.opportunity.update({
          where: { id: opp.id },
          data: { description: filteredDescription },
        });
        updated += 1;
      }
    } catch (error) {
      failed += 1;
      failures.push({
        id: opp.id,
        noticeId: opp.noticeId,
        title: opp.title,
        message: error?.message ?? String(error),
      });
    }
  }

  return {
    ok: true,
    cacheInDB,
    meta: {
      selected: opportunities.length,
      limit: safeLimit,
    },
    results: {
      fetched,
      updated,
      noDescription,
      failed,
    },
    failures,
  };
};