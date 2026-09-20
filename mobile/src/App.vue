<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';

import { restoreDownloads } from '@/services/downloads';

onLaunch(() => {
  restoreDownloads();
});
</script>

<style>
@import './styles/brand.css';
@import './styles/icons.css';
@import './styles/base.css';
@import './styles/responsive.css';
</style>
