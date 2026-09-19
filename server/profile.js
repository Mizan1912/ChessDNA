import { getDb } from "./db.js";

// The whole point of Phase 3: once signed in, the user's Chess.com username
// is remembered here instead of being typed in every visit.
export async function handleSaveProfile(req, res) {
  const { chessComUsername } = req.body;
  if (typeof chessComUsername !== "string" || chessComUsername.trim() === "") {
    return res.status(400).json({ error: "chessComUsername is required" });
  }

  const db = await getDb();
  await db
    .collection("users")
    .updateOne({ _id: req.user._id }, { $set: { chessComUsername: chessComUsername.trim() } });

  res.json({ ok: true, chessComUsername: chessComUsername.trim() });
}
