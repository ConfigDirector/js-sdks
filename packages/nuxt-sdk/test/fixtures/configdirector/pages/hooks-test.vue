<script setup lang="ts">
const { readyStatus } = useConfigDirectorStatus();
const { context, updateContext } = useConfigDirectorContext();

useConfigDirectorClientHooks({
  contextUpdated: () => {
    if (typeof window !== "undefined") {
      (window as any).__contextUpdatedCount = ((window as any).__contextUpdatedCount ?? 0) + 1;
    }
  },
});
</script>

<template>
  <div>
    <div data-testid="status">{{ readyStatus }}</div>
    <div data-testid="context-id">{{ context?.id ?? "none" }}</div>
    <button
      data-testid="update-context-btn"
      @click="updateContext({ id: 'hooks-user-' + Date.now() })">
      Update Context
    </button>
    <NuxtLink data-testid="go-home" to="/">Home</NuxtLink>
  </div>
</template>
