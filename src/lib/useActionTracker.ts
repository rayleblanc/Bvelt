import { useState, useEffect } from "react";

export function useActionTracker() {
  const [reviewsReplied, setReviewsReplied] = useState(() => 
    parseInt(window.localStorage.getItem("bvelt_reviews_replied") || "0", 10)
  );
  const [postsCreated, setPostsCreated] = useState(() => 
    parseInt(window.localStorage.getItem("bvelt_posts_created") || "0", 10)
  );
  const [quotesSent, setQuotesSent] = useState(() => 
    parseInt(window.localStorage.getItem("bvelt_quotes_sent") || "0", 10)
  );

  useEffect(() => {
    const updateStats = () => {
      setReviewsReplied(parseInt(window.localStorage.getItem("bvelt_reviews_replied") || "0", 10));
      setPostsCreated(parseInt(window.localStorage.getItem("bvelt_posts_created") || "0", 10));
      setQuotesSent(parseInt(window.localStorage.getItem("bvelt_quotes_sent") || "0", 10));
    };

    window.addEventListener("storage", updateStats);
    window.addEventListener("bvelt_action_tracked", updateStats);

    return () => {
      window.removeEventListener("storage", updateStats);
      window.removeEventListener("bvelt_action_tracked", updateStats);
    };
  }, []);

  const trackAction = (category: "review" | "post" | "quote") => {
    const key = category === "review" ? "bvelt_reviews_replied" : category === "quote" ? "bvelt_quotes_sent" : "bvelt_posts_created";
    const keyLocalflow = category === "review" ? "localflow_reviews_replied" : category === "quote" ? "localflow_quotes_sent" : "localflow_posts_created";
    
    const count = parseInt(window.localStorage.getItem(key) || "0", 10);
    const newCount = count + 1;
    
    window.localStorage.setItem(key, String(newCount));
    window.localStorage.setItem(keyLocalflow, String(newCount));
    
    // Dispatch event to notify other hook instances in the same window
    window.dispatchEvent(new Event("bvelt_action_tracked"));
  };

  return {
    reviewsReplied,
    postsCreated,
    quotesSent,
    trackAction
  };
}
