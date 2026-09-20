import type { Track } from './musicApi';

export interface LocalMusicFilter {
  minimumDuration: number;
  minimumSize: number;
}

export function filterLocalMusic(tracks: Track[], filter: LocalMusicFilter, keyword = ''): Track[] {
  const query = keyword.trim().toLocaleLowerCase();
  return tracks.filter((track) => {
    if (filter.minimumDuration > 0 && !(track.duration >= filter.minimumDuration)) return false;
    if (filter.minimumSize > 0 && !((track.fileSize || 0) >= filter.minimumSize)) return false;
    return (
      !query || `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(query)
    );
  });
}
