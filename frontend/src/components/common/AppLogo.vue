<template>
  <RouterLink to="/" class="app-logo" aria-label="На главную">
    <span class="app-logo__mark" aria-hidden="true"></span>
    <span class="app-logo__text">РобоПодбор</span>
  </RouterLink>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text);
  font-weight: 600;
  font-size: 16px;
  text-decoration: none;
  white-space: nowrap;
}

/* Квадрат стального цвета — условная «ячейка» склада */
.app-logo__mark {
  width: 14px;
  height: 14px;
  border: 3px solid var(--color-primary);
  border-radius: 2px;
}
</style>
