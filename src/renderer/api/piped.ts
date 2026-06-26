import { assertExternalOk, requestExternalMusic } from './externalMusicRequest';

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.syncpundit.io',
  'https://api-piped.mha.fi',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.leptons.xyz'
];

export const getPipedStreams = async (videoId: string) => {
  let lastError: unknown;

  for (const baseUrl of PIPED_INSTANCES) {
    try {
      const response = await requestExternalMusic<any>(
        `${baseUrl}/streams/${encodeURIComponent(videoId)}`,
        {
          timeout: 9000,
          requestPrefix: 'piped-stream',
          headers: {
            Referer: baseUrl
          }
        }
      );
      const body = assertExternalOk(response, 'Piped 代理');
      if (Array.isArray(body?.audioStreams) && body.audioStreams.length > 0) {
        return { ...body, pipedInstance: baseUrl };
      }
      throw new Error(body?.message || 'Piped 未返回音频流');
    } catch (error) {
      lastError = error;
      console.warn(`Piped 实例不可用：${baseUrl}`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const getPipedAudioUrl = async (videoId: string) => {
  const response = await getPipedStreams(videoId);
  const selected = [...(response.audioStreams || [])]
    .filter((item: any) => item?.url)
    .sort((a: any, b: any) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
  if (!selected?.url) throw new Error('Piped 没有可用音频流');

  return {
    data: {
      code: 200,
      message: 'success',
      data: {
        url: selected.url,
        source: 'piped',
        type: String(selected.format || selected.mimeType || 'm4a').toLowerCase(),
        bitrate: selected.bitrate || 0,
        instance: response.pipedInstance
      }
    }
  };
};
