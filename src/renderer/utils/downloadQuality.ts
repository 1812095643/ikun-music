export type DownloadQualityKey = 'standard' | 'high' | 'lossless';

export interface DownloadQualityOption {
  key: DownloadQualityKey;
  label: string;
  description: string;
  apiType: '128kmp3' | '320kmp3' | '2000kflac';
  extension: 'mp3' | 'flac';
}

export const DOWNLOAD_QUALITY_OPTIONS: DownloadQualityOption[] = [
  {
    key: 'standard',
    label: '标准音质',
    description: '优先 128kbps',
    apiType: '128kmp3',
    extension: 'mp3'
  },
  {
    key: 'high',
    label: '高品质',
    description: '优先 320kbps',
    apiType: '320kmp3',
    extension: 'mp3'
  },
  {
    key: 'lossless',
    label: '无损音质',
    description: '优先 FLAC',
    apiType: '2000kflac',
    extension: 'flac'
  }
];

const DEFAULT_DOWNLOAD_QUALITY = DOWNLOAD_QUALITY_OPTIONS[1];

export const getDefaultDownloadQuality = () => DEFAULT_DOWNLOAD_QUALITY;

export const getKuwoDownloadQuality = (quality?: string | DownloadQualityKey | null) =>
  DOWNLOAD_QUALITY_OPTIONS.find((item) => item.key === quality) || DEFAULT_DOWNLOAD_QUALITY;
