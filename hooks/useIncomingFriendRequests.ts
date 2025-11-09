import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { FriendRequest, User } from '../types';

const useIncomingFriendRequests = (user: User | null) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, "friend_requests"),
      where("toUid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const requestsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
        setRequests(requestsData);
        setLoading(false);
      }, 
      (err) => {
        console.error("Error in useIncomingFriendRequests hook:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  return { requests, loading, error };
};

export default useIncomingFriendRequests;
