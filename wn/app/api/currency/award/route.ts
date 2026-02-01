import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSessionUserFromRequest } from "../../../../lib/auth";

export async function POST(req: Request) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount, reason } = (await req.json()) as { amount?: number; reason?: string };
  const safeAmount = Number(amount || 0);
  const trimmedReason = (reason || "Adjustment").slice(0, 120);

  if (!Number.isFinite(safeAmount) || safeAmount === 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextBalance = user.currencyBalance + safeAmount;
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { currencyBalance: nextBalance },
    });
    await tx.currencyTransaction.create({
      data: {
        userId: user.id,
        amount: safeAmount,
        reason: trimmedReason,
      },
    });
    return updatedUser;
  });

  return NextResponse.json({ currencyBalance: updated.currencyBalance });
}
