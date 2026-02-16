import axios from "axios";
import prisma from "../config/db.js";
import { ENV } from "../config/env.js";
import { UserRole } from "@prisma/client";

export const createUser = async (event) => {
    try {
        const { email_addresses, id: clerkId, first_name, last_name, image_url} = event.data;
        const email = email_addresses?.[0]?.email_address;
        const name = [first_name, last_name].filter(Boolean).join(" ").trim() || "Unnamed User";
        const role = ENV.ADMIN_EMAILS.includes(email) ? UserRole.ADMIN : UserRole.USER;
        const newUser = {
        clerkId,
        email,
        name,
        imageUrl: typeof image_url !== "undefined" ? image_url : null,
        role,
        };

        await prisma.user.insert({
            where: { clerkId },
            create: newUser,
        });
    } catch (error) {
        console.error("Error syncing user to database:", error);
    }
};

export const updateUser = async (event) => {
    try {
    const { id: clerkId, email_addresses, first_name, last_name, image_url } = event.data;
    const update = {};
    const email = email_addresses?.[0]?.email_address;
    if(email) update.email = email;
    
    const name = [first_name, last_name].filter(Boolean).join(" ").trim();
    if(name) update.name = name;

    if(typeof image_url !== "undefined") update.imageUrl = image_url;

    if(Object.keys(update).length === 0) {
        console.log(`No updatable fields for user ${clerkId}`);
        return;
    }

    await prisma.user.update({
        where: { clerkId },
        data: update,
    });
} catch (error) {
    console.error("Error updating user in database:", error);
}

};

export const deleteUser = async (userId) => {
    try {
        await prisma.user.delete({
            where: { id: userId },
        });
    } catch (error) {
        console.error("Error deleting user from database:", error);
    }
};