export interface WikiData {
  title: string;
  summary: string;
  content: string;
  images: string[];
  thumbnail: string | null;
  pageId: number;
}

export interface WikiApiError {
  error: string;
}

export interface WikiSummary {
  title: string;
  extract: string;
  pageid: number;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
}
