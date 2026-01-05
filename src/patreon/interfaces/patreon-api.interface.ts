export interface PatreonPostData {
  attributes: {
    title: string;
    content?: string;
    url: string;
    published_at: string;
    post_type: string;
    min_cents_pledged_to_view?: number;
  };
  id: string;
  type: string;
}

export interface PatreonApiResponse {
  data: PatreonPostData[];
  links?: {
    next?: string;
  };
  meta?: {
    pagination?: {
      total: number;
    };
  };
}

export interface PatreonCampaignConfig {
  campaignId: string;
  creatorName: string;
  creatorUrl?: string;
  description?: string;
  notificationChannelId: string;
  checkIntervalMins?: number;
}
