<template>
  <div>
    <div data-testid="welcome">
      {{ welcomeMessage }}
    </div>
    <div data-testid="status">
      {{ readyStatus }}
    </div>
    <div data-testid="context-id">
      {{ context?.id ?? "none" }}
    </div>
  </div>
</template>

<script setup lang="ts">
const { context, updateContext } = useConfigDirectorContext();
await updateContext({ id: "ssr-user-1" });

const { value: welcomeMessage } = useConfigDirectorValue(
  "welcome-message",
  "default-message",
);
const { readyStatus } = useConfigDirectorStatus();
</script>
