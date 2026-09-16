import type { ILyric, SongResult } from '@/types/music';
import { isDesktopRuntime } from '@/utils';
import { getLocalAudioPath } from '@/utils/audioUrl';

export const lyricToLrc = (lyric?: ILyric): string => {
  if (!lyric?.lrcArray?.length) return '';
  return lyric.lrcArray
    .flatMap((line, index) => {
      const milliseconds = Math.max(
        0,
        Math.round((lyric.lrcTimeArray[index] ?? (line.startTime || 0) / 1000) * 1000)
      );
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = Math.floor((milliseconds % 60000) / 1000);
      const fraction = milliseconds % 1000;
      const tag = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(3, '0')}]`;
      return [line.text, line.trText]
        .filter((text) => text?.trim())
        .map((text) => `${tag}${text.replace(/[\r\n]+/g, ' ')}`);
    })
    .join('\n');
};

export const saveLocalSongLyric = async (song: SongResult, lyric: ILyric): Promise<void> => {
  const filePath = song.localFilePath || getLocalAudioPath(song.playMusicUrl);
  const lrcContent = lyricToLrc(lyric);
  if (!isDesktopRuntime || !filePath || !lrcContent) return;
  const result = await window.desktop.invoke('save-local-music-lyric', { filePath, lrcContent });
  if (!result?.success) throw new Error(result?.error || '歌词暂时无法保存到音乐目录');
};
