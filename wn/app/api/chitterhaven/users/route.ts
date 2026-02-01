import { NextResponse } from "next/server";
import { chitterPrisma } from "../../../../lib/chitterhaven";
import { getSessionUserFromRequest } from "../../../../lib/auth";

export async function GET(req: Request) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await chitterPrisma.user.findMany({
      select: { username: true },
      orderBy: { username: "asc" },
      take: 100,
    });
    return NextResponse.json({ users: users.map((u) => u.username) });
  } catch (err) {
    return NextResponse.json({ error: "Unable to read ChitterHaven users." }, { status: 500 });
  }
}
