function createKuwoPlaybackRequest(id, quality = '320kmp3', encryptQuery) {
  quality = quality || '320kmp3';
  const rid = String(id || '').replace(/^MUSIC_/i, '');
  if (!/^\d+$/.test(rid) || !['128kmp3', '320kmp3', '2000kflac'].includes(quality)) {
    throw new Error('Invalid Kuwo track or quality');
  }
  const format = quality === '2000kflac' ? 'flac' : 'mp3';
  const params = 'user=0&android_id=0&prod=kwplayerhd_ar_4.3.0.8&corp=kuwo&vipver=4.3.0.8' +
    '&source=kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk&notrace=0&type=convert_url2&br=' +
    quality + '&format=' + format + '&sig=0&rid=' + rid +
    '&priority=bitrate&loginUid=0&network=WIFI&loginSid=0&mode=down';
  return { url: 'https://nmobi.kuwo.cn/mobi.s?f=kuwo&q=' + encodeURIComponent(encryptQuery(params)) };
}

module.exports = { createKuwoPlaybackRequest };
