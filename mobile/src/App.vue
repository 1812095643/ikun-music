<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app';

import { restoreDownloads } from '@/services/downloads';
import { synchronizeAudio } from '@/stores/player';

onLaunch(() => {
  restoreDownloads();
});
onShow(synchronizeAudio);
</script>

<style>
@import './styles/brand.css';
@import './styles/icons.css';
@import './styles/base.css';
@import './styles/responsive.css';
</style>
