import authHandler from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export { authHandler as GET, authHandler as POST };
