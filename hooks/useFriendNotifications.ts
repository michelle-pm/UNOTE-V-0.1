import { useEffect, useRef } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { User } from '../types';

export function useFriendNotifications(currentUser: User | null) {
  const notifiedRequests = useRef(new Set());

  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, "friend_requests"),
      where("from", "==", currentUser.uid),
      where("status", "==", "accepted")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        // Only alert for new or modified accepted requests that we haven't notified for yet
        if ((change.type === "added" || change.type === "modified") && !notifiedRequests.current.has(change.doc.id)) {
          alert("🎉 Ваша заявка в друзья принята!");
          notifiedRequests.current.add(change.doc.id); // Mark as notified
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);
}
