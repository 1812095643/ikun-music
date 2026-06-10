<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        class="responsive-modal-shell fixed inset-0 z-[1000] flex items-center justify-center md:items-center items-end"
        @click="handleMaskClick"
      >
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/25 transition-opacity"></div>

        <!-- Content -->
        <Transition :name="isMobile ? 'slide-up' : 'scale-fade'">
          <div
            v-if="show"
            class="responsive-modal-card relative z-10 w-full overflow-hidden flex flex-col max-h-[85vh]"
            :class="[isMobile ? 'rounded-t-lg pb-safe' : 'md:max-w-[720px] md:rounded-lg']"
            @click.stop
          >
            <!-- Header -->
            <div
              class="responsive-modal-header flex items-center justify-between px-4 py-3 shrink-0"
            >
              <h3 class="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {{ title }}
              </h3>
              <button
                class="p-1 -mr-1 rounded-lg text-neutral-400 hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 transition-colors"
                @click="close"
              >
                <i class="ri-close-line text-lg"></i>
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              <slot></slot>
            </div>

            <!-- Footer -->
            <div v-if="$slots.footer" class="responsive-modal-footer px-4 py-3 shrink-0">
              <slot name="footer"></slot>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}>();

const show = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

const close = () => {
  show.value = false;
  emit('close');
};

const handleMaskClick = () => {
  close();
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

// Prevent body scroll when modal is open
watch(show, (val) => {
  if (val) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* PC Scale Fade Transition */
.scale-fade-enter-active,
.scale-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.scale-fade-enter-from,
.scale-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* Mobile Slide Up Transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.18s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(16px);
}

.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

.responsive-modal-card {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.responsive-modal-header {
  border-bottom: 1px solid var(--qqm-border);
}

.responsive-modal-footer {
  border-top: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}
</style>
