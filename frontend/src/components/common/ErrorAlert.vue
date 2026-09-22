<script setup lang="ts">
import { computed } from 'vue'
import { describeError } from '@/utils/errors'

const props = withDefaults(
  defineProps<{
    /** Ошибка API (ApiError) или любая другая; null — ничего не показывать. */
    error: unknown
    /** Показать кнопку «Повторить» (событие retry). */
    retry?: boolean
  }>(),
  { retry: false },
)

const emit = defineEmits<{ retry: [] }>()

const text = computed(() => (props.error == null ? null : describeError(props.error)))
</script>

<template>
  <el-alert v-if="text" type="error" :closable="false" show-icon class="error-alert" role="alert">
    <template #title>{{ text.title }}</template>
    <p class="error-alert__text">{{ text.description }}</p>
    <el-button v-if="retry" size="small" class="error-alert__retry" @click="emit('retry')">
      Повторить
    </el-button>
  </el-alert>
</template>

<style scoped>
.error-alert__text {
  margin: 0;
}

.error-alert__retry {
  margin-top: var(--space-2);
}
</style>
