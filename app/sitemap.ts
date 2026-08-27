import type { MetadataRoute } from 'next';

import { publicEnv } from '@/lib/public-env';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: publicEnv.siteUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
  ];
}
