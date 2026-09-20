<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app';

import { pauseAppUpdateCheck, scheduleAppUpdateCheck } from '@/services/appUpdate';
import { restoreDownloads } from '@/services/downloads';
import { synchronizeAudio } from '@/stores/player';

onLaunch(() => {
  restoreDownloads();
});
onShow(() => {
  synchronizeAudio();
  scheduleAppUpdateCheck();
});
onHide(pauseAppUpdateCheck);
</script>

<style>
@import './styles/brand.css';
@import './styles/icons.css';
@import './styles/base.css';
@import './styles/responsive.css';
</style>
