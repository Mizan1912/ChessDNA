import { useEffect, useState } from "react";
import { fetchCurrentUser, signInWithGoogle, signOut as signOutRequest } from "../lib/backendApi";

// Holds "who is signed in" for the whole app. On first load, checks whether
// there's already a valid session cookie from a previous visit — this is
// what makes a returning user's saved username show up automatically
// instead of asking them to type it again.
export function useAuth() {
  const [user, setUser] = useState(null);
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .finally(() => setCheckedSession(true));
  }, []);

  async function signIn(credential) {
    const signedInUser = await signInWithGoogle(credential);
    setUser(signedInUser);
    return signedInUser;
  }

  async function signOut() {
    await signOutRequest();
    setUser(null);
  }

  // After the onboarding screen saves a username for a freshly-signed-in
  // user, this keeps local state in sync without waiting for a re-fetch.
  function updateChessComUsername(chessComUsername) {
    setUser((current) => (current ? { ...current, chessComUsername } : current));
  }

  return { user, checkedSession, signIn, signOut, updateChessComUsername };
}
