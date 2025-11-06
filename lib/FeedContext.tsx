// lib/FeedContext.tsx
import { createContext, useContext, useState, ReactNode, SetStateAction, Dispatch } from 'react';

type DBStory = {
  id: string;
  title: string;
  body: string;
  cover_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_id: string;
  author_name: string | null;
  category: string;
  profiles: { avatar_url: string | null }[] | null;
};

type FeedContextType = {
  stories: DBStory[];
  likedSet: Set<string>;
  setStories: Dispatch<SetStateAction<DBStory[]>>;
  setLikedSet: Dispatch<SetStateAction<Set<string>>>;
  isLoaded: boolean;
  setIsLoaded: (loaded: boolean) => void;
};

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: ReactNode }) {
  const [stories, setStories] = useState<DBStory[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <FeedContext.Provider 
      value={{ stories, likedSet, setStories, setLikedSet, isLoaded, setIsLoaded }}
    >
      {children}
    </FeedContext.Provider>
  );
}

export function useFeedCache() {
  const context = useContext(FeedContext);
  if (!context) {
    throw new Error('useFeedCache must be used within FeedProvider');
  }
  return context;
}
